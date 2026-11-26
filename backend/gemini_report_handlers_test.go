package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

func TestCreateGeminiReportRejectsInvalidPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/reports", func(c *gin.Context) {
		c.Set("claims", &Claims{UserID: 1})
		createGeminiReportHandler(c)
	})

	for _, body := range []string{
		`{"responseText":"Respuesta","reason":"unknown"}`,
		`{"responseText":"   ","reason":"other"}`,
		`{"responseText":"` + strings.Repeat("x", maxGeminiReportRunes+1) + `","reason":"other"}`,
		`not-json`,
	} {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/reports", strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(response, request)
		if response.Code != http.StatusBadRequest {
			t.Errorf("body %q: expected status %d, got %d", body[:min(len(body), 40)], http.StatusBadRequest, response.Code)
		}
	}
}

func TestGeminiReportAdminQueueRejectsNonAdmins(t *testing.T) {
	previousDB, previousJWTKey := db, jwtKey
	db = nil
	jwtKey = []byte("gemini-report-test-jwt-secret")
	t.Cleanup(func() {
		db, jwtKey = previousDB, previousJWTKey
	})
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &Claims{UserID: 1, Role: "user"}).SignedString(jwtKey)
	if err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/admin/reports", authMiddleware(), adminMiddleware(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/admin/reports", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected non-admin to receive %d, got %d", http.StatusForbidden, response.Code)
	}
}

func TestGeminiReportsPersistOnlySelectedResponseAndExpire(t *testing.T) {
	testDB := openTemporaryPostgres(t)
	for _, statement := range []string{
		`CREATE TEMP TABLE users (id INTEGER PRIMARY KEY)`,
		`CREATE TEMP TABLE gemini_reports (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id),
			response_text TEXT NOT NULL,
			reason TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`INSERT INTO users (id) VALUES (7)`,
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
	router.POST("/reports", func(c *gin.Context) {
		c.Set("claims", &Claims{UserID: 7})
		createGeminiReportHandler(c)
	})
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/reports", strings.NewReader(
		`{"responseText":"Respuesta seleccionada","reason":"privacy","prompt":"no guardar esta pregunta"}`,
	))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("expected report creation status %d, got %d: %s", http.StatusCreated, response.Code, response.Body.String())
	}
	var result struct {
		ID     int    `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.ID == 0 || result.Status != "pending" {
		t.Fatalf("unexpected report result: %+v", result)
	}

	var responseText, reason string
	if err := testDB.QueryRow(`SELECT response_text, reason FROM gemini_reports WHERE id = $1`, result.ID).Scan(&responseText, &reason); err != nil {
		t.Fatal(err)
	}
	if responseText != "Respuesta seleccionada" || reason != "privacy" {
		t.Fatalf("stored report was unexpected: %q, %q", responseText, reason)
	}

	if _, err := testDB.Exec(`INSERT INTO gemini_reports (user_id, response_text, reason, created_at) VALUES
		(7, 'Expired report', 'other', $1),
		(7, 'Recent report', 'other', CURRENT_TIMESTAMP)`, time.Now().Add(-geminiReportRetention-time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := cleanupExpiredGeminiReports(); err != nil {
		t.Fatal(err)
	}
	var expired, recent int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM gemini_reports WHERE response_text = 'Expired report'`).Scan(&expired); err != nil {
		t.Fatal(err)
	}
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM gemini_reports WHERE response_text = 'Recent report'`).Scan(&recent); err != nil {
		t.Fatal(err)
	}
	if expired != 0 || recent != 1 {
		t.Fatalf("retention cleanup left expired=%d recent=%d reports", expired, recent)
	}
}

func openTemporaryPostgres(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("MEDICINES_TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("MEDICINES_TEST_POSTGRES_DSN is not set")
	}
	testDB, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	testDB.SetMaxOpenConns(1)
	if err := testDB.Ping(); err != nil {
		_ = testDB.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = testDB.Close() })
	return testDB
}
