package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestScheduleValidation(t *testing.T) {
	tests := []struct {
		name string
		json string
		ok   bool
	}{
		{"Sunday and closed exception", `{"time_zone":"America/Mexico_City","weekly":[{"day_of_week":0,"start_time":"09:00","end_time":"12:00"}],"exceptions":[{"date":"2026-11-30","intervals":[]}]}`, true},
		{"overlap", `{"time_zone":"UTC","weekly":[{"day_of_week":1,"start_time":"09:00","end_time":"10:00"},{"day_of_week":1,"start_time":"09:30","end_time":"11:00"}]}`, false},
		{"invalid zone", `{"time_zone":"not-a-zone"}`, false},
		{"invalid date", `{"time_zone":"UTC","exceptions":[{"date":"2026-02-30","intervals":[]}]}`, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req scheduleRequest
			if err := json.Unmarshal([]byte(tt.json), &req); err != nil {
				t.Fatal(err)
			}
			if err := validateSchedule(req); (err == nil) != tt.ok {
				t.Fatalf("validation error=%v, want valid=%v", err, tt.ok)
			}
		})
	}
}

func TestScheduleRequiresConfirmedLegacyZoneAndPreservesInstant(t *testing.T) {
	testDB := openTemporaryPostgres(t)
	for _, statement := range []string{
		`CREATE TEMP TABLE users (id INTEGER PRIMARY KEY, nutritionist_id INTEGER, role TEXT, is_disabled BOOLEAN NOT NULL DEFAULT FALSE)`,
		`INSERT INTO users VALUES (1, 2, 'user', FALSE), (2, NULL, 'nutritionist', FALSE), (3, NULL, 'nutritionist', FALSE), (4, 3, 'user', FALSE), (5, NULL, 'user', FALSE)`,
		`CREATE TEMP TABLE appointments (id INTEGER PRIMARY KEY, user_id INTEGER, nutritionist_id INTEGER, appointment_date TEXT, appointment_time TEXT, starts_at TIMESTAMPTZ, status TEXT)`,
		`INSERT INTO appointments VALUES (10, 1, 2, '2026-11-30', '09:00', NULL, 'scheduled'), (11, 1, 2, '2026-11-01', '01:30', NULL, 'scheduled'), (12, 4, 2, '2026-12-01', '10:00', NULL, 'scheduled'), (13, 5, NULL, '2026-12-02', '11:00', NULL, 'scheduled')`,
		`CREATE TEMP TABLE appointment_changes (id INTEGER PRIMARY KEY, appointment_id INTEGER, new_date TEXT, new_time TEXT, starts_at TIMESTAMPTZ, status TEXT)`,
		`CREATE TEMP TABLE nutritionist_availability (nutritionist_id INTEGER, day_of_week INTEGER, start_time TEXT, end_time TEXT, is_available BOOLEAN)`,
		`CREATE TEMP TABLE nutritionist_schedule_settings (nutritionist_id INTEGER PRIMARY KEY, time_zone TEXT NOT NULL)`,
		`CREATE TEMP TABLE nutritionist_schedule_exceptions (nutritionist_id INTEGER, exception_date DATE, intervals JSONB, PRIMARY KEY (nutritionist_id, exception_date))`,
		`CREATE TEMP TABLE notifications (user_id INTEGER, type TEXT, title TEXT, message TEXT, related_id INTEGER, created_at TEXT)`,
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
		c.Set("claims", &Claims{UserID: 2, Role: "nutritionist"})
		c.Next()
	})
	router.GET("/schedule", getNutritionistScheduleHandler)
	router.GET("/schedule/legacy-times", getLegacySchedulePreviewHandler)
	router.PUT("/schedule", setNutritionistScheduleHandler)
	request := func(method, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "/schedule", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}
	withoutConfirmation := `{"time_zone":"America/New_York","weekly":[],"exceptions":[]}`
	if res := request(http.MethodPut, withoutConfirmation); res.Code != http.StatusConflict {
		t.Fatalf("missing legacy confirmation: %d %s", res.Code, res.Body.String())
	}
	previewRequest := httptest.NewRequest(http.MethodGet, "/schedule/legacy-times?time_zone=America%2FNew_York", nil)
	previewResponse := httptest.NewRecorder()
	router.ServeHTTP(previewResponse, previewRequest)
	if previewResponse.Code != http.StatusOK || !bytes.Contains(previewResponse.Body.Bytes(), []byte(`"status":"ambiguous"`)) {
		t.Fatalf("legacy preview did not identify repeated time: %d %s", previewResponse.Code, previewResponse.Body.String())
	}
	if bytes.Contains(previewResponse.Body.Bytes(), []byte(`"id":12`)) || bytes.Contains(previewResponse.Body.Bytes(), []byte(`"id":13`)) {
		t.Fatalf("preview exposed a reassigned or unassigned patient's appointment: %s", previewResponse.Body.String())
	}
	first := `{"time_zone":"America/New_York","legacy_time_zone":"America/New_York","legacy_instants":{"appointment:11":"2026-11-01T06:30:00Z"},"weekly":[{"day_of_week":0,"start_time":"09:00","end_time":"10:00"}],"exceptions":[{"date":"2026-11-30","intervals":[]}]}`
	if res := request(http.MethodPut, first); res.Code != http.StatusOK {
		t.Fatalf("initial schedule: %d %s", res.Code, res.Body.String())
	}
	var instant time.Time
	var date, clock string
	if err := testDB.QueryRow(`SELECT starts_at, appointment_date, appointment_time FROM appointments WHERE id = 10`).Scan(&instant, &date, &clock); err != nil {
		t.Fatal(err)
	}
	if instant.UTC().Format(time.RFC3339) != "2026-11-30T14:00:00Z" || date != "2026-11-30" || clock != "09:00" {
		t.Fatalf("unexpected conversion: %v %s %s", instant, date, clock)
	}
	var ambiguousInstant time.Time
	if err := testDB.QueryRow(`SELECT starts_at FROM appointments WHERE id = 11`).Scan(&ambiguousInstant); err != nil {
		t.Fatal(err)
	}
	if ambiguousInstant.UTC().Format(time.RFC3339) != "2026-11-01T06:30:00Z" {
		t.Fatalf("ambiguous occurrence not preserved: %v", ambiguousInstant)
	}
	var excluded sql.NullTime
	if err := testDB.QueryRow(`SELECT starts_at FROM appointments WHERE id = 12`).Scan(&excluded); err != nil {
		t.Fatal(err)
	}
	if excluded.Valid {
		t.Fatalf("reassigned patient's appointment was modified: %v", excluded.Time)
	}
	if res := request(http.MethodGet, ""); res.Code != http.StatusOK || !bytes.Contains(res.Body.Bytes(), []byte(`"day_of_week":0`)) || !bytes.Contains(res.Body.Bytes(), []byte(`"start_time":"09:00"`)) {
		t.Fatalf("schedule read: %d %s", res.Code, res.Body.String())
	}
	next := `{"time_zone":"Europe/London","weekly":[],"exceptions":[{"date":"2026-11-30","intervals":[]}]}`
	if res := request(http.MethodPut, next); res.Code != http.StatusOK {
		t.Fatalf("change zone: %d %s", res.Code, res.Body.String())
	}
	var after time.Time
	if err := testDB.QueryRow(`SELECT starts_at, appointment_date, appointment_time FROM appointments WHERE id = 10`).Scan(&after, &date, &clock); err != nil {
		t.Fatal(err)
	}
	if !instant.Equal(after) || date != "2026-11-30" || clock != "14:00" {
		t.Fatalf("zone change moved instant: %v -> %v, %s %s", instant, after, date, clock)
	}
}
