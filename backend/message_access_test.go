package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

func TestMessageAccessPostgres(t *testing.T) {
	t.Setenv("SUPPORT_EMAIL", "support@example.test")
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
		`CREATE TEMP TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT, nutritionist_id INTEGER, email TEXT, is_disabled BOOLEAN NOT NULL DEFAULT FALSE)`,
		`INSERT INTO users (id, name, role, nutritionist_id, email) VALUES
			(1, 'Patient', 'user', 2, 'patient@example.test'), (2, 'Professional', 'nutritionist', NULL, 'professional@example.test'),
			(3, 'Other patient', 'user', 4, 'other@example.test'), (4, 'Other professional', 'nutritionist', NULL, 'other-professional@example.test'),
			(5, 'Support', 'admin', NULL, 'support@example.test'), (6, 'Other admin', 'admin', NULL, 'other-admin@example.test')`,
		`CREATE TEMP TABLE messages (id SERIAL PRIMARY KEY, sender_id INTEGER, recipient_id INTEGER,
			content TEXT, is_read BOOLEAN DEFAULT FALSE, created_at TEXT)`,
		`INSERT INTO messages (sender_id, recipient_id, content, created_at) VALUES
			(1, 2, 'clinical legacy', '2026-01-01'), (1, 3, 'ambiguous legacy', '2026-01-02')`,
		`CREATE TEMP TABLE deleted_messages (id SERIAL PRIMARY KEY, user_id INTEGER, message_id INTEGER,
			created_at TEXT, UNIQUE(user_id, message_id))`,
		`CREATE TEMP TABLE notifications (id SERIAL PRIMARY KEY, user_id INTEGER, type TEXT, title TEXT,
			message TEXT, related_id INTEGER, is_read BOOLEAN DEFAULT FALSE, created_at TEXT)`,
		`CREATE TEMP TABLE appointments (id INTEGER PRIMARY KEY, user_id INTEGER, nutritionist_id INTEGER)`,
		`INSERT INTO appointments VALUES (10, 1, 2)`,
		`INSERT INTO notifications (user_id, type, title, message, related_id, created_at) VALUES
			(2, 'message', 'New', 'Patient', 1, '2026-01-01'),
			(2, 'appointment_rejected', 'Rejected', 'Sensitive reason', 10, '2026-01-02')`,
	} {
		if _, err := testDB.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	previousDB := db
	db = testDB
	t.Cleanup(func() { db = previousDB })
	if err := migrateMessageAccess(); err != nil {
		t.Fatal(err)
	}
	if err := migrateMessageAccess(); err != nil {
		t.Fatalf("migration is not repeatable: %v", err)
	}

	gin.SetMode(gin.TestMode)
	var claims Claims
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("claims", &claims); c.Next() })
	router.POST("/messages", sendMessageHandler)
	router.GET("/messages", getMessagesHandler)
	router.GET("/messages/conversations", getConversationsHandler)
	router.GET("/messages/archived", getArchivedMessagesHandler)
	router.DELETE("/messages/:id", deleteMessageHandler)
	router.PUT("/messages/:id/read", markMessageAsReadHandler)
	router.GET("/notifications", getNotificationsHandler)
	router.GET("/support", getSupportHandler)
	request := func(method, path, body string) *httptest.ResponseRecorder {
		response := httptest.NewRecorder()
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(response, req)
		return response
	}
	count := func(path string) int {
		t.Helper()
		res := request(http.MethodGet, path, "")
		if res.Code != http.StatusOK {
			t.Fatalf("%s: %d %s", path, res.Code, res.Body.String())
		}
		var rows []json.RawMessage
		if err := json.Unmarshal(res.Body.Bytes(), &rows); err != nil {
			t.Fatal(err)
		}
		return len(rows)
	}

	claims = Claims{UserID: 2, Role: "nutritionist"}
	if count("/messages?user_id=1") != 0 || count("/messages/conversations") != 0 || count("/notifications") != 1 {
		t.Fatal("unclassified legacy message or its notification was exposed")
	}
	if res := request(http.MethodPost, "/messages", `{"recipient_id":3,"content":"no"}`); res.Code != http.StatusForbidden {
		t.Fatalf("unassigned send: %d %s", res.Code, res.Body.String())
	}
	if res := request(http.MethodDelete, "/messages/2", ""); res.Code != http.StatusNotFound {
		t.Fatalf("deleting another user's message: %d", res.Code)
	}
	claims = Claims{UserID: 1, Role: "user"}
	if res := request(http.MethodGet, "/support", ""); res.Code != http.StatusOK || !bytes.Contains(res.Body.Bytes(), []byte(`"id":5`)) {
		t.Fatalf("configured support account: %d %s", res.Code, res.Body.String())
	}
	if res := request(http.MethodPost, "/messages", `{"recipient_id":6,"content":"no"}`); res.Code != http.StatusForbidden {
		t.Fatalf("non-support admin: %d", res.Code)
	}
	if count("/messages?user_id=3") != 0 {
		t.Fatal("ambiguous legacy message was exposed")
	}
	if res := request(http.MethodGet, "/messages/conversations", ""); res.Header().Get("X-Restricted-Legacy-Messages") != "true" {
		t.Fatal("restricted legacy message warning missing")
	}
	res := request(http.MethodPost, "/messages", `{"recipient_id":2,"content":"clinical new"}`)
	if res.Code != http.StatusOK {
		t.Fatalf("assigned send: %d %s", res.Code, res.Body.String())
	}
	var sent struct {
		ID int `json:"id"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &sent); err != nil {
		t.Fatal(err)
	}
	claims = Claims{UserID: 2, Role: "nutritionist"}
	if count("/messages?user_id=1") != 1 || count("/messages/conversations") != 1 || count("/notifications") != 2 {
		t.Fatal("assigned professional could not access the new clinical message")
	}
	if res := request(http.MethodDelete, fmt.Sprintf("/messages/%d", sent.ID), ""); res.Code != http.StatusOK {
		t.Fatalf("archive assigned message: %d %s", res.Code, res.Body.String())
	}
	if count("/messages/archived?user_id=1") != 1 {
		t.Fatal("assigned professional could not see archived message")
	}
	claims = Claims{UserID: 1, Role: "user"}
	if res := request(http.MethodPost, "/messages", `{"recipient_id":5,"content":"support"}`); res.Code != http.StatusOK {
		t.Fatalf("support send: %d %s", res.Code, res.Body.String())
	}
	if _, err := testDB.Exec(`UPDATE users SET nutritionist_id = 4 WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	if count("/messages?user_id=2") != 1 {
		t.Fatal("patient lost historical messages")
	}
	if res := request(http.MethodPost, "/messages", `{"recipient_id":2,"content":"no"}`); res.Code != http.StatusForbidden {
		t.Fatalf("send to previous professional: %d", res.Code)
	}
	claims = Claims{UserID: 2, Role: "nutritionist"}
	if count("/messages?user_id=1") != 0 || count("/messages/archived?user_id=1") != 0 ||
		count("/messages/conversations") != 0 || count("/notifications") != 0 {
		t.Fatal("previous professional retained clinical access")
	}
	if res := request(http.MethodPut, fmt.Sprintf("/messages/%d/read", sent.ID), ""); res.Code != http.StatusNotFound {
		t.Fatalf("read after reassignment: %d", res.Code)
	}
	if res := request(http.MethodDelete, fmt.Sprintf("/messages/%d", sent.ID), ""); res.Code != http.StatusNotFound {
		t.Fatalf("delete after reassignment: %d", res.Code)
	}
	if _, err := testDB.Exec(`UPDATE users SET role = 'user' WHERE id = 2`); err != nil {
		t.Fatal(err)
	}
	claims = Claims{UserID: 2, Role: "user"}
	if count("/messages?user_id=1") != 0 || count("/notifications") != 0 {
		t.Fatal("demoted professional retained clinical access")
	}
	if err := migrateMessageAccess(); err != nil {
		t.Fatal(err)
	}
	claims = Claims{UserID: 1, Role: "user"}
	if count("/messages?user_id=2") != 1 || count("/messages?user_id=3") != 0 {
		t.Fatal("migration changed existing classification")
	}
	claims = Claims{UserID: 5, Role: "admin"}
	if count("/messages?user_id=1") != 1 {
		t.Fatal("explicit support conversation was not available")
	}
	t.Setenv("SUPPORT_EMAIL", "")
	if res := request(http.MethodGet, "/support", ""); res.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured support: %d", res.Code)
	}
	claims = Claims{UserID: 1, Role: "user"}
	if res := request(http.MethodPost, "/messages", `{"recipient_id":5,"content":"no"}`); res.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured support send: %d", res.Code)
	}
	t.Setenv("SUPPORT_EMAIL", "patient@example.test")
	if res := request(http.MethodGet, "/support", ""); res.Code != http.StatusServiceUnavailable {
		t.Fatalf("non-admin support configuration: %d", res.Code)
	}
	t.Setenv("SUPPORT_EMAIL", "support@example.test")
	if _, err := testDB.Exec(`UPDATE users SET is_disabled = TRUE WHERE id = 5`); err != nil {
		t.Fatal(err)
	}
	if res := request(http.MethodGet, "/support", ""); res.Code != http.StatusServiceUnavailable {
		t.Fatalf("disabled support configuration: %d", res.Code)
	}
}

func TestAuthMiddlewareRejectsChangedRolePostgres(t *testing.T) {
	testDB := openTemporaryPostgres(t)
	if _, err := testDB.Exec(`CREATE TEMP TABLE users (id INTEGER PRIMARY KEY, role TEXT, is_disabled BOOLEAN NOT NULL DEFAULT FALSE);
		INSERT INTO users (id, role) VALUES (1, 'user')`); err != nil {
		t.Fatal(err)
	}
	previousDB, previousKey := db, jwtKey
	db, jwtKey = testDB, []byte("role-change-test-key")
	t.Cleanup(func() { db, jwtKey = previousDB, previousKey })
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &Claims{UserID: 1, Role: "nutritionist"}).SignedString(jwtKey)
	if err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.GET("/", authMiddleware(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("stale role: %d", res.Code)
	}
}
