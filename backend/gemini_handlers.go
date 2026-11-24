package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

const (
	geminiAPIBaseURL       = "https://generativelanguage.googleapis.com"
	defaultGeminiModel     = "gemini-2.5-pro"
	maxGeminiRequestBytes  = 8 << 10
	maxGeminiResponseBytes = 1 << 20
	maxGeminiMessageRunes  = 500
	maxGeminiProfileRunes  = 120
)

var geminiHTTPClient = &http.Client{Timeout: 30 * time.Second}

type geminiChatRequest struct {
	Message     string `json:"message" binding:"required"`
	ProfileName string `json:"profileName"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiGenerateRequest struct {
	SystemInstruction geminiContent   `json:"systemInstruction"`
	Contents          []geminiContent `json:"contents"`
	GenerationConfig  struct {
		Temperature     float64 `json:"temperature"`
		MaxOutputTokens int     `json:"maxOutputTokens"`
	} `json:"generationConfig"`
}

type geminiGenerateResponse struct {
	Candidates []struct {
		Content geminiContent `json:"content"`
	} `json:"candidates"`
}

type geminiUpstreamError struct {
	StatusCode int
}

func (e *geminiUpstreamError) Error() string {
	return fmt.Sprintf("Gemini API returned HTTP %d", e.StatusCode)
}

func geminiChatHandler(c *gin.Context) {
	model := strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	if model == "" {
		model = defaultGeminiModel
	}

	handleGeminiChat(
		c,
		geminiHTTPClient,
		strings.TrimSpace(os.Getenv("GEMINI_API_KEY")),
		model,
		geminiAPIBaseURL,
	)
}

func handleGeminiChat(c *gin.Context, client *http.Client, apiKey, model, baseURL string) {
	if apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "El asistente de IA no está configurado."})
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxGeminiRequestBytes)
	var input geminiChatRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Solicitud inválida."})
		return
	}

	input.Message = strings.TrimSpace(input.Message)
	input.ProfileName = strings.TrimSpace(input.ProfileName)
	if input.Message == "" ||
		utf8.RuneCountInString(input.Message) > maxGeminiMessageRunes ||
		utf8.RuneCountInString(input.ProfileName) > maxGeminiProfileRunes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "El mensaje no es válido."})
		return
	}

	text, err := generateGeminiResponse(c.Request.Context(), client, apiKey, model, baseURL, input)
	if err != nil {
		log.Printf("Gemini request failed: %v", err)
		var upstreamErr *geminiUpstreamError
		if errors.As(err, &upstreamErr) &&
			(upstreamErr.StatusCode == http.StatusTooManyRequests ||
				upstreamErr.StatusCode == http.StatusServiceUnavailable ||
				upstreamErr.StatusCode == http.StatusGatewayTimeout) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "El proveedor de IA está temporalmente ocupado. Intenta de nuevo."})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "No se pudo conectar con el asistente de IA."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"text": text})
}

func generateGeminiResponse(
	ctx context.Context,
	client *http.Client,
	apiKey, model, baseURL string,
	input geminiChatRequest,
) (string, error) {
	if client == nil {
		return "", errors.New("HTTP client is not configured")
	}

	systemPrompt := `Eres un asistente de nutrición amigable y experto. Ayudas con consejos de nutrición, información sobre alimentos, recetas saludables y planes de comidas. Responde siempre en español, de manera amigable y clara. Sé conciso pero informativo. No diagnostiques ni sustituyas la atención de profesionales de salud.`
	if input.ProfileName != "" {
		systemPrompt += "\nPersonaliza tus respuestas cuando sea apropiado para " + input.ProfileName + "."
	}

	payload := geminiGenerateRequest{
		SystemInstruction: geminiContent{Parts: []geminiPart{{Text: systemPrompt}}},
		Contents: []geminiContent{{
			Role:  "user",
			Parts: []geminiPart{{Text: input.Message}},
		}},
	}
	payload.GenerationConfig.Temperature = 0.6
	payload.GenerationConfig.MaxOutputTokens = 1024

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	endpoint := strings.TrimRight(baseURL, "/") +
		"/v1beta/models/" + url.PathEscape(model) + ":generateContent"
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("x-goog-api-key", apiKey)

	var response *http.Response
	var upstreamErr error
	for attempt := 0; attempt < 3; attempt++ {
		request, err = http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("x-goog-api-key", apiKey)

		response, upstreamErr = client.Do(request)
		if upstreamErr != nil {
			return "", upstreamErr
		}
		if response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices {
			break
		}

		statusCode := response.StatusCode
		response.Body.Close()
		upstreamErr = &geminiUpstreamError{StatusCode: statusCode}
		if statusCode != http.StatusTooManyRequests &&
			statusCode != http.StatusServiceUnavailable &&
			statusCode != http.StatusGatewayTimeout {
			return "", upstreamErr
		}
		if attempt < 2 {
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(time.Duration(attempt+1) * 500 * time.Millisecond):
			}
		}
	}
	if upstreamErr != nil && (response == nil || response.StatusCode < 200 || response.StatusCode >= 300) {
		return "", upstreamErr
	}
	defer response.Body.Close()

	var result geminiGenerateResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, maxGeminiResponseBytes)).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Candidates) == 0 {
		return "", errors.New("Gemini API returned no candidates")
	}

	var text strings.Builder
	for _, part := range result.Candidates[0].Content.Parts {
		text.WriteString(part.Text)
	}
	answer := strings.TrimSpace(text.String())
	if answer == "" {
		return "", errors.New("Gemini API returned an empty response")
	}

	return answer, nil
}
