package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

func TestGetJWTKeyRequiresStrongConfiguredSecret(t *testing.T) {
	for _, test := range []struct {
		name   string
		secret string
	}{
		{name: "missing"},
		{name: "whitespace", secret: " \t "},
		{name: "too short", secret: "short"},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("JWT_SECRET", test.secret)
			if _, err := getJWTKey(); err == nil {
				t.Fatal("expected invalid JWT_SECRET to be rejected")
			}
		})
	}

	t.Run("valid", func(t *testing.T) {
		const secret = "0123456789abcdef0123456789abcdef"
		t.Setenv("JWT_SECRET", secret)
		key, err := getJWTKey()
		if err != nil {
			t.Fatalf("getJWTKey returned error: %v", err)
		}
		if string(key) != secret {
			t.Fatal("getJWTKey returned a different secret")
		}
	})
}

func TestAuthMiddlewareRejectsDeletedAccountToken(t *testing.T) {
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
	if _, err := testDB.Exec(`CREATE TEMP TABLE users (id INTEGER PRIMARY KEY, role TEXT, is_disabled BOOLEAN NOT NULL DEFAULT FALSE)`); err != nil {
		_ = testDB.Close()
		t.Fatal(err)
	}

	previousDB, previousJWTKey := db, jwtKey
	db, jwtKey = testDB, []byte("deleted-account-test-jwt-secret")
	t.Cleanup(func() {
		db, jwtKey = previousDB, previousJWTKey
		_ = testDB.Close()
	})
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &Claims{UserID: 1}).SignedString(jwtKey)
	if err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/protected", authMiddleware(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected deleted account token to receive %d, got %d", http.StatusUnauthorized, response.Code)
	}
}

func TestOAuthLogsExcludeCredentialsAndLastTokenRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var requestLogs, oauthLogs bytes.Buffer
	previousLogOutput := log.Writer()
	log.SetOutput(&oauthLogs)
	t.Cleanup(func() { log.SetOutput(previousLogOutput) })

	router := gin.New()
	router.Use(gin.LoggerWithConfig(gin.LoggerConfig{Output: &requestLogs, Formatter: safeRequestLogFormatter}))
	registerOAuthRoutes(router.Group("/api"))

	for _, path := range []string{
		"/api/auth/google/callback?code=secret-code&state=secret-state",
		"/api/auth/google/success?token=secret-token",
		"/api/auth/last-token",
	} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if strings.HasSuffix(path, "last-token") && response.Code != http.StatusNotFound {
			t.Fatalf("last-token endpoint returned %d, want 404", response.Code)
		}
	}
	logs := requestLogs.String() + oauthLogs.String()
	for _, secret := range []string{"secret-code", "secret-state", "secret-token"} {
		if strings.Contains(logs, secret) {
			t.Fatalf("logs exposed %s", secret)
		}
	}
	if !strings.Contains(requestLogs.String(), "/api/auth/google/callback") {
		t.Fatal("request log omitted the callback path")
	}
}

func TestPostgresMealPlanReturningIDAssociatesMeals(t *testing.T) {
	dsn := os.Getenv("MEDICINES_TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("MEDICINES_TEST_POSTGRES_DSN is not set")
	}
	testDB, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = testDB.Close() })

	if err := testDB.Ping(); err != nil {
		t.Fatal(err)
	}

	if _, err := testDB.Exec(`CREATE TEMP TABLE meal_plans (
		id SERIAL PRIMARY KEY,
		user_id INTEGER,
		name TEXT,
		start_date TEXT,
		snacks TEXT,
		created_at TEXT
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := testDB.Exec(`CREATE TEMP TABLE plan_meals (
		id SERIAL PRIMARY KEY,
		plan_id INTEGER,
		day_of_week TEXT,
		meal_type TEXT,
		name TEXT,
		ingredients TEXT,
		preparation TEXT
	)`); err != nil {
		t.Fatal(err)
	}

	var planID int
	err = testDB.QueryRow(`
		INSERT INTO meal_plans (user_id, name, start_date, snacks, created_at)
		VALUES ($1, $2, $3, $4, $5) RETURNING id
	`, 42, "Test plan", "2026-11-25", "Test snack", "2026-11-25").Scan(&planID)
	if err != nil {
		t.Fatalf("PostgreSQL RETURNING id failed: %v", err)
	}
	if planID <= 0 {
		t.Fatalf("expected positive plan id, got %d", planID)
	}

	if _, err := testDB.Exec(`
		INSERT INTO plan_meals (plan_id, day_of_week, meal_type, name, ingredients, preparation)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, planID, "Lunes", "Desayuno", "Avena", "Avena", "Preparar"); err != nil {
		t.Fatal(err)
	}

	var count int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM plan_meals WHERE plan_id = $1`, planID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected meal associated with plan id %d, got %d", planID, count)
	}
}

func TestMedicineCreationAndListWithBooleanTaken(t *testing.T) {
	dsn := os.Getenv("MEDICINES_TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("MEDICINES_TEST_POSTGRES_DSN is not set")
	}
	runMedicineEndpointTest(t, "postgres", dsn, false)
}

func runMedicineEndpointTest(t *testing.T, driver, dsn string, sqlite bool) {
	t.Helper()

	testDB, err := sql.Open(driver, dsn)
	if err != nil {
		t.Fatal("could not open test database")
	}
	testDB.SetMaxOpenConns(1)
	if err := testDB.Ping(); err != nil {
		_ = testDB.Close()
		t.Fatal("could not connect to test database")
	}

	previousDB, previousJWTKey := db, jwtKey
	db, jwtKey = testDB, []byte("medicine-test-secret")
	t.Cleanup(func() {
		_ = testDB.Close()
		db, jwtKey = previousDB, previousJWTKey
	})

	idDefinition := "SERIAL PRIMARY KEY"
	if sqlite {
		idDefinition = "INTEGER PRIMARY KEY AUTOINCREMENT"
	}
	if _, err := testDB.Exec("CREATE TEMP TABLE users (id INTEGER PRIMARY KEY, role TEXT, is_disabled BOOLEAN NOT NULL DEFAULT FALSE)"); err != nil {
		t.Fatalf("could not create temporary users table: %v", err)
	}
	if _, err := testDB.Exec("INSERT INTO users (id, role) VALUES (42, 'user')"); err != nil {
		t.Fatalf("could not create test user: %v", err)
	}
	if _, err := testDB.Exec("CREATE TEMP TABLE medicines (id " + idDefinition + ", user_id INTEGER, name TEXT, time TEXT, taken BOOLEAN DEFAULT FALSE)"); err != nil {
		t.Fatalf("could not create temporary medicines table: %v", err)
	}
	if _, err := testDB.Exec("CREATE TEMP TABLE medicine_logs (id " + idDefinition + ", user_id INTEGER NOT NULL, medicine_id INTEGER NOT NULL, taken_date TEXT NOT NULL, taken_at TEXT NOT NULL)"); err != nil {
		t.Fatalf("could not create temporary medicine logs table: %v", err)
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &Claims{UserID: 42, Role: "user"}).SignedString(jwtKey)
	if err != nil {
		t.Fatal("could not sign test token")
	}

	router := gin.New()
	api := router.Group("/api")
	api.Use(authMiddleware())
	api.POST("/medicines", createMedicineHandler)
	api.GET("/medicines", listMedicinesHandler)
	api.PUT("/medicines/:id", updateMedicineHandler)

	request := httptest.NewRequest(http.MethodPost, "/api/medicines", strings.NewReader(`{"name":"Breakfast medicine","time":"07:30"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("create medicine returned status %d", response.Code)
	}
	var taken bool
	if err := queryRowDB("SELECT taken FROM medicines WHERE user_id = ?", 42).Scan(&taken); err != nil {
		t.Fatal("could not read stored medicine taken value")
	}
	if taken {
		t.Fatal("new medicine should be stored with taken=false")
	}

	request = httptest.NewRequest(http.MethodGet, "/api/medicines", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("list medicines returned status %d", response.Code)
	}

	var medicinesList []Medicine
	if err := json.Unmarshal(response.Body.Bytes(), &medicinesList); err != nil {
		t.Fatalf("could not decode medicines response: %v", err)
	}
	if len(medicinesList) != 1 || medicinesList[0].Name != "Breakfast medicine" || medicinesList[0].Time != "07:30" || medicinesList[0].Taken {
		t.Fatalf("unexpected medicines response: %+v", medicinesList)
	}
	medicineID := medicinesList[0].ID
	update := func(id int, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPut, "/api/medicines/"+strconv.Itoa(id), strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}
	for i := 0; i < 2; i++ {
		response = update(medicineID, `{"name":"Breakfast medicine","time":"07:30","taken":true}`)
		if response.Code != http.StatusOK {
			t.Fatalf("confirm medicine returned %d: %s", response.Code, response.Body.String())
		}
	}
	var logCount int
	if err := queryRowDB("SELECT COUNT(*) FROM medicine_logs WHERE user_id = ? AND medicine_id = ?", 42, medicineID).Scan(&logCount); err != nil || logCount != 1 {
		t.Fatalf("repeated confirmation did not preserve a single log: count=%d err=%v", logCount, err)
	}
	if _, err := testDB.Exec("INSERT INTO medicines (id, user_id, name, time) VALUES (100, 43, 'Other', '08:00')"); err != nil {
		t.Fatal(err)
	}
	response = update(100, `{"name":"Other","time":"08:00","taken":true}`)
	if response.Code != http.StatusNotFound {
		t.Fatalf("other user's medicine returned %d", response.Code)
	}
	if err := queryRowDB("SELECT COUNT(*) FROM medicine_logs WHERE medicine_id = ?", 100).Scan(&logCount); err != nil || logCount != 0 {
		t.Fatalf("created a log for another account: count=%d err=%v", logCount, err)
	}
	if _, err := testDB.Exec("ALTER TABLE medicine_logs ADD CONSTRAINT reject_new_log CHECK (taken_at = 'not-a-time') NOT VALID"); err != nil {
		t.Fatal(err)
	}
	response = update(medicineID, `{"name":"Changed","time":"09:00","taken":true}`)
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("failed log insert returned %d", response.Code)
	}
	var name string
	if err := queryRowDB("SELECT name FROM medicines WHERE id = ?", medicineID).Scan(&name); err != nil || name != "Breakfast medicine" {
		t.Fatalf("failed confirmation changed medicine: name=%q err=%v", name, err)
	}
	if err := queryRowDB("SELECT COUNT(*) FROM medicine_logs WHERE medicine_id = ?", medicineID).Scan(&logCount); err != nil || logCount != 1 {
		t.Fatalf("failed confirmation lost prior log: count=%d err=%v", logCount, err)
	}
}

// Test user authentication
func TestUserRegistration(t *testing.T) {
	// Test case 1: Valid registration
	testCases := []struct {
		name     string
		email    string
		password string
		wantErr  bool
	}{
		{
			name:     "Valid registration",
			email:    "test@example.com",
			password: "Password123!",
			wantErr:  false,
		},
		{
			name:     "Duplicate email",
			email:    "existing@example.com",
			password: "Password123!",
			wantErr:  true,
		},
		{
			name:     "Invalid email",
			email:    "invalid-email",
			password: "Password123!",
			wantErr:  true,
		},
		{
			name:     "Weak password",
			email:    "test@example.com",
			password: "123",
			wantErr:  true,
		},
		{
			name:     "Empty email",
			email:    "",
			password: "Password123!",
			wantErr:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Test implementation would go here
			// This demonstrates the test structure
		})
	}
}

// Test user login
func TestUserLogin(t *testing.T) {
	testCases := []struct {
		name     string
		email    string
		password string
		wantErr  bool
	}{
		{
			name:     "Valid credentials",
			email:    "test@test.com",
			password: "test123",
			wantErr:  false,
		},
		{
			name:     "Wrong password",
			email:    "test@test.com",
			password: "wrongpassword",
			wantErr:  true,
		},
		{
			name:     "User not found",
			email:    "nonexistent@test.com",
			password: "password123",
			wantErr:  true,
		},
		{
			name:     "Empty credentials",
			email:    "",
			password: "",
			wantErr:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Test implementation would go here
		})
	}
}

// Test JWT token generation
func TestJWTTokenGeneration(t *testing.T) {
	testCases := []struct {
		name   string
		userID int
		email  string
		role   string
		valid  bool
	}{
		{
			name:   "Valid token for user",
			userID: 1,
			email:  "test@test.com",
			role:   "user",
			valid:  true,
		},
		{
			name:   "Valid token for nutritionist",
			userID: 2,
			email:  "nutritionist@test.com",
			role:   "nutritionist",
			valid:  true,
		},
		{
			name:   "Valid token for admin",
			userID: 3,
			email:  "admin@test.com",
			role:   "admin",
			valid:  true,
		},
		{
			name:   "Invalid user ID",
			userID: 0,
			email:  "test@test.com",
			role:   "user",
			valid:  false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Token generation would be tested here
		})
	}
}

// Test health profile operations
func TestHealthProfile(t *testing.T) {
	testCases := []struct {
		name    string
		userID  int
		age     int
		height  float64
		weight  float64
		wantErr bool
	}{
		{
			name:    "Valid health profile",
			userID:  1,
			age:     30,
			height:  175.0,
			weight:  75.0,
			wantErr: false,
		},
		{
			name:    "Invalid age",
			userID:  1,
			age:     -5,
			height:  175.0,
			weight:  75.0,
			wantErr: true,
		},
		{
			name:    "Invalid height",
			userID:  1,
			age:     30,
			height:  0,
			weight:  75.0,
			wantErr: true,
		},
		{
			name:    "Invalid weight",
			userID:  1,
			age:     30,
			height:  175.0,
			weight:  -10,
			wantErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Health profile validation would be tested here
		})
	}
}

// Test meal plan operations
func TestMealPlan(t *testing.T) {
	testCases := []struct {
		name     string
		userID   int
		planName string
		wantErr  bool
	}{
		{
			name:     "Valid meal plan",
			userID:   1,
			planName: "Weekly Plan",
			wantErr:  false,
		},
		{
			name:     "Empty plan name",
			userID:   1,
			planName: "",
			wantErr:  true,
		},
		{
			name:     "Invalid user",
			userID:   0,
			planName: "Weekly Plan",
			wantErr:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Meal plan operations would be tested here
		})
	}
}

// Test recipe operations
func TestRecipeOperations(t *testing.T) {
	testCases := []struct {
		name       string
		recipeName string
		category   string
		calories   float64
		wantErr    bool
	}{
		{
			name:       "Valid recipe",
			recipeName: "Grilled Chicken",
			category:   "Main Course",
			calories:   450.0,
			wantErr:    false,
		},
		{
			name:       "Invalid calories",
			recipeName: "Grilled Chicken",
			category:   "Main Course",
			calories:   -100,
			wantErr:    true,
		},
		{
			name:       "Empty recipe name",
			recipeName: "",
			category:   "Main Course",
			calories:   450.0,
			wantErr:    true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Recipe operations would be tested here
		})
	}
}

// Test appointment operations
func TestAppointmentOperations(t *testing.T) {
	testCases := []struct {
		name        string
		patientID   int
		title       string
		description string
		status      string
		wantErr     bool
	}{
		{
			name:        "Valid appointment",
			patientID:   1,
			title:       "Nutrition Consultation",
			description: "Initial consultation",
			status:      "scheduled",
			wantErr:     false,
		},
		{
			name:        "Invalid patient",
			patientID:   0,
			title:       "Nutrition Consultation",
			description: "Initial consultation",
			status:      "scheduled",
			wantErr:     true,
		},
		{
			name:        "Invalid status",
			patientID:   1,
			title:       "Nutrition Consultation",
			description: "Initial consultation",
			status:      "invalid_status",
			wantErr:     true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Appointment operations would be tested here
		})
	}
}

// Test message operations
func TestMessageOperations(t *testing.T) {
	testCases := []struct {
		name        string
		senderID    int
		recipientID int
		content     string
		wantErr     bool
	}{
		{
			name:        "Valid message",
			senderID:    1,
			recipientID: 2,
			content:     "Hello, this is a test message",
			wantErr:     false,
		},
		{
			name:        "Empty content",
			senderID:    1,
			recipientID: 2,
			content:     "",
			wantErr:     true,
		},
		{
			name:        "Invalid sender",
			senderID:    0,
			recipientID: 2,
			content:     "Test message",
			wantErr:     true,
		},
		{
			name:        "Same sender and recipient",
			senderID:    1,
			recipientID: 1,
			content:     "Test message",
			wantErr:     true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Message operations would be tested here
		})
	}
}

// Test middleware authentication
func TestAuthenticationMiddleware(t *testing.T) {
	testCases := []struct {
		name       string
		token      string
		shouldPass bool
	}{
		{
			name:       "Valid token",
			token:      "valid-jwt-token",
			shouldPass: true,
		},
		{
			name:       "Invalid token",
			token:      "invalid-token",
			shouldPass: false,
		},
		{
			name:       "Expired token",
			token:      "expired-token",
			shouldPass: false,
		},
		{
			name:       "Missing token",
			token:      "",
			shouldPass: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Middleware authentication would be tested here
		})
	}
}

// Test role-based access control
func TestRoleBasedAccess(t *testing.T) {
	testCases := []struct {
		name     string
		role     string
		resource string
		allowed  bool
	}{
		{
			name:     "User accessing user resource",
			role:     "user",
			resource: "/api/me",
			allowed:  true,
		},
		{
			name:     "User accessing nutritionist resource",
			role:     "user",
			resource: "/api/nutritionist/patients",
			allowed:  false,
		},
		{
			name:     "Nutritionist accessing nutritionist resource",
			role:     "nutritionist",
			resource: "/api/nutritionist/patients",
			allowed:  true,
		},
		{
			name:     "Admin accessing any resource",
			role:     "admin",
			resource: "/api/admin/users",
			allowed:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// RBAC would be tested here
		})
	}
}

// Test data validation
func TestDataValidation(t *testing.T) {
	testCases := []struct {
		name    string
		data    map[string]interface{}
		isValid bool
	}{
		{
			name: "Valid user data",
			data: map[string]interface{}{
				"name":     "John Doe",
				"email":    "john@example.com",
				"password": "SecurePass123!",
			},
			isValid: true,
		},
		{
			name: "Invalid email format",
			data: map[string]interface{}{
				"name":     "John Doe",
				"email":    "invalid-email",
				"password": "SecurePass123!",
			},
			isValid: false,
		},
		{
			name: "Missing required field",
			data: map[string]interface{}{
				"name":  "John Doe",
				"email": "john@example.com",
			},
			isValid: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Data validation would be tested here
		})
	}
}
