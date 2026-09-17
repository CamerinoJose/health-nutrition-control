package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

// OAuth state store (en producción usar Redis o similar)
var oauthStates = make(map[string]time.Time)
var oauthStateToRedirect = make(map[string]string) // Store the redirect URI for each state
var statesMutex sync.Mutex

// Almacenar tokens temporales para que el app los consulte
var oauthTokens = make(map[string]string)
var tokensMutex sync.Mutex

// Configuración OAuth (en producción usar variables de entorno)
type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	AuthURL      string
	TokenURL     string
	UserInfoURL  string
}

// Helper function to get OAuth configs from environment variables
func getOAuthConfigs() map[string]OAuthConfig {
	// Read env vars once and log if missing (no secrets printed)
	googleID := os.Getenv("GOOGLE_OAUTH_CLIENT_ID")
	googleSecret := os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")
	if googleID == "" || googleSecret == "" {
		log.Println("[OAUTH] WARNING: GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET is not set")
	}

	return map[string]OAuthConfig{
		"google": {
			ClientID:     googleID,
			ClientSecret: googleSecret,
			RedirectURL:  "", // Dinámico
			AuthURL:      "https://accounts.google.com/o/oauth2/v2/auth",
			TokenURL:     "https://oauth2.googleapis.com/token",
			UserInfoURL:  "https://www.googleapis.com/oauth2/v2/userinfo",
		},
		"facebook": {
			ClientID:     os.Getenv("FACEBOOK_OAUTH_CLIENT_ID"),
			ClientSecret: os.Getenv("FACEBOOK_OAUTH_CLIENT_SECRET"),
			RedirectURL:  "", // Dinámico
			AuthURL:      "https://www.facebook.com/v12.0/dialog/oauth",
			TokenURL:     "https://graph.facebook.com/v12.0/oauth/access_token",
			UserInfoURL:  "https://graph.facebook.com/me?fields=id,name,email,picture",
		},
		"github": {
			ClientID:     os.Getenv("GITHUB_OAUTH_CLIENT_ID"),
			ClientSecret: os.Getenv("GITHUB_OAUTH_CLIENT_SECRET"),
			RedirectURL:  "", // Dinámico
			AuthURL:      "https://github.com/login/oauth/authorize",
			TokenURL:     "https://github.com/login/oauth/access_token",
			UserInfoURL:  "https://api.github.com/user",
		},
	}
}

// Helper function to get OAuth config with dynamic redirect URL
func getOAuthConfig(provider string, c *gin.Context) OAuthConfig {
	configs := getOAuthConfigs()
	config := configs[provider]

	// Calculate dynamic redirect URL based on request
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if c.Request.Header.Get("X-Forwarded-Proto") != "" {
		scheme = c.Request.Header.Get("X-Forwarded-Proto")
	}
	host := c.Request.Host
	if c.Request.Header.Get("X-Forwarded-Host") != "" {
		host = c.Request.Header.Get("X-Forwarded-Host")
	}

	config.RedirectURL = fmt.Sprintf("%s://%s/api/auth/%s/callback", scheme, host, provider)
	return config
}

func generateOAuthState() string {
	b := make([]byte, 32)
	rand.Read(b)
	state := base64.URLEncoding.EncodeToString(b)
	oauthStates[state] = time.Now().Add(10 * time.Minute)
	return state
}

func validateOAuthState(state string) bool {
	expiry, exists := oauthStates[state]
	if !exists {
		return false
	}
	if time.Now().After(expiry) {
		delete(oauthStates, state)
		return false
	}
	delete(oauthStates, state)
	return true
}

// Iniciar OAuth flow
func oauthInitHandler(provider string) gin.HandlerFunc {
	return func(c *gin.Context) {
		config := getOAuthConfig(provider, c)
		if config.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid provider"})
			return
		}

		// Detectar host del request y construir successUrl dinámicamente
		scheme := "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}
		if c.Request.Header.Get("X-Forwarded-Proto") != "" {
			scheme = c.Request.Header.Get("X-Forwarded-Proto")
		}
		host := c.Request.Host
		if c.Request.Header.Get("X-Forwarded-Host") != "" {
			host = c.Request.Header.Get("X-Forwarded-Host")
		}

		// Obtener el redirect_uri del cliente (móvil o web)
		mobileRedirectUri := c.Query("redirect_uri")
		var successUrl string

		if mobileRedirectUri != "" {
			// Si viene del móvil, usar ese URI
			successUrl = mobileRedirectUri
			log.Printf("[OAUTH] Using mobile redirect_uri: %s", mobileRedirectUri)
		} else {
			// Si no, usar la URL por defecto del backend
			successUrl = fmt.Sprintf("%s://%s/api/auth/%s/success", scheme, host, provider)
			log.Printf("[OAUTH] No redirect_uri param, using default: %s", successUrl)
		}

		state := generateOAuthState()

		// Store the redirect URI for this state
		statesMutex.Lock()
		oauthStateToRedirect[state] = successUrl
		statesMutex.Unlock()

		log.Printf("[OAUTH] Init handler - Provider: %s", provider)
		log.Printf("[OAUTH] Init handler - Using redirect_uri: %s", config.RedirectURL)
		log.Printf("[OAUTH] Init handler - SuccessUrl: %s", successUrl)
		log.Printf("[OAUTH] Init handler - State: %s", state)
		log.Printf("[OAUTH] Init handler - Storing state->redirect mapping: %s -> %s", state, successUrl)

		authURL := fmt.Sprintf("%s?client_id=%s&redirect_uri=%s&response_type=code&state=%s&scope=%s",
			config.AuthURL,
			url.QueryEscape(config.ClientID),
			url.QueryEscape(config.RedirectURL),
			state,
			getOAuthScope(provider),
		)

		log.Printf("[OAUTH] Full auth URL: %s", authURL)

		c.Redirect(http.StatusTemporaryRedirect, authURL)
	}
}

func getOAuthScope(provider string) string {
	scopes := map[string]string{
		"google":   "openid email profile",
		"facebook": "email public_profile",
		"github":   "read:user user:email",
	}
	return url.QueryEscape(scopes[provider])
}

// Callback OAuth
func oauthCallbackHandler(provider string) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := c.Query("code")
		stateRaw := c.Query("state")

		log.Printf("[OAUTH] ============ CALLBACK HANDLER ============")
		log.Printf("[OAUTH] Provider: %s", provider)
		log.Printf("[OAUTH] Code: %s", code[:10]+"...")
		log.Printf("[OAUTH] State (raw): %s", stateRaw)
		log.Printf("[OAUTH] Request.Host: %s", c.Request.Host)
		log.Printf("[OAUTH] Request.Header Host: %s", c.Request.Header.Get("Host"))

		// Look up the redirect URI from our mapping
		statesMutex.Lock()
		successUrl, found := oauthStateToRedirect[stateRaw]
		delete(oauthStateToRedirect, stateRaw) // Clean up
		statesMutex.Unlock()

		if !found {
			successUrl = fmt.Sprintf("https://%s/api/auth/%s/success", c.Request.Host, provider)
			log.Printf("[OAUTH] State not found in mapping, using default: %s", successUrl)
		} else {
			log.Printf("[OAUTH] Found redirect URI in mapping: %s", successUrl)
		}

		if !validateOAuthState(stateRaw) {
			log.Printf("[OAUTH] Invalid state!")
			c.Redirect(http.StatusTemporaryRedirect, successUrl+"?error=invalid_state")
			return
		}

		config := getOAuthConfig(provider, c)

		// Intercambiar code por access token
		tokenResp, err := exchangeCodeForToken(config, code)
		if err != nil {
			log.Printf("[OAuth] Error exchanging code: %v", err)
			c.Redirect(http.StatusTemporaryRedirect, successUrl+"?error=token_exchange_failed")
			return
		}

		// Obtener información del usuario
		userInfo, err := getUserInfo(config, tokenResp["access_token"].(string), provider)
		if err != nil {
			log.Printf("[OAuth] Error getting user info: %v", err)
			c.Redirect(http.StatusTemporaryRedirect, successUrl+"?error=user_info_failed")
			return
		}

		log.Printf("[OAUTH] User info retrieved: %v", userInfo["email"])

		// Buscar o crear usuario
		_, token, err := findOrCreateSocialUser(provider, userInfo)
		if err != nil {
			log.Printf("[OAuth] Error creating user: %v", err)
			c.Redirect(http.StatusTemporaryRedirect, successUrl+"?error=user_creation_failed")
			return
		}

		// Almacenar token temporalmente para que el app lo consulte
		tokensMutex.Lock()
		oauthTokens["last_token"] = token
		oauthTokens["last_token_expiry"] = fmt.Sprintf("%d", time.Now().Add(5*time.Minute).Unix())
		tokensMutex.Unlock()

		// Construir la URL final con el token
		finalRedirect := fmt.Sprintf("%s?token=%s", successUrl, url.QueryEscape(token))
		log.Printf("[OAUTH] ============ FINAL REDIRECT ============")
		log.Printf("[OAUTH] Success URL: %s", successUrl)
		log.Printf("[OAUTH] Final redirect URL: %s", finalRedirect)
		log.Printf("[OAUTH] Token length: %d", len(token))
		log.Printf("[OAUTH] ============ END CALLBACK ============")

		// Para mobile deep links, usar HTML redirect para mejor compatibilidad con Chrome Custom Tabs
		// Esto permite que el navegador se cierre automáticamente al activar el deep link
		if len(successUrl) > 0 && (successUrl[0:10] == "bienestarap" || successUrl[0:4] == "exp:") {
			log.Printf("[OAUTH] Detected mobile deep link, using HTML redirect")
			htmlRedirect := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Autenticación exitosa</title>
</head>
<body>
    <h2>Autenticación exitosa</h2>
    <p>Redirigiendo a la aplicación...</p>
    <script>
        window.location.replace("%s");
        // Fallback: cerrar ventana después de 1 segundo
        setTimeout(function() { window.close(); }, 1000);
    </script>
</body>
</html>`, finalRedirect)
			c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(htmlRedirect))
		} else {
			// Para URLs web normales, usar redirect HTTP estándar
			c.Redirect(http.StatusTemporaryRedirect, finalRedirect)
		}
	}
}

func exchangeCodeForToken(config OAuthConfig, code string) (map[string]interface{}, error) {
	data := url.Values{}
	data.Set("client_id", config.ClientID)
	data.Set("client_secret", config.ClientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", config.RedirectURL)
	data.Set("grant_type", "authorization_code")

	resp, err := http.PostForm(config.TokenURL, data)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	return result, nil
}

func getUserInfo(config OAuthConfig, accessToken, provider string) (map[string]interface{}, error) {
	req, _ := http.NewRequest("GET", config.UserInfoURL, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var userInfo map[string]interface{}
	json.Unmarshal(body, &userInfo)

	return userInfo, nil
}

func findOrCreateSocialUser(provider string, userInfo map[string]interface{}) (int, string, error) {
	providerUserID := fmt.Sprintf("%v", userInfo["id"])
	email := ""
	name := ""

	// Extraer email y nombre y otros campos según el provider
	picture := ""
	givenName := ""
	familyName := ""
	locale := ""
	if provider == "google" {
		email = userInfo["email"].(string)
		name = userInfo["name"].(string)
		if v, ok := userInfo["picture"].(string); ok {
			picture = v
		}
		if v, ok := userInfo["given_name"].(string); ok {
			givenName = v
		}
		if v, ok := userInfo["family_name"].(string); ok {
			familyName = v
		}
		if v, ok := userInfo["locale"].(string); ok {
			locale = v
		}
	} else if provider == "facebook" {
		if e, ok := userInfo["email"].(string); ok {
			email = e
		}
		name = userInfo["name"].(string)
	} else if provider == "github" {
		if e, ok := userInfo["email"].(string); ok {
			email = e
		}
		if n, ok := userInfo["name"].(string); ok {
			name = n
		} else {
			name = userInfo["login"].(string)
		}
	}

	if email == "" || providerUserID == "" {
		return 0, "", fmt.Errorf("OAuth profile did not include a usable email or provider ID")
	}

	// Buscar si ya existe vinculación
	var userID int
	err := queryRowDB("SELECT user_id FROM social_accounts WHERE provider = ? AND provider_user_id = ?", provider, providerUserID).Scan(&userID)

	if err == sql.ErrNoRows {
		// Reutilizar una cuenta local que tenga el mismo correo.
		err = queryRowDB("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", email).Scan(&userID)
		if err == sql.ErrNoRows {
			// No existe, crear nuevo usuario.
			hashedPassword := "$2a$10$defaultpasswordforsociallogins"
			_, createErr := execDB(
				"INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, 'user')",
				email, hashedPassword, name,
			)
			if createErr != nil {
				return 0, "", createErr
			}

			createErr = queryRowDB("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", email).Scan(&userID)
			if createErr != nil {
				return 0, "", createErr
			}
		} else if err != nil {
			return 0, "", err
		}

		// Crear la vinculación social para usuarios nuevos o existentes.
		_, err = execDB(
			"INSERT INTO social_accounts (user_id, provider, provider_user_id, email, name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
			userID, provider, providerUserID, email, name, picture,
		)
		if err != nil {
			return 0, "", err
		}
	} else if err != nil {
		return 0, "", err
	}

	var storedName, storedEmail, storedRole string
	if err := queryRowDB("SELECT name, email, role FROM users WHERE id = ?", userID).Scan(&storedName, &storedEmail, &storedRole); err != nil {
		return 0, "", err
	}
	if storedName != "" {
		name = storedName
	}
	if storedEmail != "" {
		email = storedEmail
	}
	if storedRole == "" {
		storedRole = "user"
	}

	// Generar JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{
		UserID:     userID,
		Name:       name,
		Email:      email,
		Role:       storedRole,
		Picture:    picture,
		GivenName:  givenName,
		FamilyName: familyName,
		Locale:     locale,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})

	tokenString, err := token.SignedString(getJWTKey())
	if err != nil {
		return 0, "", err
	}

	return userID, tokenString, nil
}

// oauthSuccessHandler - legacy handler, not used by mobile app
// Mobile apps redirect directly from callback handler
func oauthSuccessHandler(c *gin.Context) {
	token := c.Query("token")

	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no token provided"})
		return
	}

	// Return token as JSON for web clients
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   token,
		"message": "Authentication successful! You can close this window.",
	})
}

// getLastOAuthTokenHandler returns the last generated OAuth token
// The app calls this after openAuthSessionAsync returns to get the token
func getLastOAuthTokenHandler(c *gin.Context) {
	tokensMutex.Lock()
	defer tokensMutex.Unlock()

	token, exists := oauthTokens["last_token"]
	expiry, expiryExists := oauthTokens["last_token_expiry"]

	if !exists || !expiryExists {
		c.JSON(http.StatusNotFound, gin.H{"error": "no token available"})
		return
	}

	// Check if token is still valid
	var expiryTime int64
	fmt.Sscanf(expiry, "%d", &expiryTime)
	if time.Now().Unix() > expiryTime {
		// Token expired, delete it
		delete(oauthTokens, "last_token")
		delete(oauthTokens, "last_token_expiry")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token expired"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}
