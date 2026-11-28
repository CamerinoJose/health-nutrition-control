package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAvailableSlotsAreScopedToProfessional(t *testing.T) {
	testDB := openTemporaryPostgres(t)
	for _, statement := range []string{
		`CREATE TEMP TABLE users (id INTEGER PRIMARY KEY, nutritionist_id INTEGER)`,
		`INSERT INTO users VALUES (1, 2), (3, 4)`,
		`CREATE TEMP TABLE nutritionist_availability (nutritionist_id INTEGER, day_of_week INTEGER, start_time TEXT, end_time TEXT, is_available BOOLEAN)`,
		`INSERT INTO nutritionist_availability VALUES
			(2, 1, '09:00', '11:00', TRUE), (4, 1, '09:00', '11:00', TRUE)`,
		`CREATE TEMP TABLE nutritionist_schedule_settings (nutritionist_id INTEGER, time_zone TEXT)`,
		`INSERT INTO nutritionist_schedule_settings VALUES (2, 'UTC'), (4, 'UTC')`,
		`CREATE TEMP TABLE nutritionist_schedule_exceptions (nutritionist_id INTEGER, exception_date DATE, intervals JSONB)`,
		`CREATE TEMP TABLE appointments (id SERIAL PRIMARY KEY, nutritionist_id INTEGER, appointment_date TEXT, appointment_time TEXT, starts_at TIMESTAMPTZ, status TEXT, is_archived BOOLEAN)`,
		`INSERT INTO appointments (nutritionist_id, appointment_date, appointment_time, starts_at, status, is_archived) VALUES
			(2, '2026-11-30', '09:15', '2026-11-30 09:15+00', 'scheduled', FALSE),
			(2, '2026-11-30', '10:00', '2026-11-30 10:00+00', 'scheduled', TRUE),
			(2, '2026-11-30', '10:30', '2026-11-30 10:30+00', 'cancelled', FALSE),
			(4, '2026-11-30', '10:30', '2026-11-30 10:30+00', 'scheduled', FALSE)`,
	} {
		if _, err := testDB.Exec(statement); err != nil {
			t.Fatal(err)
		}

	}
	previousDB := db
	db = testDB
	t.Cleanup(func() { db = previousDB })

	want := []appointmentSlot{
		{"09:00", "09:30", false, "2026-11-30T09:00:00Z", "UTC", "+00:00"},
		{"09:30", "10:00", false, "2026-11-30T09:30:00Z", "UTC", "+00:00"},
		{"10:00", "10:30", false, "2026-11-30T10:00:00Z", "UTC", "+00:00"},
		{"10:30", "11:00", true, "2026-11-30T10:30:00Z", "UTC", "+00:00"},
	}
	slots, err := availableAppointmentSlots(context.Background(), testDB, 2, "2026-11-30", 0)
	if err != nil || !reflect.DeepEqual(slots, want) {
		t.Fatalf("slots=%v, error=%v, want %v", slots, err, want)
	}

	gin.SetMode(gin.TestMode)
	var claims Claims
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("claims", &claims); c.Next() })
	router.GET("/patient", getAvailableSlotsForUserHandler)
	router.GET("/professional", getAvailableSlotsHandler)
	for _, tt := range []struct {
		path   string
		claims Claims
	}{
		{"/patient?date=2026-11-30", Claims{UserID: 1, Role: "user"}},
		{"/professional?date=2026-11-30", Claims{UserID: 2, Role: "nutritionist"}},
	} {
		claims = tt.claims
		res := httptest.NewRecorder()
		router.ServeHTTP(res, httptest.NewRequest(http.MethodGet, tt.path, nil))
		var actual []appointmentSlot
		if err := json.Unmarshal(res.Body.Bytes(), &actual); err != nil || res.Code != http.StatusOK || !reflect.DeepEqual(actual, want) {
			t.Errorf("%s returned %d %s; error=%v", tt.path, res.Code, res.Body.String(), err)
		}
	}
}

func TestSlotsAcrossRepeatedAndMissingLocalTimes(t *testing.T) {
	testDB := openTemporaryPostgres(t)
	for _, statement := range []string{
		`CREATE TEMP TABLE nutritionist_availability (nutritionist_id INTEGER, day_of_week INTEGER, start_time TEXT, end_time TEXT, is_available BOOLEAN)`,
		`INSERT INTO nutritionist_availability VALUES (2, 0, '01:00', '02:00', TRUE)`,
		`CREATE TEMP TABLE nutritionist_schedule_settings (nutritionist_id INTEGER, time_zone TEXT)`,
		`INSERT INTO nutritionist_schedule_settings VALUES (2, 'America/New_York')`,
		`CREATE TEMP TABLE nutritionist_schedule_exceptions (nutritionist_id INTEGER, exception_date DATE, intervals JSONB)`,
		`CREATE TEMP TABLE appointments (id SERIAL PRIMARY KEY, nutritionist_id INTEGER, starts_at TIMESTAMPTZ, status TEXT)`,
		`INSERT INTO appointments (nutritionist_id, starts_at, status) VALUES (2, '2026-11-01 05:30+00', 'scheduled')`,
	} {
		if _, err := testDB.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	got, err := availableAppointmentSlots(context.Background(), testDB, 2, "2026-11-01", 0)
	if err != nil {
		t.Fatal(err)
	}
	want := []appointmentSlot{
		{"01:00", "01:30", true, "2026-11-01T05:00:00Z", "America/New_York", "-04:00"},
		{"01:30", "01:00", false, "2026-11-01T05:30:00Z", "America/New_York", "-04:00"},
		{"01:00", "01:30", true, "2026-11-01T06:00:00Z", "America/New_York", "-05:00"},
		{"01:30", "02:00", true, "2026-11-01T06:30:00Z", "America/New_York", "-05:00"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("repeated-hour slots = %v, want %v", got, want)
	}
	tx, err := testDB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := lockAndCheckAppointmentSlot(context.Background(), tx, 2, "2026-11-01", "01:30", "", 0); !errors.Is(err, errAmbiguousAppointment) {
		_ = tx.Rollback()
		t.Fatalf("ambiguous time without instant: %v", err)
	}
	instant, available, err := lockAndCheckAppointmentSlot(context.Background(), tx, 2, "2026-11-01", "01:30", "2026-11-01T06:30:00Z", 0)
	if err != nil || !available || instant.Format("2006-01-02T15:04:05Z") != "2026-11-01T06:30:00Z" {
		_ = tx.Rollback()
		t.Fatalf("second occurrence: %v, %v, %v", instant, available, err)
	}
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}
	if _, err := testDB.Exec(`INSERT INTO nutritionist_schedule_exceptions VALUES (2, '2026-03-08', '[{"start_time":"02:00","end_time":"03:00"}]')`); err != nil {
		t.Fatal(err)
	}
	got, err = availableAppointmentSlots(context.Background(), testDB, 2, "2026-03-08", 0)
	if err != nil || len(got) != 0 {
		t.Fatalf("nonexistent-hour slots = %v, error %v", got, err)
	}
}

func TestAvailableSlotsIncludePreviousDayOverlap(t *testing.T) {
	testDB := openTemporaryPostgres(t)
	for _, statement := range []string{
		`CREATE TEMP TABLE nutritionist_availability (nutritionist_id INTEGER, day_of_week INTEGER, start_time TEXT, end_time TEXT, is_available BOOLEAN)`,
		`INSERT INTO nutritionist_availability VALUES (2, 1, '00:00', '01:00', TRUE)`,
		`CREATE TEMP TABLE nutritionist_schedule_settings (nutritionist_id INTEGER, time_zone TEXT)`,
		`INSERT INTO nutritionist_schedule_settings VALUES (2, 'UTC')`,
		`CREATE TEMP TABLE nutritionist_schedule_exceptions (nutritionist_id INTEGER, exception_date DATE, intervals JSONB)`,
		`CREATE TEMP TABLE appointments (id SERIAL PRIMARY KEY, nutritionist_id INTEGER, appointment_date TEXT, appointment_time TEXT, starts_at TIMESTAMPTZ, status TEXT)`,
		`INSERT INTO appointments (nutritionist_id, appointment_date, appointment_time, starts_at, status) VALUES (2, '2026-11-29', '23:45', '2026-11-29 23:45+00', 'scheduled')`,
	} {
		if _, err := testDB.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	got, err := availableAppointmentSlots(context.Background(), testDB, 2, "2026-11-30", 0)
	want := []appointmentSlot{
		{"00:00", "00:30", false, "2026-11-30T00:00:00Z", "UTC", "+00:00"},
		{"00:30", "01:00", true, "2026-11-30T00:30:00Z", "UTC", "+00:00"},
	}
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("slots=%v, error=%v, want %v", got, err, want)
	}
}
