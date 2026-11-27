package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestAgeFromBirthDate(t *testing.T) {
	tests := []struct {
		name, birth, today string
		want               int
		invalid            bool
	}{
		{"before birthday", "1985-06-15", "2026-06-14", 40, false},
		{"on birthday", "1985-06-15", "2026-06-15", 41, false},
		{"leap day before anniversary", "2000-02-29", "2025-02-28", 24, false},
		{"leap day anniversary", "2000-02-29", "2025-03-01", 25, false},
		{"invalid date", "2001-02-29", "2026-06-15", 0, true},
		{"future date", "2026-06-16", "2026-06-15", 0, true},
		{"year zero", "0000-01-01", "2026-06-15", 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			today, err := time.Parse("2006-01-02", tt.today)
			if err != nil {
				t.Fatal(err)
			}
			got, err := ageFromBirthDate(tt.birth, today)
			if (err != nil) != tt.invalid || (!tt.invalid && got != tt.want) {
				t.Fatalf("ageFromBirthDate(%q) = %d, %v; want %d, invalid=%v", tt.birth, got, err, tt.want, tt.invalid)
			}
		})
	}
}

func TestBirthDateMigrationPostgres(t *testing.T) {
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
		`CREATE TEMP TABLE health_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, age INTEGER)`,
		`INSERT INTO health_profiles VALUES (1, 1, 41)`,
		`SET search_path TO pg_temp`,
	} {
		if _, err := testDB.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	var temporarySchema bool
	if err := testDB.QueryRow(`SELECT current_schema() LIKE 'pg_temp_%'`).Scan(&temporarySchema); err != nil || !temporarySchema {
		t.Fatalf("refusing to migrate outside a temporary schema: %v", err)
	}
	previousDB := db
	db = testDB
	t.Cleanup(func() { db = previousDB })
	for i := 0; i < 2; i++ {
		if err := migrate(); err != nil {
			t.Fatalf("migration %d: %v", i+1, err)
		}
	}
	var age int
	var birthDate sql.NullString
	if err := testDB.QueryRow(`SELECT age, birth_date FROM health_profiles WHERE id = 1`).Scan(&age, &birthDate); err != nil || age != 41 || birthDate.Valid {
		t.Fatalf("migration did not preserve legacy profile: age=%d birthDateValid=%v err=%v", age, birthDate.Valid, err)
	}
}

func TestHealthProfileBirthDatePostgres(t *testing.T) {
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
	_, err = testDB.Exec(`CREATE TEMP TABLE health_profiles (
		id SERIAL PRIMARY KEY, user_id INTEGER UNIQUE, age INTEGER, birth_date TEXT,
		sex TEXT, height DOUBLE PRECISION, current_weight DOUBLE PRECISION, goal_weight DOUBLE PRECISION,
		waist_circumference DOUBLE PRECISION, medical_conditions TEXT, medications TEXT, allergies TEXT,
		glucose_fasting DOUBLE PRECISION, hba1c DOUBLE PRECISION, cholesterol_total DOUBLE PRECISION,
		cholesterol_ldl DOUBLE PRECISION, cholesterol_hdl DOUBLE PRECISION, triglycerides DOUBLE PRECISION,
		activity_level TEXT, meal_schedule TEXT, sleep_hours DOUBLE PRECISION, goals TEXT, updated_at TEXT
	)`)
	if err != nil {
		t.Fatal(err)
	}
	for _, statement := range []string{
		`CREATE TEMP TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, role TEXT, nutritionist_id INTEGER)`,
		`INSERT INTO users VALUES (1, 'Test', 'test@example.test', 'user', 2), (2, 'Professional', 'professional@example.test', 'nutritionist', NULL)`,
		`CREATE TEMP TABLE histories (user_id INTEGER, date TEXT, weight DOUBLE PRECISION, fat_percentage DOUBLE PRECISION, muscle_percentage DOUBLE PRECISION)`,
		`CREATE TEMP TABLE appointments (user_id INTEGER)`,
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
		if c.Request.URL.Path == "/patient/1" {
			c.Set("claims", &Claims{UserID: 2, Role: "nutritionist"})
		} else {
			c.Set("claims", &Claims{UserID: 1, Role: "user"})
		}
		c.Next()
	})
	router.POST("/profile", createHealthProfileHandler)
	router.PUT("/profile", updateHealthProfileHandler)
	router.GET("/profile", getHealthProfileHandler)
	router.GET("/patient/:id", getPatientDetailsHandler)
	request := func(method, body string) *httptest.ResponseRecorder {
		response := httptest.NewRecorder()
		req := httptest.NewRequest(method, "/profile", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(response, req)
		return response
	}

	response := request(http.MethodPost, `{"age":41}`)
	if response.Code != http.StatusOK {
		t.Fatalf("create: %d %s", response.Code, response.Body.String())
	}
	response = request(http.MethodGet, "")
	var legacy HealthProfile
	if err := json.Unmarshal(response.Body.Bytes(), &legacy); err != nil || legacy.Age != 41 || legacy.BirthDate != nil {
		t.Fatalf("legacy profile not preserved: status=%d body=%s err=%v", response.Code, response.Body.String(), err)
	}
	response = request(http.MethodPut, `{"birth_date":"1985-06-15","age":99}`)
	if response.Code != http.StatusOK {
		t.Fatalf("update birth date: %d %s", response.Code, response.Body.String())
	}
	response = request(http.MethodPut, `{"age":12}`)
	if response.Code != http.StatusOK {
		t.Fatalf("legacy update: %d %s", response.Code, response.Body.String())
	}
	response = request(http.MethodGet, "")
	var profile HealthProfile
	if err := json.Unmarshal(response.Body.Bytes(), &profile); err != nil {
		t.Fatal(err)
	}
	wantAge, err := ageFromBirthDate("1985-06-15", time.Now())
	if err != nil || response.Code != http.StatusOK || profile.BirthDate == nil || *profile.BirthDate != "1985-06-15" || profile.Age != wantAge {
		t.Fatalf("legacy update lost birth date or calculated age: status=%d body=%s", response.Code, response.Body.String())
	}
	patientResponse := httptest.NewRecorder()
	router.ServeHTTP(patientResponse, httptest.NewRequest(http.MethodGet, "/patient/1", nil))
	var patient struct {
		HealthProfile struct {
			Age       int    `json:"age"`
			BirthDate string `json:"birth_date"`
		} `json:"health_profile"`
	}
	if err := json.Unmarshal(patientResponse.Body.Bytes(), &patient); err != nil || patientResponse.Code != http.StatusOK || patient.HealthProfile.Age != wantAge || patient.HealthProfile.BirthDate != "1985-06-15" {
		t.Fatalf("patient profile age: status=%d body=%s err=%v", patientResponse.Code, patientResponse.Body.String(), err)
	}
	response = request(http.MethodPut, `{"birth_date":"2100-01-01"}`)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("future birth date: got %d", response.Code)
	}
	if _, err := testDB.Exec(`DELETE FROM health_profiles WHERE user_id = 1`); err != nil {
		t.Fatal(err)
	}
	response = request(http.MethodPost, `{"birth_date":"1985-06-15","age":99}`)
	if response.Code != http.StatusOK {
		t.Fatalf("create with birth date: %d %s", response.Code, response.Body.String())
	}
	response = request(http.MethodGet, "")
	if err := json.Unmarshal(response.Body.Bytes(), &profile); err != nil || profile.BirthDate == nil || *profile.BirthDate != "1985-06-15" || profile.Age != wantAge {
		t.Fatalf("created profile age: status=%d body=%s err=%v", response.Code, response.Body.String(), err)
	}
}
