package main

import (
	"bytes"
	"crypto/rand"
	"database/sql"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestConcurrentBookingsAndReactivation(t *testing.T) {
	dsn := os.Getenv("MEDICINES_TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("MEDICINES_TEST_POSTGRES_DSN is not set")
	}
	adminDB, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = adminDB.Close() })
	random := make([]byte, 8)
	if _, err := rand.Read(random); err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("appointment_test_%x", random)
	if _, err := adminDB.Exec(`CREATE SCHEMA ` + schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := adminDB.Exec(`DROP SCHEMA ` + schema + ` CASCADE`); err != nil {
			t.Errorf("remove test schema: %v", err)
		}
	})
	address, err := url.Parse(dsn)
	if err != nil || (address.Scheme != "postgres" && address.Scheme != "postgresql") {
		t.Fatal("MEDICINES_TEST_POSTGRES_DSN must be a PostgreSQL URL")
	}
	params := address.Query()
	params.Set("search_path", schema)
	address.RawQuery = params.Encode()
	testDB, err := sql.Open("postgres", address.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = testDB.Close() })
	for _, statement := range []string{
		`CREATE TABLE users (id INTEGER PRIMARY KEY, nutritionist_id INTEGER, role TEXT, is_disabled BOOLEAN NOT NULL DEFAULT FALSE)`,
		`INSERT INTO users VALUES (1, 2, 'user', FALSE), (2, NULL, 'nutritionist', FALSE), (3, 2, 'user', FALSE)`,
		`CREATE TABLE nutritionist_availability (nutritionist_id INTEGER, day_of_week INTEGER, start_time TEXT, end_time TEXT, is_available BOOLEAN)`,
		`INSERT INTO nutritionist_availability VALUES (2, 1, '09:00', '10:00', TRUE)`,
		`CREATE TABLE nutritionist_schedule_settings (nutritionist_id INTEGER, time_zone TEXT)`,
		`INSERT INTO nutritionist_schedule_settings VALUES (2, 'UTC')`,
		`CREATE TABLE nutritionist_schedule_exceptions (nutritionist_id INTEGER, exception_date DATE, intervals JSONB)`,
		`CREATE TABLE appointments (id SERIAL PRIMARY KEY, user_id INTEGER, nutritionist_id INTEGER, title TEXT, description TEXT, appointment_date TEXT, appointment_time TEXT, starts_at TIMESTAMPTZ, status TEXT, notes TEXT, created_at TEXT, is_archived BOOLEAN DEFAULT FALSE)`,
		`CREATE TABLE appointment_changes (id SERIAL PRIMARY KEY, appointment_id INTEGER, proposed_by INTEGER, new_date TEXT, new_time TEXT, starts_at TIMESTAMPTZ, status TEXT DEFAULT 'pending', responded_at TEXT)`,
		`CREATE TABLE notifications (user_id INTEGER, type TEXT, title TEXT, message TEXT, related_id INTEGER, is_read BOOLEAN DEFAULT FALSE, created_at TEXT)`,
	} {
		if _, err := testDB.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	previousDB := db
	db = testDB
	t.Cleanup(func() { db = previousDB })
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		id, _ := strconv.Atoi(c.GetHeader("X-Test-User"))
		c.Set("claims", &Claims{UserID: id, Role: "user"})
		c.Next()
	})
	router.POST("/appointments", createAppointmentHandler)
	router.PUT("/appointments/:id", updateAppointmentHandler)
	router.PUT("/changes/:id/accept", acceptAppointmentChangeHandler)
	router.PUT("/changes/:id/reject", rejectAppointmentChangeHandler)
	request := func(method, path, body string, userID int) int {
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User", strconv.Itoa(userID))
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res.Code
	}
	const booking = `{"title":"Test","appointment_date":"2026-11-30","appointment_time":"09:00"}`
	statuses := make([]int, 2)
	var wg sync.WaitGroup
	for i, userID := range []int{1, 3} {
		wg.Add(1)
		go func(i, userID int) {
			defer wg.Done()
			statuses[i] = request(http.MethodPost, "/appointments", booking, userID)
		}(i, userID)
	}
	wg.Wait()
	if !((statuses[0] == http.StatusOK && statuses[1] == http.StatusConflict) ||
		(statuses[1] == http.StatusOK && statuses[0] == http.StatusConflict)) {
		t.Fatalf("concurrent booking statuses = %v", statuses)
	}
	var id, owner int
	if err := testDB.QueryRow(`SELECT id, user_id FROM appointments`).Scan(&id, &owner); err != nil {
		t.Fatal(err)
	}
	path := fmt.Sprintf("/appointments/%d", id)
	cancel := `{"title":"Test","appointment_date":"2026-11-30","appointment_time":"09:00","status":"cancelled"}`
	if code := request(http.MethodPut, path, cancel, owner); code != http.StatusOK {
		t.Fatalf("cancel returned %d", code)
	}
	other := 1
	if owner == 1 {
		other = 3
	}
	if code := request(http.MethodPost, "/appointments", booking, other); code != http.StatusOK {
		t.Fatalf("booking after cancellation returned %d", code)
	}
	reactivate := `{"title":"Test","appointment_date":"2026-11-30","appointment_time":"09:00","status":"scheduled"}`
	if code := request(http.MethodPut, path, reactivate, owner); code != http.StatusConflict {
		t.Fatalf("reactivation after rebooking returned %d", code)
	}
	var otherAppointment int
	if err := testDB.QueryRow(`SELECT id FROM appointments WHERE user_id = $1 AND status = 'scheduled'`, other).Scan(&otherAppointment); err != nil {
		t.Fatal(err)
	}
	var occupiedID int
	if err := testDB.QueryRow(`INSERT INTO appointments (user_id, nutritionist_id, appointment_date, appointment_time, starts_at, status, is_archived) VALUES ($1, 2, '2026-11-30', '09:30', '2026-11-30 09:30+00', 'scheduled', TRUE) RETURNING id`, owner).Scan(&occupiedID); err != nil {
		t.Fatal(err)
	}
	var changeID int
	if err := testDB.QueryRow(`INSERT INTO appointment_changes (appointment_id, proposed_by, new_date, new_time, starts_at) VALUES ($1, 2, '2026-11-30', '09:30', '2026-11-30 09:30+00') RETURNING id`, otherAppointment).Scan(&changeID); err != nil {
		t.Fatal(err)
	}
	acceptPath := fmt.Sprintf("/changes/%d/accept", changeID)
	if code := request(http.MethodPut, acceptPath, `{}`, other); code != http.StatusConflict {
		t.Fatalf("accepting occupied archived slot returned %d", code)
	}
	var changeStatus, currentTime string
	if err := testDB.QueryRow(`SELECT c.status, a.appointment_time FROM appointment_changes c JOIN appointments a ON a.id = c.appointment_id WHERE c.id = $1`, changeID).Scan(&changeStatus, &currentTime); err != nil {
		t.Fatal(err)
	}
	if changeStatus != "pending" || currentTime != "09:00" {
		t.Fatalf("conflicting change modified data: status=%q time=%q", changeStatus, currentTime)
	}
	cancelOccupied := `{"title":"Test","appointment_date":"2026-11-30","appointment_time":"09:30","status":"cancelled"}`
	if code := request(http.MethodPut, fmt.Sprintf("/appointments/%d", occupiedID), cancelOccupied, owner); code != http.StatusOK {
		t.Fatalf("cancel archived appointment returned %d", code)
	}
	if code := request(http.MethodPut, acceptPath, `{}`, other); code != http.StatusOK {
		t.Fatalf("accepting available proposal returned %d", code)
	}
	if code := request(http.MethodPut, fmt.Sprintf("/changes/%d/reject", changeID), `{}`, other); code != http.StatusConflict {
		t.Fatalf("rejecting accepted proposal returned %d", code)
	}
}
