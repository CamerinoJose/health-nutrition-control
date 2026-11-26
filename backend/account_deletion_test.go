package main

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"golang.org/x/crypto/bcrypt"
)

func TestHasRecentAuthentication(t *testing.T) {
	now := time.Now()
	for _, test := range []struct {
		name  string
		iat   *jwt.NumericDate
		valid bool
	}{
		{name: "missing issued-at"},
		{name: "recent", iat: jwt.NewNumericDate(now.Add(-time.Minute)), valid: true},
		{name: "too old", iat: jwt.NewNumericDate(now.Add(-recentAuthenticationWindow - time.Second))},
		{name: "future", iat: jwt.NewNumericDate(now.Add(time.Second))},
	} {
		t.Run(test.name, func(t *testing.T) {
			got := hasRecentAuthentication(&Claims{RegisteredClaims: jwt.RegisteredClaims{IssuedAt: test.iat}}, now)
			if got != test.valid {
				t.Fatalf("hasRecentAuthentication = %v, want %v", got, test.valid)
			}
		})
	}
}

func TestDeleteAccountDataRemovesOnlyTargetAccountData(t *testing.T) {
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
	previousDB := db
	db = testDB
	t.Cleanup(func() {
		db = previousDB
		_ = testDB.Close()
	})

	tables := []string{
		`CREATE TEMP TABLE users (id INTEGER PRIMARY KEY, nutritionist_id INTEGER)`,
		`CREATE TEMP TABLE histories (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE meal_plans (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE plan_meals (id INTEGER PRIMARY KEY, plan_id INTEGER REFERENCES meal_plans(id))`,
		`CREATE TEMP TABLE medicines (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE medicine_logs (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), medicine_id INTEGER REFERENCES medicines(id))`,
		`CREATE TEMP TABLE appointments (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), nutritionist_id INTEGER)`,
		`CREATE TEMP TABLE appointment_changes (id INTEGER PRIMARY KEY, appointment_id INTEGER REFERENCES appointments(id), proposed_by INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE recommendations (id INTEGER PRIMARY KEY, patient_id INTEGER REFERENCES users(id), nutritionist_id INTEGER REFERENCES users(id), appointment_id INTEGER REFERENCES appointments(id))`,
		`CREATE TEMP TABLE messages (id INTEGER PRIMARY KEY, sender_id INTEGER REFERENCES users(id), recipient_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE deleted_messages (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), message_id INTEGER REFERENCES messages(id))`,
		`CREATE TEMP TABLE health_profiles (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE food_logs (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE user_settings (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE notifications (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE nutritionist_availability (id INTEGER PRIMARY KEY, nutritionist_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE push_tokens (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE social_accounts (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE gemini_reports (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id))`,
		`CREATE TEMP TABLE admin_audit_logs (id INTEGER PRIMARY KEY, admin_user_id INTEGER REFERENCES users(id), target_user_id INTEGER)`,
	}
	for _, statement := range tables {
		if _, err := testDB.Exec(statement); err != nil {
			t.Fatalf("create test table: %v", err)
		}
	}

	inserts := []string{
		`INSERT INTO users (id) VALUES (1), (2)`,
		`INSERT INTO histories VALUES (1, 1), (2, 2)`,
		`INSERT INTO meal_plans VALUES (1, 1), (2, 2)`,
		`INSERT INTO plan_meals VALUES (1, 1), (2, 2)`,
		`INSERT INTO medicines VALUES (1, 1), (2, 2)`,
		`INSERT INTO medicine_logs VALUES (1, 1, 1), (2, 2, 2)`,
		`INSERT INTO appointments VALUES (1, 1, 2), (2, 2, 1)`,
		`INSERT INTO appointment_changes VALUES (1, 1, 2), (2, 2, 2)`,
		`INSERT INTO recommendations VALUES (1, 1, 2, 1), (2, 2, 2, 2)`,
		`INSERT INTO messages VALUES (1, 1, 2), (2, 2, 2)`,
		`INSERT INTO deleted_messages VALUES (1, 2, 1), (2, 2, 2)`,
		`INSERT INTO health_profiles VALUES (1, 1), (2, 2)`,
		`INSERT INTO food_logs VALUES (1, 1), (2, 2)`,
		`INSERT INTO user_settings VALUES (1, 1), (2, 2)`,
		`INSERT INTO notifications VALUES (1, 1), (2, 2)`,
		`INSERT INTO nutritionist_availability VALUES (1, 1), (2, 2)`,
		`INSERT INTO push_tokens VALUES (1, 1), (2, 2)`,
		`INSERT INTO social_accounts VALUES (1, 1), (2, 2)`,
		`INSERT INTO gemini_reports VALUES (1, 1), (2, 2)`,
		`INSERT INTO admin_audit_logs VALUES (1, 2, 1), (2, 1, 2)`,
	}
	for _, statement := range inserts {
		if _, err := testDB.Exec(statement); err != nil {
			t.Fatalf("insert test data: %v", err)
		}
	}

	deleted, err := deleteAccountData(context.Background(), 1)
	if err != nil {
		t.Fatalf("deleteAccountData returned error: %v", err)
	}
	if !deleted {
		t.Fatal("expected target account to be deleted")
	}

	var remainingUsers int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&remainingUsers); err != nil {
		t.Fatal(err)
	}
	if remainingUsers != 1 {
		t.Fatalf("expected one unrelated user to remain, got %d", remainingUsers)
	}

	var retainedNutritionistID sql.NullInt64
	if err := testDB.QueryRow(`SELECT nutritionist_id FROM users WHERE id = 2`).Scan(&retainedNutritionistID); err != nil {
		t.Fatal(err)
	}
	if retainedNutritionistID.Valid {
		t.Fatal("expected unrelated user assignment to the deleted nutritionist to be cleared")
	}
	var retainedAppointmentNutritionistID sql.NullInt64
	if err := testDB.QueryRow(`SELECT nutritionist_id FROM appointments WHERE id = 2`).Scan(&retainedAppointmentNutritionistID); err != nil {
		t.Fatal(err)
	}
	if retainedAppointmentNutritionistID.Valid {
		t.Fatal("expected unrelated appointment assignment to the deleted nutritionist to be cleared")
	}

	remainingQueries := []struct {
		name  string
		query string
	}{
		{"histories", `SELECT COUNT(*) FROM histories WHERE user_id = 1`},
		{"meal plans", `SELECT COUNT(*) FROM meal_plans WHERE user_id = 1`},
		{"meal plan entries", `SELECT COUNT(*) FROM plan_meals WHERE plan_id = 1`},
		{"medicines", `SELECT COUNT(*) FROM medicines WHERE user_id = 1`},
		{"medicine logs", `SELECT COUNT(*) FROM medicine_logs WHERE user_id = 1`},
		{"patient appointments", `SELECT COUNT(*) FROM appointments WHERE user_id = 1`},
		{"appointment changes", `SELECT COUNT(*) FROM appointment_changes WHERE proposed_by = 1 OR appointment_id = 1`},
		{"recommendations", `SELECT COUNT(*) FROM recommendations WHERE patient_id = 1 OR nutritionist_id = 1 OR appointment_id = 1`},
		{"messages", `SELECT COUNT(*) FROM messages WHERE sender_id = 1 OR recipient_id = 1`},
		{"deleted messages", `SELECT COUNT(*) FROM deleted_messages WHERE user_id = 1 OR message_id = 1`},
		{"health profiles", `SELECT COUNT(*) FROM health_profiles WHERE user_id = 1`},
		{"food logs", `SELECT COUNT(*) FROM food_logs WHERE user_id = 1`},
		{"settings", `SELECT COUNT(*) FROM user_settings WHERE user_id = 1`},
		{"notifications", `SELECT COUNT(*) FROM notifications WHERE user_id = 1`},
		{"availability", `SELECT COUNT(*) FROM nutritionist_availability WHERE nutritionist_id = 1`},
		{"push tokens", `SELECT COUNT(*) FROM push_tokens WHERE user_id = 1`},
		{"social accounts", `SELECT COUNT(*) FROM social_accounts WHERE user_id = 1`},
		{"Gemini reports", `SELECT COUNT(*) FROM gemini_reports WHERE user_id = 1`},
		{"audit logs", `SELECT COUNT(*) FROM admin_audit_logs WHERE admin_user_id = 1 OR target_user_id = 1`},
	}
	for _, check := range remainingQueries {
		var count int
		if err := testDB.QueryRow(check.query).Scan(&count); err != nil {
			t.Errorf("%s count failed: %v", check.name, err)
		} else if count != 0 {
			t.Errorf("expected no target account data in %s, got %d rows", check.name, count)
		}
	}

	var retainedGeminiReports int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM gemini_reports WHERE user_id = 2`).Scan(&retainedGeminiReports); err != nil {
		t.Fatal(err)
	}
	if retainedGeminiReports != 1 {
		t.Fatalf("expected unrelated user's Gemini report to remain, got %d", retainedGeminiReports)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testDB.Exec(`INSERT INTO users (id) VALUES (3), (4), (5)`); err != nil {
		t.Fatal(err)
	}
	if _, err := testDB.Exec(`ALTER TABLE users ADD COLUMN password TEXT`); err != nil {
		t.Fatal(err)
	}
	if _, err := testDB.Exec(`UPDATE users SET password = $1 WHERE id = 3`, string(passwordHash)); err != nil {
		t.Fatal(err)
	}
	if _, err := testDB.Exec(`UPDATE users SET password = $1 WHERE id = 5`, socialLoginPasswordPlaceholder); err != nil {
		t.Fatal(err)
	}

	previousJWTKey := jwtKey
	jwtKey = []byte("account-delete-integration-secret")
	t.Cleanup(func() { jwtKey = previousJWTKey })
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.DELETE("/me", func(c *gin.Context) {
		c.Set("claims", &Claims{UserID: 3})
		deleteOwnAccountHandler(c)
	})
	for _, password := range []string{"", "wrong-password"} {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodDelete, "/me", strings.NewReader(`{"password":"`+password+`"}`))
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(response, request)
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("expected invalid password to receive %d, got %d", http.StatusUnauthorized, response.Code)
		}
	}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/me", strings.NewReader(`{"password":"correct-password"}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("expected correct password deletion to receive %d, got %d: %s", http.StatusOK, response.Code, response.Body.String())
	}

	router = gin.New()
	router.DELETE("/me", func(c *gin.Context) {
		c.Set("claims", &Claims{
			UserID: 4,
			RegisteredClaims: jwt.RegisteredClaims{
				IssuedAt: jwt.NewNumericDate(time.Now()),
			},
		})
		deleteOwnAccountHandler(c)
	})
	response = httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodDelete, "/me", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected recently authenticated OAuth deletion to receive %d, got %d", http.StatusOK, response.Code)
	}

	for _, test := range []struct {
		name       string
		issuedAt   time.Time
		wantStatus int
	}{
		{name: "expired OAuth authentication", issuedAt: time.Now().Add(-recentAuthenticationWindow - time.Minute), wantStatus: http.StatusUnauthorized},
		{name: "recent OAuth authentication", issuedAt: time.Now(), wantStatus: http.StatusOK},
	} {
		t.Run(test.name, func(t *testing.T) {
			router := gin.New()
			router.DELETE("/me", func(c *gin.Context) {
				c.Set("claims", &Claims{
					UserID: 5,
					RegisteredClaims: jwt.RegisteredClaims{
						IssuedAt: jwt.NewNumericDate(test.issuedAt),
					},
				})
				deleteOwnAccountHandler(c)
			})
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(http.MethodDelete, "/me", nil))
			if response.Code != test.wantStatus {
				t.Fatalf("expected status %d, got %d", test.wantStatus, response.Code)
			}
		})
	}
}
