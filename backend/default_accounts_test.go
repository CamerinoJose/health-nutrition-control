package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"golang.org/x/crypto/bcrypt"
)

func TestPasswordRecoveryIsUnavailable(t *testing.T) {
	router := gin.New()
	router.POST("/reset-password", resetPasswordHandler)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, httptest.NewRequest(http.MethodPost, "/reset-password", strings.NewReader(`{"email":"person@example.test","newPassword":"unused"}`)))
	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("reset returned %d, want 503", res.Code)
	}
}

func TestDefaultAccountsAreDisabledWithoutDeletingUsers(t *testing.T) {
	testDB := openTemporaryPostgres(t)
	_, err := testDB.Exec(`CREATE TEMP TABLE users (
		id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT, role TEXT,
		is_disabled BOOLEAN NOT NULL DEFAULT FALSE
	);
	CREATE TEMP TABLE social_accounts (
		user_id INTEGER, provider TEXT, provider_user_id TEXT
	)`)
	if err != nil {
		t.Fatal(err)
	}
	defaultHash, err := bcrypt.GenerateFromPassword([]byte("Admin123!"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	safeHash, err := bcrypt.GenerateFromPassword([]byte("unrelated-test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	for _, u := range []struct {
		id       int
		email    string
		password []byte
	}{
		{1, "admin@test.com", safeHash},
		{2, "configured@example.test", defaultHash},
		{3, "legitimate@example.test", safeHash},
	} {
		_, err := testDB.Exec(`INSERT INTO users (id,name,email,password,role) VALUES ($1,'Test',$2,$3,'admin')`, u.id, u.email, string(u.password))
		if err != nil {
			t.Fatal(err)
		}
	}
	if _, err := testDB.Exec(`INSERT INTO social_accounts VALUES (2,'google','linked-id')`); err != nil {
		t.Fatal(err)
	}

	previousDB, previousKey := db, jwtKey
	db, jwtKey = testDB, []byte("test-signing-key-not-used-in-production")
	t.Cleanup(func() { db, jwtKey = previousDB, previousKey })
	t.Setenv("ADMIN_EMAIL", "configured@example.test")
	t.Setenv("NUTRITIONIST_EMAIL", "legitimate@example.test")
	for i := 0; i < 2; i++ {
		if err := disableDefaultAccounts(); err != nil {
			t.Fatal(err)
		}
	}
	for _, expected := range []struct {
		id       int
		disabled bool
	}{{1, true}, {2, true}, {3, false}} {
		var disabled bool
		if err := testDB.QueryRow(`SELECT is_disabled FROM users WHERE id=$1`, expected.id).Scan(&disabled); err != nil {
			t.Fatal(err)
		}
		if disabled != expected.disabled {
			t.Fatalf("user %d disabled=%v, want %v", expected.id, disabled, expected.disabled)
		}
	}

	router := gin.New()
	router.POST("/login", loginHandler)
	router.GET("/protected", authMiddleware(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
	for _, u := range []struct {
		id     int
		email  string
		pass   string
		status int
	}{
		{1, "admin@test.com", "unrelated-test-password", http.StatusUnauthorized},
		{2, "configured@example.test", "Admin123!", http.StatusUnauthorized},
		{3, "legitimate@example.test", "unrelated-test-password", http.StatusOK},
	} {
		body := `{"email":"` + u.email + `","password":"` + u.pass + `"}`
		req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != u.status {
			t.Fatalf("login for %d returned %d, want %d", u.id, res.Code, u.status)
		}

		token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &Claims{UserID: u.id, Role: "admin"}).SignedString(jwtKey)
		if err != nil {
			t.Fatal(err)
		}
		req = httptest.NewRequest(http.MethodGet, "/protected", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		res = httptest.NewRecorder()
		router.ServeHTTP(res, req)
		want := http.StatusUnauthorized
		if u.id == 3 {
			want = http.StatusNoContent
		}
		if res.Code != want {
			t.Fatalf("existing token for %d returned %d, want %d", u.id, res.Code, want)
		}
	}

	for _, providerID := range []string{"linked-id", "unlinked-id"} {
		_, _, err := findOrCreateSocialUser("google", map[string]interface{}{
			"id": providerID, "email": "configured@example.test", "name": "Test",
		})
		if err == nil {
			t.Fatalf("disabled account authenticated with provider id %s", providerID)
		}
	}
}
