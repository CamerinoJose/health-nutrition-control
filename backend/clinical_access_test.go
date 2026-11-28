package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestClinicalAccessPostgres(t *testing.T) {
	dsn := os.Getenv("MEDICINES_TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("MEDICINES_TEST_POSTGRES_DSN is not set")
	}
	testDB, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	testDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = testDB.Close() })
	for _, statement := range []string{
		`CREATE TEMP TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, role TEXT, nutritionist_id INTEGER)`,
		`INSERT INTO users VALUES (1, 'Patient', 'patient@example.test', 'user', 2),
			(2, 'Professional', 'professional@example.test', 'nutritionist', NULL),
			(3, 'Other patient', 'other@example.test', 'user', 4),
			(4, 'Other professional', 'other-professional@example.test', 'nutritionist', NULL),
			(5, 'Admin', 'admin@example.test', 'admin', NULL)`,
		`CREATE TEMP TABLE histories (id INTEGER, user_id INTEGER, date TEXT, weight DOUBLE PRECISION, fat_percentage DOUBLE PRECISION, muscle_percentage DOUBLE PRECISION)`,
		`INSERT INTO histories VALUES (1, 1, '2026-01-01', 70, 20, 40), (2, 3, '2026-01-01', 80, 20, 40)`,
		`CREATE TEMP TABLE appointments (id INTEGER PRIMARY KEY, user_id INTEGER, nutritionist_id INTEGER, status TEXT, notes TEXT, appointment_date TEXT, appointment_time TEXT, starts_at TIMESTAMPTZ)`,
		`INSERT INTO appointments VALUES (10, 1, 2, 'scheduled', '', '2026-01-30', '09:00', '2026-01-30 09:00+00'), (11, 3, 4, 'scheduled', '', '2026-01-30', '09:00', '2026-01-30 09:00+00')`,
		`CREATE TEMP TABLE nutritionist_schedule_settings (nutritionist_id INTEGER, time_zone TEXT)`,
		`INSERT INTO nutritionist_schedule_settings VALUES (2, 'UTC'), (4, 'UTC')`,
		`CREATE TEMP TABLE nutritionist_schedule_exceptions (nutritionist_id INTEGER, exception_date DATE, intervals JSONB)`,
		`CREATE TEMP TABLE nutritionist_availability (nutritionist_id INTEGER, day_of_week INTEGER, start_time TEXT, end_time TEXT, is_available BOOLEAN)`,
		`INSERT INTO nutritionist_availability VALUES (2, 0, '09:00', '10:00', TRUE), (4, 0, '09:00', '10:00', TRUE)`,
		`CREATE TEMP TABLE recommendations (id SERIAL PRIMARY KEY, nutritionist_id INTEGER, patient_id INTEGER, appointment_id INTEGER, recommendation_text TEXT, diet_changes TEXT, exercise_plan TEXT, next_goals TEXT, created_at TEXT)`,
		`CREATE TEMP TABLE meal_plans (id SERIAL PRIMARY KEY, user_id INTEGER, name TEXT, start_date TEXT, snacks TEXT, created_at TEXT)`,
		`CREATE TEMP TABLE plan_meals (id SERIAL PRIMARY KEY, plan_id INTEGER, day_of_week TEXT, meal_type TEXT, name TEXT, ingredients TEXT, preparation TEXT)`,
		`CREATE TEMP TABLE notifications (id SERIAL PRIMARY KEY, user_id INTEGER, type TEXT, title TEXT, message TEXT, related_id INTEGER, is_read BOOLEAN DEFAULT FALSE, created_at TEXT)`,
		`CREATE TEMP TABLE appointment_changes (id SERIAL PRIMARY KEY, appointment_id INTEGER, proposed_by INTEGER, new_date TEXT, new_time TEXT, starts_at TIMESTAMPTZ, reason TEXT, status TEXT DEFAULT 'pending', created_at TEXT, responded_at TEXT)`,
	} {
		if _, err := testDB.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	previousDB := db
	db = testDB
	t.Cleanup(func() { db = previousDB })
	gin.SetMode(gin.TestMode)
	var claims Claims
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("claims", &claims); c.Next() })
	router.GET("/patients/:id/history", getPatientHistoryHandler)
	router.POST("/recommendations", createRecommendationHandler)
	router.GET("/recommendations/:patient_id", getRecommendationsHandler)
	router.PUT("/appointments/:id/notes", updateAppointmentNotesHandler)
	router.POST("/appointments/:id/propose", proposeAppointmentChangeHandler)
	router.GET("/changes/:appointment_id", getAppointmentChangesHandler)
	router.GET("/admin/export", denyAdminClinicalAccess)
	router.POST("/patients/:id/meal-plan", createMealPlanForPatientHandler)
	router.GET("/patients/:id/meal-plan", getPatientMealPlanHandler)
	request := func(method, path, body string) int {
		response := httptest.NewRecorder()
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(response, req)
		return response.Code
	}
	claims = Claims{UserID: 2, Role: "nutritionist"}
	if status := request(http.MethodGet, "/patients/1/history", ""); status != http.StatusOK {
		t.Fatalf("assigned history: %d", status)
	}
	if status := request(http.MethodGet, "/patients/3/history", ""); status != http.StatusNotFound {
		t.Fatalf("unassigned history: %d", status)
	}
	if status := request(http.MethodPost, "/recommendations", `{"patient_id":1,"appointment_id":11,"recommendation_text":"test"}`); status != http.StatusNotFound {
		t.Fatalf("cross-patient appointment: %d", status)
	}
	if status := request(http.MethodPut, "/appointments/11/notes", `{"notes":"test","status":"completed"}`); status != http.StatusNotFound {
		t.Fatalf("unassigned appointment: %d", status)
	}
	var count int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM recommendations`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("unauthorized recommendation was stored: count=%d err=%v", count, err)
	}
	if status := request(http.MethodPost, "/recommendations", `{"patient_id":1,"appointment_id":10,"recommendation_text":"test"}`); status != http.StatusOK {
		t.Fatalf("assigned recommendation: %d", status)
	}
	if status := request(http.MethodGet, "/recommendations/1", ""); status != http.StatusOK {
		t.Fatalf("assigned recommendations: %d", status)
	}
	plan := `{"name":"test","start_date":"2026-01-01","meals":[{"day_of_week":"Lunes","meal_type":"Desayuno","name":"test"}]}`
	if status := request(http.MethodPost, "/patients/3/meal-plan", plan); status != http.StatusNotFound {
		t.Fatalf("unassigned meal plan: %d", status)
	}
	if status := request(http.MethodPost, "/patients/1/meal-plan", plan); status != http.StatusOK {
		t.Fatalf("assigned meal plan: %d", status)
	}
	if status := request(http.MethodGet, "/patients/1/meal-plan", ""); status != http.StatusOK {
		t.Fatalf("assigned meal plan read: %d", status)
	}
	if status := request(http.MethodPost, "/appointments/10/propose", `{"new_date":"2026-02-01","new_time":"09:00"}`); status != http.StatusOK {
		t.Fatalf("assigned appointment proposal: %d", status)
	}
	if status := request(http.MethodPost, "/appointments/11/propose", `{"new_date":"2026-02-01","new_time":"09:00"}`); status != http.StatusNotFound {
		t.Fatalf("unassigned appointment proposal: %d", status)
	}
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM meal_plans`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("unauthorized meal plan was stored: count=%d err=%v", count, err)
	}
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM appointment_changes`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("unauthorized appointment proposal was stored: count=%d err=%v", count, err)
	}
	changeCount := func() int {
		t.Helper()
		res := httptest.NewRecorder()
		router.ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/changes/10", nil))
		var changes []json.RawMessage
		if err := json.Unmarshal(res.Body.Bytes(), &changes); err != nil || res.Code != http.StatusOK {
			t.Fatalf("appointment changes: %d %s %v", res.Code, res.Body.String(), err)
		}
		return len(changes)
	}
	if changeCount() != 1 {
		t.Fatal("assigned professional could not see appointment change")
	}
	claims = Claims{UserID: 3, Role: "user"}
	if changeCount() != 0 {
		t.Fatal("other patient could see appointment change")
	}
	claims = Claims{UserID: 1, Role: "user"}
	if changeCount() != 1 {
		t.Fatal("patient could not see own appointment change")
	}
	claims = Claims{UserID: 2, Role: "nutritionist"}
	if _, err := testDB.Exec(`UPDATE users SET nutritionist_id = 4 WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	if changeCount() != 0 {
		t.Fatal("previous professional could see appointment change")
	}
	if status := request(http.MethodGet, "/patients/1/history", ""); status != http.StatusNotFound {
		t.Fatalf("previous professional after reassignment: %d", status)
	}
	claims = Claims{UserID: 4, Role: "nutritionist"}
	if status := request(http.MethodGet, "/patients/1/history", ""); status != http.StatusOK {
		t.Fatalf("new professional after reassignment: %d", status)
	}
	if status := request(http.MethodPut, "/appointments/10/notes", `{"notes":"test","status":"completed"}`); status != http.StatusNotFound {
		t.Fatalf("old professional's appointment: %d", status)
	}
	if _, err := testDB.Exec(`UPDATE users SET role = 'user' WHERE id = 4`); err != nil {
		t.Fatal(err)
	}
	if status := request(http.MethodGet, "/patients/1/history", ""); status != http.StatusNotFound {
		t.Fatalf("revoked professional role: %d", status)
	}
	claims = Claims{UserID: 5, Role: "admin"}
	if status := request(http.MethodGet, "/patients/1/history", ""); status != http.StatusForbidden {
		t.Fatalf("admin clinical access: %d", status)
	}
	if status := request(http.MethodGet, "/admin/export", ""); status != http.StatusForbidden {
		t.Fatalf("admin clinical export: %d", status)
	}
}
