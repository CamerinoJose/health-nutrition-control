package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestFeedbackQueuePostgres(t *testing.T) {
	testDB := openTemporaryPostgres(t)
	for _, statement := range []string{
		`CREATE TEMP TABLE users (id INTEGER PRIMARY KEY, role TEXT)`,
		`INSERT INTO users VALUES (1, 'user'), (2, 'admin')`,
		`CREATE TEMP TABLE feedback (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id),
			subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
		`CREATE TEMP TABLE admin_audit_logs (admin_user_id INTEGER, action TEXT, target_user_id INTEGER, created_at TEXT)`,
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
	router.POST("/feedback", createFeedbackHandler)
	admin := router.Group("/admin")
	admin.Use(adminMiddleware())
	admin.GET("/feedback", listFeedbackHandler)
	admin.PUT("/feedback/:id", updateFeedbackHandler)
	request := func(method, path, body string) *httptest.ResponseRecorder {
		res := httptest.NewRecorder()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(res, req)
		return res
	}
	claims = Claims{UserID: 1, Role: "user"}
	for _, body := range []string{`{"subject":"  ","message":"test"}`, `{"subject":"test","message":""}`,
		fmt.Sprintf(`{"subject":"test","message":"%s"}`, strings.Repeat("x", 2001))} {
		if res := request(http.MethodPost, "/feedback", body); res.Code != http.StatusBadRequest {
			t.Fatalf("invalid feedback: %d", res.Code)
		}
	}
	if res := request(http.MethodPost, "/feedback", `{"subject":" Primer comentario ","message":" mensaje "}`); res.Code != http.StatusCreated {
		t.Fatalf("submit: %d %s", res.Code, res.Body.String())
	}
	if res := request(http.MethodGet, "/admin/feedback", ""); res.Code != http.StatusForbidden {
		t.Fatalf("non-admin queue access: %d", res.Code)
	}
	if res := request(http.MethodPut, "/admin/feedback/1", `{"status":"resolved"}`); res.Code != http.StatusForbidden {
		t.Fatalf("non-admin update: %d", res.Code)
	}
	if _, err := testDB.Exec(`INSERT INTO feedback (user_id, subject, message)
		SELECT 1, 'test', 'body' FROM generate_series(1, 51)`); err != nil {
		t.Fatal(err)
	}
	claims = Claims{UserID: 2, Role: "admin"}
	list := func(path string) struct {
		Items []feedbackItem `json:"items"`
		Next  int            `json:"next_after_id"`
	} {
		t.Helper()
		res := request(http.MethodGet, path, "")
		var result struct {
			Items []feedbackItem `json:"items"`
			Next  int            `json:"next_after_id"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil || res.Code != http.StatusOK {
			t.Fatalf("list feedback: %d %s %v", res.Code, res.Body.String(), err)
		}
		return result
	}
	first := list("/admin/feedback")
	if len(first.Items) != 50 || first.Items[0].ID != 1 || first.Items[0].Subject != "Primer comentario" || first.Next != 50 {
		t.Fatalf("first page not ordered or trimmed: %+v", first)
	}
	last := list("/admin/feedback?after_id=50")
	if len(last.Items) != 2 || last.Items[0].ID != 51 || last.Items[1].ID != 52 || last.Next != 0 {
		t.Fatalf("second page: %+v", last)
	}
	if res := request(http.MethodPut, "/admin/feedback/1", `{"status":"in_progress"}`); res.Code != http.StatusOK {
		t.Fatalf("start feedback: %d %s", res.Code, res.Body.String())
	}
	if res := request(http.MethodPut, "/admin/feedback/1", `{"status":"resolved"}`); res.Code != http.StatusOK {
		t.Fatalf("resolve feedback: %d %s", res.Code, res.Body.String())
	}
	if got := list("/admin/feedback?view=resolved"); len(got.Items) != 1 || got.Items[0].ID != 1 {
		t.Fatalf("resolved feedback: %+v", got)
	}
	if got := list("/admin/feedback"); got.Items[0].ID != 2 {
		t.Fatal("resolved feedback remained in active queue")
	}
	if _, err := testDB.Exec(`UPDATE users SET role = 'user' WHERE id = 2`); err != nil {
		t.Fatal(err)
	}
	if res := request(http.MethodGet, "/admin/feedback", ""); res.Code != http.StatusForbidden {
		t.Fatalf("revoked admin queue access: %d", res.Code)
	}
	if res := request(http.MethodPut, "/admin/feedback/2", `{"status":"resolved"}`); res.Code != http.StatusForbidden {
		t.Fatalf("revoked admin update: %d", res.Code)
	}
}
