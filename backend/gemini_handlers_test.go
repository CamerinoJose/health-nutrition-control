package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

func TestGeminiChatRequiresAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	auth := router.Group("")
	auth.Use(authMiddleware())
	auth.POST("/gemini/chat", geminiChatHandler)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/gemini/chat", strings.NewReader(`{"message":"hola"}`))
	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
}

func TestHandleGeminiChatProxiesRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1beta/models/gemini-test:generateContent" {
			t.Errorf("unexpected request path: %s", r.URL.Path)
		}
		if got := r.Header.Get("x-goog-api-key"); got != "test-api-key" {
			t.Errorf("expected API key header, got %q", got)
		}
		if strings.Contains(r.URL.String(), "test-api-key") {
			t.Error("API key must not be sent in the URL")
		}

		var payload geminiGenerateRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if got := payload.Contents[0].Parts[0].Text; got != "¿Qué puedo desayunar?" {
			t.Errorf("unexpected user message: %q", got)
		}
		if got := payload.GenerationConfig.MaxOutputTokens; got != 1024 {
			t.Errorf("unexpected output token limit: %d", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"parts":[{"text":"Prueba con avena."}]}}]}`))
	}))
	defer server.Close()

	router := gin.New()
	router.POST("/gemini/chat", func(c *gin.Context) {
		handleGeminiChat(c, server.Client(), "test-api-key", "gemini-test", server.URL)
	})
	response := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodPost,
		"/gemini/chat",
		strings.NewReader(`{"message":"¿Qué puedo desayunar?","profileName":"Ana"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, response.Code, response.Body.String())
	}
	var result struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if result.Text != "Prueba con avena." {
		t.Errorf("unexpected response text: %q", result.Text)
	}
}

func TestHandleGeminiChatRejectsInvalidInput(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/gemini/chat", func(c *gin.Context) {
		handleGeminiChat(c, http.DefaultClient, "test-api-key", "gemini-test", "http://unused")
	})

	for _, body := range []string{
		`{"message":"   "}`,
		`{"message":"` + strings.Repeat("x", maxGeminiMessageRunes+1) + `"}`,
		`{"message":"ok","profileName":"` + strings.Repeat("x", maxGeminiProfileRunes+1) + `"}`,
		`not-json`,
	} {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/gemini/chat", strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(response, request)
		if response.Code != http.StatusBadRequest {
			t.Errorf("body %q: expected status %d, got %d", body[:min(len(body), 40)], http.StatusBadRequest, response.Code)
		}
	}
}

func TestHandleGeminiChatRequiresAPIKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/gemini/chat", func(c *gin.Context) {
		handleGeminiChat(c, http.DefaultClient, "", "gemini-test", "http://unused")
	})
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/gemini/chat", strings.NewReader(`{"message":"hola"}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(response, request)

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, response.Code)
	}
}

func TestHandleGeminiChatHidesUpstreamErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "provider details", http.StatusInternalServerError)
	}))
	defer server.Close()

	router := gin.New()
	router.POST("/gemini/chat", func(c *gin.Context) {
		handleGeminiChat(c, server.Client(), "test-api-key", "gemini-test", server.URL)
	})
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/gemini/chat", strings.NewReader(`{"message":"hola"}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadGateway {
		t.Fatalf("expected status %d, got %d", http.StatusBadGateway, response.Code)
	}
	if strings.Contains(response.Body.String(), "provider details") {
		t.Fatal("response leaked provider error details")
	}
}

func TestHandleGeminiChatRetriesTemporaryUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"parts":[{"text":"Respuesta recuperada."}]}}]}`))
	}))
	defer server.Close()

	router := gin.New()
	router.POST("/gemini/chat", func(c *gin.Context) {
		handleGeminiChat(c, server.Client(), "test-api-key", "gemini-test", server.URL)
	})
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/gemini/chat", strings.NewReader(`{"message":"hola"}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, response.Code, response.Body.String())
	}
	if attempts != 3 {
		t.Fatalf("expected 3 attempts, got %d", attempts)
	}
}

func TestAuthMiddlewareAcceptsGeminiToken(t *testing.T) {
	previousJWTKey := jwtKey
	jwtKey = []byte("gemini-test-jwt-secret")
	t.Cleanup(func() { jwtKey = previousJWTKey })

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &Claims{UserID: 1}).SignedString(jwtKey)
	if err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	auth := router.Group("")
	auth.Use(authMiddleware())
	auth.POST("/gemini/chat", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/gemini/chat", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, response.Code)
	}
}
