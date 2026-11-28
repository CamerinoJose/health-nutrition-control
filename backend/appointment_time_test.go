package main

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestConvertLegacyScheduleTimeRequiresExplicitAmbiguousChoice(t *testing.T) {
	location, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	item := legacyScheduleTime{ID: 7, Date: sql.NullString{String: "2026-11-01", Valid: true}, Time: sql.NullString{String: "01:30", Valid: true}}
	if _, err := convertLegacyScheduleTime(item, "appointment", location, nil); err == nil {
		t.Fatal("ambiguous legacy time should require an explicit choice")
	}
	choice := map[string]string{"appointment:7": "2026-11-01T06:30:00Z"}
	instant, err := convertLegacyScheduleTime(item, "appointment", location, choice)
	if err != nil || instant.UTC().Format(time.RFC3339) != choice["appointment:7"] {
		t.Fatalf("selected ambiguous occurrence not preserved: %v, %v", instant, err)
	}
}

func TestConvertLegacyScheduleTimeAcceptsConfirmedInstantForNonexistentWallTime(t *testing.T) {
	location, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	item := legacyScheduleTime{ID: 8, Date: sql.NullString{String: "2026-03-08", Valid: true}, Time: sql.NullString{String: "02:30", Valid: true}}
	choice := map[string]string{"appointment:8": "2026-03-08T07:30:00Z"}
	instant, err := convertLegacyScheduleTime(item, "appointment", location, choice)
	if err != nil || instant.UTC().Format(time.RFC3339) != choice["appointment:8"] {
		t.Fatalf("confirmed corrected instant not preserved: %v, %v", instant, err)
	}
}

func TestAppointmentInstantsAcrossTimeZones(t *testing.T) {
	tests := []struct {
		name, zone, date, clock string
		want                    []string
	}{
		{"Mexico City", "America/Mexico_City", "2026-03-08", "09:00", []string{"2026-03-08T15:00:00Z"}},
		{"New York skipped time", "America/New_York", "2026-03-08", "02:30", nil},
		{"New York repeated time", "America/New_York", "2026-11-01", "01:30", []string{"2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"}},
		{"Lord Howe repeated half hour", "Australia/Lord_Howe", "2026-04-05", "01:45", []string{"2026-04-04T14:45:00Z", "2026-04-04T15:15:00Z"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			location, err := time.LoadLocation(tt.zone)
			if err != nil {
				t.Fatal(err)
			}
			got, err := appointmentInstants(tt.date, tt.clock, location)
			if err != nil {
				t.Fatal(err)
			}
			if len(got) != len(tt.want) {
				t.Fatalf("got %d instants, want %d", len(got), len(tt.want))
			}
			for i, want := range tt.want {
				if got[i].Format(time.RFC3339) != want {
					t.Errorf("instant %d = %s, want %s", i, got[i].Format(time.RFC3339), want)
				}
			}
		})
	}
}

func TestAppointmentHandlersRejectInvalidDateAndTime(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("claims", &Claims{UserID: 1, Role: "user"})
		c.Next()
	})
	router.POST("/appointments", createAppointmentHandler)
	router.PUT("/appointments/:id", updateAppointmentHandler)
	router.POST("/appointments/:id/propose", proposeAppointmentChangeHandler)
	for _, tt := range []struct {
		method, path, body string
	}{
		{http.MethodPost, "/appointments", `{"title":"Test","appointment_date":"2026-02-30","appointment_time":"09:00"}`},
		{http.MethodPut, "/appointments/1", `{"appointment_date":"2026-01-01","appointment_time":"24:00"}`},
		{http.MethodPost, "/appointments/1/propose", `{"new_date":"2026-01-01","new_time":"9:00"}`},
	} {
		req := httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != http.StatusBadRequest {
			t.Errorf("%s %s returned %d, want 400", tt.method, tt.path, res.Code)
		}
	}
}

func TestAppointmentInstantsRejectInvalidInputs(t *testing.T) {
	for _, tt := range []struct {
		date, clock string
		location    *time.Location
	}{
		{"2026-02-30", "09:00", time.UTC},
		{"2026-01-01", "9:00", time.UTC},
		{"2026-01-01", "09:00", nil},
	} {
		if _, err := appointmentInstants(tt.date, tt.clock, tt.location); err == nil {
			t.Errorf("accepted invalid date=%q time=%q location=%v", tt.date, tt.clock, tt.location)
		}
	}
}
