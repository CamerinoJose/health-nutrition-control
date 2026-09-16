package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	_ "github.com/joho/godotenv/autoload"
	"github.com/ledongthuc/pdf"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// Simple password reset for test users (no email verification)
func resetPasswordHandler(c *gin.Context) {
	var req struct {
		Email       string `json:"email" binding:"required"`
		NewPassword string `json:"newPassword" binding:"required"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "datos inválidos"})
		return
	}
	var userID int
	err := db.QueryRow(`SELECT id FROM users WHERE email = ?`, req.Email).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "usuario no encontrado"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo actualizar la contraseña"})
		return
	}
	_, err = db.Exec(`UPDATE users SET password = ? WHERE id = ?`, string(hash), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo actualizar la contraseña"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "contraseña actualizada"})
}

var db *sql.DB
var jwtKey []byte

type PushToken struct {
	ID         int    `json:"id"`
	UserID     int    `json:"user_id"`
	Token      string `json:"token"`
	DeviceType string `json:"device_type"`
	CreatedAt  string `json:"created_at"`
}

func getJWTKey() []byte {
	key := os.Getenv("JWT_SECRET")
	if key == "" {
		log.Println("[WARNING] JWT_SECRET environment variable not set; using development fallback")
		key = "desarrollo_clave_temporal_cambiar_en_produccion"
	}
	return []byte(key)
}

func getenvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envCSV(key string) []string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return nil
	}
	parts := strings.Split(val, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

type User struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"-"`
	Role     string `json:"role"` // user or admin
}

type Claims struct {
	UserID     int    `json:"user_id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Role       string `json:"role"`
	Picture    string `json:"picture"`
	GivenName  string `json:"given_name"`
	FamilyName string `json:"family_name"`
	Locale     string `json:"locale"`
	jwt.RegisteredClaims
}

type HistoryEntry struct {
	ID               int     `json:"id"`
	UserID           int     `json:"user_id"`
	Date             string  `json:"date"`
	Weight           float64 `json:"weight"`
	FatPercentage    float64 `json:"fat_percentage"`
	MusclePercentage float64 `json:"muscle_percentage"`
}

type MealPlan struct {
	ID        int    `json:"id"`
	UserID    int    `json:"user_id"`
	Name      string `json:"name"`
	StartDate string `json:"start_date"`
	Snacks    string `json:"snacks"`
	CreatedAt string `json:"created_at"`
}

type PlanMeal struct {
	ID          int    `json:"id"`
	PlanID      int    `json:"plan_id"`
	DayOfWeek   string `json:"day_of_week"`
	MealType    string `json:"meal_type"`
	Name        string `json:"name"`
	Ingredients string `json:"ingredients"`
	Preparation string `json:"preparation"`
}

type FoodLog struct {
	ID        int    `json:"id"`
	UserID    int    `json:"user_id"`
	Date      string `json:"date"`
	MealType  string `json:"meal_type"`
	Completed bool   `json:"completed"`
	Notes     string `json:"notes"`
}

type Medicine struct {
	ID     int    `json:"id"`
	UserID int    `json:"user_id"`
	Name   string `json:"name"`
	Time   string `json:"time"`
	Taken  bool   `json:"taken"`
}

type MedicineHistory struct {
	ID         int    `json:"id"`
	MedicineID int    `json:"medicine_id"`
	Name       string `json:"name"`
	TakenDate  string `json:"taken_date"`
	TakenAt    string `json:"taken_at"`
}

type OCRResult struct {
	Name             string  `json:"name"`
	Height           float64 `json:"height"`
	Age              int     `json:"age"`
	Sex              string  `json:"sex"`
	Weight           float64 `json:"weight"`
	FatPercentage    float64 `json:"fat_percentage"`
	MusclePercentage float64 `json:"muscle_percentage"`
	Confidence       string  `json:"confidence"`
}

// appointmentReminderWorker checks for upcoming appointments every hour and creates reminders
func appointmentReminderWorker() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	// Run immediately on startup
	checkUpcomingAppointments()

	for range ticker.C {
		checkUpcomingAppointments()
	}
}

func checkUpcomingAppointments() {
	log.Println("[Reminders] Checking for upcoming appointments...")

	// Get appointments in the next 24 hours that haven't been reminded
	tomorrow := time.Now().Add(24 * time.Hour)
	tomorrowDate := tomorrow.Format("2006-01-02")

	rows, err := db.Query(`
		SELECT a.id, a.user_id, a.title, a.appointment_date, a.appointment_time
		FROM appointments a
		WHERE a.appointment_date = ?
		AND a.status = 'scheduled'
		AND a.is_archived = 0
		AND NOT EXISTS (
			SELECT 1 FROM notifications n
			WHERE n.user_id = a.user_id
			AND n.type = 'appointment_reminder'
			AND n.related_id = a.id
			AND datetime(n.created_at) >= datetime('now', '-24 hours')
		)
	`, tomorrowDate)

	if err != nil {
		log.Printf("[Reminders] Error querying appointments: %v", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var aptID, userID int
		var title, aptDate, aptTime string

		if err := rows.Scan(&aptID, &userID, &title, &aptDate, &aptTime); err != nil {
			continue
		}

		// Create reminder notification
		message := fmt.Sprintf("Recordatorio: Tienes una cita mañana '%s' el %s a las %s", title, aptDate, aptTime)
		_, err = db.Exec(`
			INSERT INTO notifications (user_id, type, title, message, related_id, is_read, created_at)
			VALUES (?, 'appointment_reminder', 'Recordatorio de Cita', ?, ?, 0, datetime('now'))
		`, userID, message, aptID)

		if err != nil {
			log.Printf("[Reminders] Error creating notification: %v", err)
		} else {
			count++
			log.Printf("[Reminders] Created reminder for user %d, appointment %d", userID, aptID)
		}
	}

	if count > 0 {
		log.Printf("[Reminders] Created %d appointment reminders", count)
	} else {
		log.Println("[Reminders] No new reminders needed")
	}
}

func main() {
	jwtKey = getJWTKey()
	var err error

	// Check if we should use SQLite (for local development)
	useSQLite := os.Getenv("USE_SQLITE")
	dbPath := getenvOrDefault("DB_PATH", "./data.db")

	if useSQLite == "true" {
		// SQLite mode (local development)
		log.Printf("🔧 Using SQLite database: %s", dbPath)
		db, err = sql.Open("sqlite", dbPath)
		if err != nil {
			log.Fatalf("Error connecting to SQLite: %v", err)
		}
		err = db.Ping()
		if err != nil {
			log.Fatalf("SQLite ping failed: %v", err)
		}
		log.Println("✅ Successfully connected to SQLite database!")

		// SQLite foreign keys support
		_, err = db.Exec("PRAGMA foreign_keys = ON")
		if err != nil {
			log.Fatal("Failed to enable foreign keys: ", err)
		}

	} else {
		// PostgreSQL mode (production) with SQLite fallback
		pgUser := getenvOrDefault("POSTGRES_USER", "postgres")
		pgPass := os.Getenv("POSTGRES_PASSWORD")
		pgDB := getenvOrDefault("POSTGRES_DB", "bienestar")
		pgHost := getenvOrDefault("POSTGRES_HOST", "localhost")
		pgSSL := getenvOrDefault("POSTGRES_SSLMODE", "disable")
		connStr := fmt.Sprintf("user=%s password=%s dbname=%s host=%s sslmode=%s", pgUser, pgPass, pgDB, pgHost, pgSSL)

		log.Printf("🐘 Connecting to PostgreSQL: %s@%s/%s", pgUser, pgHost, pgDB)
		db, err = sql.Open("postgres", connStr)
		if err == nil {
			err = db.Ping()
		}

		if err != nil {
			log.Printf("⚠️ PostgreSQL unavailable (%v). Falling back to SQLite at %s", err, dbPath)
			useSQLite = "true"
			db, err = sql.Open("sqlite", dbPath)
			if err != nil {
				log.Fatalf("Error connecting to SQLite fallback: %v", err)
			}
			err = db.Ping()
			if err != nil {
				log.Fatalf("SQLite fallback ping failed: %v", err)
			}
			_, err = db.Exec("PRAGMA foreign_keys = ON")
			if err != nil {
				log.Fatal("Failed to enable foreign keys: ", err)
			}
			log.Println("✅ Successfully connected to SQLite fallback database!")
		} else {
			log.Println("✅ Successfully connected to PostgreSQL database!")
		}
	}

	// Migración de tabla medicines
	if useSQLite == "true" {
		_, err = db.Exec(`CREATE TABLE IF NOT EXISTS medicines (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER,
			name TEXT,
			time TEXT,
			taken INTEGER DEFAULT 0
		)`)
		if err == nil {
			_, err = db.Exec(`CREATE TABLE IF NOT EXISTS medicine_logs (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				medicine_id INTEGER NOT NULL,
				taken_date TEXT NOT NULL,
				taken_at TEXT NOT NULL,
				FOREIGN KEY(medicine_id) REFERENCES medicines(id)
			)`)
		}
	} else {
		_, err = db.Exec(`CREATE TABLE IF NOT EXISTS medicines (
			id SERIAL PRIMARY KEY,
			user_id INTEGER,
			name TEXT,
			time TEXT,
			taken BOOLEAN DEFAULT FALSE
		)`)
		if err == nil {
			_, err = db.Exec(`CREATE TABLE IF NOT EXISTS medicine_logs (
				id SERIAL PRIMARY KEY,
				user_id INTEGER NOT NULL,
				medicine_id INTEGER NOT NULL,
				taken_date TEXT NOT NULL,
				taken_at TEXT NOT NULL,
				FOREIGN KEY(medicine_id) REFERENCES medicines(id)
			)`)
		}
	}
	if err != nil {
		log.Fatal("No se pudieron crear las tablas de medicinas: ", err)
	}

	if err := migrate(useSQLite == "true"); err != nil {
		log.Fatal(err)
	}

	if err := seedRecipes(); err != nil {
		log.Printf("Warning: Failed to seed recipes: %v", err)
	}

	if err := seedDefaultUsers(); err != nil {
		log.Printf("Warning: Failed to seed default users: %v", err)
	}

	// Start a goroutine to check for upcoming appointments and send reminders
	go appointmentReminderWorker()

	r := gin.Default()
	_ = r.SetTrustedProxies([]string{"127.0.0.1"})

	// Middleware para asegurar UTF-8 en todas las respuestas
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Content-Type", "application/json; charset=utf-8")
		c.Next()
	})

	// CORS for frontend dev (Vite at 5173) and general OPTIONS preflight handling
	defaultOrigins := []string{
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://localhost:5174",
		"http://127.0.0.1:5174",
		"https://health-nutrition-control-web.onrender.com",
	}

	allowAll := strings.TrimSpace(os.Getenv("CORS_ALLOW_ALL")) == "1"
	extraOrigins := envCSV("CORS_ALLOWED_ORIGINS")
	allowedOrigins := defaultOrigins
	if len(extraOrigins) > 0 {
		allowedOrigins = append(allowedOrigins, extraOrigins...)
	}
	allowedOrigins = append(allowedOrigins, localPreviewOrigins()...)

	corsCfg := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}
	if allowAll {
		corsCfg.AllowAllOrigins = true
	} else {
		corsCfg.AllowOrigins = allowedOrigins
	}

	r.Use(cors.New(corsCfg))

	// Health check endpoint (no auth required)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "healthy",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	api := r.Group("/api")
	{
		// Health check for API
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":  "healthy",
				"service": "bienestarapp-api",
				"time":    time.Now().Format(time.RFC3339),
			})
		})

		api.POST("/register", registerHandler)
		api.POST("/login", loginHandler)
		api.POST("/reset-password", resetPasswordHandler)

		// OAuth routes
		api.GET("/auth/google", oauthInitHandler("google"))
		api.GET("/auth/google/callback", oauthCallbackHandler("google"))
		api.GET("/auth/google/success", oauthSuccessHandler)
		api.GET("/auth/last-token", getLastOAuthTokenHandler)
		api.GET("/auth/facebook", oauthInitHandler("facebook"))
		api.GET("/auth/facebook/callback", oauthCallbackHandler("facebook"))
		api.GET("/auth/facebook/success", oauthSuccessHandler)
		api.GET("/auth/github", oauthInitHandler("github"))
		api.GET("/auth/github/callback", oauthCallbackHandler("github"))
		api.GET("/auth/github/success", oauthSuccessHandler)

		auth := api.Group("")
		auth.Use(authMiddleware())
		{
			// Medicines CRUD + daily history endpoints
			auth.GET("/medicines", func(c *gin.Context) {
				userID := getUserIDFromContext(c)
				today := time.Now().Format("2006-01-02")
				rows, err := db.Query(`
					SELECT m.id, m.user_id, m.name, m.time, d.taken_at
					FROM medicines m
					LEFT JOIN (
						SELECT medicine_id, MAX(taken_at) AS taken_at
						FROM medicine_logs
						WHERE user_id = ? AND taken_date = ?
						GROUP BY medicine_id
					) d ON d.medicine_id = m.id
					WHERE m.user_id = ?
					ORDER BY m.id DESC
				`, userID, today, userID)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al consultar medicinas"})
					return
				}
				defer rows.Close()
				var meds []Medicine
				for rows.Next() {
					var m Medicine
					var takenAt sql.NullString
					if err := rows.Scan(&m.ID, &m.UserID, &m.Name, &m.Time, &takenAt); err == nil {
						m.Taken = takenAt.Valid && takenAt.String != ""
						meds = append(meds, m)
					}
				}
				c.JSON(http.StatusOK, meds)
			})

			auth.GET("/medicines/history", func(c *gin.Context) {
				userID := getUserIDFromContext(c)
				rows, err := db.Query(`
					SELECT l.id, l.medicine_id, m.name, l.taken_date, l.taken_at
					FROM medicine_logs l
					JOIN medicines m ON m.id = l.medicine_id
					WHERE l.user_id = ?
					ORDER BY l.taken_at DESC
					LIMIT 100
				`, userID)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al consultar historial de medicinas"})
					return
				}
				defer rows.Close()

				var history []MedicineHistory
				for rows.Next() {
					var h MedicineHistory
					if err := rows.Scan(&h.ID, &h.MedicineID, &h.Name, &h.TakenDate, &h.TakenAt); err == nil {
						history = append(history, h)
					}
				}

				c.JSON(http.StatusOK, history)
			})

			auth.POST("/medicines", func(c *gin.Context) {
				userID := getUserIDFromContext(c)
				var req Medicine
				if err := c.BindJSON(&req); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
					return
				}
				_, err := db.Exec("INSERT INTO medicines (user_id, name, time, taken) VALUES (?, ?, ?, 0)", userID, req.Name, req.Time)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo agregar medicina"})
					return
				}
				c.JSON(http.StatusOK, gin.H{"message": "Medicina agregada"})
			})

			auth.PUT("/medicines/:id", func(c *gin.Context) {
				userID := getUserIDFromContext(c)
				id := c.Param("id")
				var req Medicine
				if err := c.BindJSON(&req); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
					return
				}

				_, err := db.Exec("UPDATE medicines SET name = ?, time = ? WHERE id = ? AND user_id = ?", req.Name, req.Time, id, userID)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo actualizar medicina"})
					return
				}

				today := time.Now().Format("2006-01-02")
				now := time.Now().Format(time.RFC3339)

				if req.Taken {
					_, _ = db.Exec("DELETE FROM medicine_logs WHERE user_id = ? AND medicine_id = ? AND taken_date = ?", userID, id, today)
					_, err = db.Exec("INSERT INTO medicine_logs (user_id, medicine_id, taken_date, taken_at) VALUES (?, ?, ?, ?)", userID, id, today, now)
					if err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo registrar la toma de hoy"})
						return
					}
				} else {
					_, _ = db.Exec("DELETE FROM medicine_logs WHERE user_id = ? AND medicine_id = ? AND taken_date = ?", userID, id, today)
				}

				c.JSON(http.StatusOK, gin.H{"message": "Medicina actualizada"})
			})

			auth.DELETE("/medicines/:id", func(c *gin.Context) {
				userID := getUserIDFromContext(c)
				id := c.Param("id")
				_, err := db.Exec("DELETE FROM medicines WHERE id = ? AND user_id = ?", id, userID)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo eliminar medicina"})
					return
				}
				c.JSON(http.StatusOK, gin.H{"message": "Medicina eliminada"})
			})

			// ...existing code...
			auth.GET("/me", meHandler)
			auth.PUT("/me/profile", updateProfileHandler)
			auth.PUT("/me/contact", updateContactPhoneHandler)
			auth.POST("/history", createHistoryHandler)
			auth.GET("/history", listHistoryHandler)
			auth.POST("/ocr", ocrHandler)

			auth.POST("/health-profile", createHealthProfileHandler)
			auth.GET("/health-profile", getHealthProfileHandler)
			auth.PUT("/health-profile", updateHealthProfileHandler)

			auth.POST("/meal-plan/upload", uploadMealPlanHandler)
			auth.GET("/meal-plan", getMealPlanHandler)
			auth.POST("/food-log", createFoodLogHandler)
			auth.GET("/food-log", getFoodLogHandler)

			auth.PUT("/settings", updateSettingsHandler)
			auth.GET("/settings", getSettingsHandler)

			auth.POST("/appointments", createAppointmentHandler)
			auth.GET("/appointments", getAppointmentsHandler)
			auth.PUT("/appointments/:id", updateAppointmentHandler)
			auth.DELETE("/appointments/:id", deleteAppointmentHandler)
			auth.POST("/appointments/:id/archive", archiveAppointmentHandler)
			auth.POST("/appointments/:id/restore", restoreAppointmentHandler)

			auth.GET("/recipes", getRecipesHandler)
			auth.GET("/recipes/:id", getRecipeHandler)

			auth.POST("/messages", sendMessageHandler)
			auth.GET("/messages", getMessagesHandler)
			auth.GET("/messages/conversations", getConversationsHandler)
			auth.PUT("/messages/:id/read", markMessageAsReadHandler)
			auth.DELETE("/messages/:id", deleteMessageHandler)
			auth.GET("/messages/archived", getArchivedMessagesHandler)

			auth.GET("/nutritionists", listNutritionistsHandler)
			auth.POST("/assign-nutritionist", assignNutritionistHandler)
			auth.GET("/available-slots", getAvailableSlotsForUserHandler)

			auth.GET("/notifications", getNotificationsHandler)
			auth.PUT("/notifications/:id/read", markNotificationAsReadHandler)
			auth.PUT("/notifications/read-all", markAllNotificationsAsReadHandler)

			// Push notifications endpoints
			auth.POST("/push-token", registerPushTokenHandler)
			auth.DELETE("/push-token", deletePushTokenHandler)

			auth.GET("/appointment-changes/:appointment_id", getAppointmentChangesHandler)
			auth.PUT("/appointment-changes/:id/accept", acceptAppointmentChangeHandler)
			auth.PUT("/appointment-changes/:id/reject", rejectAppointmentChangeHandler)

			nutritionist := auth.Group("/nutritionist")
			nutritionist.Use(nutritionistOrAdminMiddleware())
			{
				nutritionist.GET("/patients", listPatientsHandler)
				nutritionist.GET("/patients/:id", getPatientDetailsHandler)
				nutritionist.GET("/patients/:id/history", getPatientHistoryHandler)
				nutritionist.POST("/recipes", createRecipeHandler)
				nutritionist.PUT("/recipes/:id", updateRecipeHandler)
				nutritionist.DELETE("/recipes/:id", deleteRecipeHandler)
				nutritionist.POST("/recommendations", createRecommendationHandler)
				nutritionist.GET("/recommendations/:patient_id", getRecommendationsHandler)
				nutritionist.GET("/appointments", getNutritionistAppointmentsHandler)
				nutritionist.PUT("/appointments/:id/notes", updateAppointmentNotesHandler)
				nutritionist.POST("/appointments/:id/propose-change", proposeAppointmentChangeHandler)
				nutritionist.GET("/availability", getNutritionistAvailabilityHandler)
				nutritionist.POST("/availability", setNutritionistAvailabilityHandler)
				nutritionist.GET("/available-slots", getAvailableSlotsHandler)
				nutritionist.POST("/patients/:id/meal-plan", createMealPlanForPatientHandler)
				nutritionist.GET("/patients/:id/meal-plan", getPatientMealPlanHandler)
			}

			admin := auth.Group("/admin")
			admin.Use(adminMiddleware())
			{
				admin.GET("/metrics", adminMetricsHandler)
				admin.GET("/users", listUsersHandler)
				admin.GET("/users/:id/history", userHistoryHandler)
				admin.PUT("/users/:id/role", updateUserRoleHandler)
				admin.DELETE("/users/:id", deleteUserHandler)
				admin.GET("/export", exportDataHandler)
			}
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	bindAddr := "0.0.0.0:" + port
	log.Printf("Server running on %s", bindAddr)
	if err := r.Run(bindAddr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func migrate(useSQLite bool) error {
	var queries []string
	if useSQLite {
		queries = []string{
			`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT, nutritionist_id INTEGER, phone TEXT, contact_preference TEXT);`,
			`CREATE TABLE IF NOT EXISTS histories (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, date TEXT, weight DOUBLE PRECISION, fat_percentage DOUBLE PRECISION, muscle_percentage DOUBLE PRECISION, FOREIGN KEY(user_id) REFERENCES users(id));`,
			`CREATE TABLE IF NOT EXISTS meal_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, start_date TEXT, snacks TEXT, created_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id));`,
			`CREATE TABLE IF NOT EXISTS plan_meals (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER, day_of_week TEXT, meal_type TEXT, name TEXT, ingredients TEXT, preparation TEXT, FOREIGN KEY(plan_id) REFERENCES meal_plans(id));`,
			`CREATE TABLE IF NOT EXISTS food_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, date TEXT, meal_type TEXT, completed BOOLEAN, notes TEXT, UNIQUE(user_id, date, meal_type), FOREIGN KEY(user_id) REFERENCES users(id));`,
			`CREATE TABLE IF NOT EXISTS user_settings (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER UNIQUE,
				meal_times TEXT,
				reminder_settings TEXT,
				enable_reminders BOOLEAN DEFAULT FALSE,
				FOREIGN KEY(user_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS appointments (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER,
				nutritionist_id INTEGER,
				title TEXT,
				description TEXT,
				appointment_date TEXT,
				appointment_time TEXT,
				status TEXT DEFAULT 'scheduled',
				notes TEXT,
				is_archived BOOLEAN DEFAULT FALSE,
				created_at TEXT,
				FOREIGN KEY(user_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS recipes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				category TEXT,
				prep_time INTEGER,
				servings INTEGER,
				calories INTEGER,
				protein DOUBLE PRECISION,
				carbs DOUBLE PRECISION,
				fat DOUBLE PRECISION,
				ingredients TEXT,
				instructions TEXT,
				image_url TEXT,
				created_at TEXT
			);`,
			`CREATE TABLE IF NOT EXISTS messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				sender_id INTEGER,
				recipient_id INTEGER,
				content TEXT NOT NULL,
				is_read BOOLEAN DEFAULT FALSE,
				created_at TEXT,
				FOREIGN KEY(sender_id) REFERENCES users(id),
				FOREIGN KEY(recipient_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS deleted_messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				message_id INTEGER NOT NULL,
				created_at TEXT,
				UNIQUE(user_id, message_id),
				FOREIGN KEY(user_id) REFERENCES users(id),
				FOREIGN KEY(message_id) REFERENCES messages(id)
			);`,
			`CREATE TABLE IF NOT EXISTS health_profiles (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER UNIQUE,
				age INTEGER,
				sex TEXT,
				height DOUBLE PRECISION,
				current_weight DOUBLE PRECISION,
				goal_weight DOUBLE PRECISION,
				waist_circumference DOUBLE PRECISION,
				medical_conditions TEXT,
				medications TEXT,
				allergies TEXT,
				glucose_fasting DOUBLE PRECISION,
				hba1c DOUBLE PRECISION,
				cholesterol_total DOUBLE PRECISION,
				cholesterol_ldl DOUBLE PRECISION,
				cholesterol_hdl DOUBLE PRECISION,
				triglycerides DOUBLE PRECISION,
				activity_level TEXT,
				meal_schedule TEXT,
				sleep_hours DOUBLE PRECISION,
				goals TEXT,
				updated_at TEXT,
				FOREIGN KEY(user_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS appointment_changes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				appointment_id INTEGER NOT NULL,
				proposed_by INTEGER NOT NULL,
				new_date TEXT NOT NULL,
				new_time TEXT NOT NULL,
				reason TEXT,
				status TEXT DEFAULT 'pending',
				created_at TEXT,
				responded_at TEXT,
				FOREIGN KEY(appointment_id) REFERENCES appointments(id),
				FOREIGN KEY(proposed_by) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS notifications (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				type TEXT NOT NULL,
				title TEXT NOT NULL,
				message TEXT NOT NULL,
				related_id INTEGER,
				is_read BOOLEAN DEFAULT FALSE,
				created_at TEXT,
				FOREIGN KEY(user_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS nutritionist_availability (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				nutritionist_id INTEGER NOT NULL,
				day_of_week INTEGER NOT NULL,
				start_time TEXT NOT NULL,
				end_time TEXT NOT NULL,
				is_available BOOLEAN DEFAULT TRUE,
				FOREIGN KEY(nutritionist_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS recommendations (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				patient_id INTEGER NOT NULL,
				nutritionist_id INTEGER NOT NULL,
				appointment_id INTEGER,
				recommendation_text TEXT,
				diet_changes TEXT,
				exercise_plan TEXT,
				next_goals TEXT,
				created_at TEXT,
				FOREIGN KEY(patient_id) REFERENCES users(id),
				FOREIGN KEY(nutritionist_id) REFERENCES users(id),
				FOREIGN KEY(appointment_id) REFERENCES appointments(id)
			);`,
			`CREATE TABLE IF NOT EXISTS push_tokens (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				token TEXT NOT NULL UNIQUE,
				device_type TEXT,
				created_at TEXT,
				FOREIGN KEY(user_id) REFERENCES users(id)
			);`,
		}
	} else {
		queries = []string{
			`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT, nutritionist_id INTEGER, phone TEXT, contact_preference TEXT);`,
			`CREATE TABLE IF NOT EXISTS histories (id SERIAL PRIMARY KEY, user_id INTEGER, date TEXT, weight DOUBLE PRECISION, fat_percentage DOUBLE PRECISION, muscle_percentage DOUBLE PRECISION, FOREIGN KEY(user_id) REFERENCES users(id));`,
			`CREATE TABLE IF NOT EXISTS meal_plans (id SERIAL PRIMARY KEY, user_id INTEGER, name TEXT, start_date TEXT, snacks TEXT, created_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id));`,
			`CREATE TABLE IF NOT EXISTS plan_meals (id SERIAL PRIMARY KEY, plan_id INTEGER, day_of_week TEXT, meal_type TEXT, name TEXT, ingredients TEXT, preparation TEXT, FOREIGN KEY(plan_id) REFERENCES meal_plans(id));`,
			`CREATE TABLE IF NOT EXISTS food_logs (id SERIAL PRIMARY KEY, user_id INTEGER, date TEXT, meal_type TEXT, completed BOOLEAN, notes TEXT, UNIQUE(user_id, date, meal_type), FOREIGN KEY(user_id) REFERENCES users(id));`,
			`CREATE TABLE IF NOT EXISTS user_settings (
				id SERIAL PRIMARY KEY,
				user_id INTEGER UNIQUE,
				meal_times TEXT,
				reminder_settings TEXT,
				enable_reminders BOOLEAN DEFAULT FALSE,
				FOREIGN KEY(user_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS appointments (
				id SERIAL PRIMARY KEY,
				user_id INTEGER,
				nutritionist_id INTEGER,
				title TEXT,
				description TEXT,
				appointment_date TEXT,
				appointment_time TEXT,
				status TEXT DEFAULT 'scheduled',
				notes TEXT,
				is_archived BOOLEAN DEFAULT FALSE,
				created_at TEXT,
				FOREIGN KEY(user_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS recipes (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				category TEXT,
				prep_time INTEGER,
				servings INTEGER,
				calories INTEGER,
				protein DOUBLE PRECISION,
				carbs DOUBLE PRECISION,
				fat DOUBLE PRECISION,
				ingredients TEXT,
				instructions TEXT,
				image_url TEXT,
				created_at TEXT
			);`,
			`CREATE TABLE IF NOT EXISTS messages (
				id SERIAL PRIMARY KEY,
				sender_id INTEGER,
				recipient_id INTEGER,
				content TEXT NOT NULL,
				is_read BOOLEAN DEFAULT FALSE,
				created_at TEXT,
				FOREIGN KEY(sender_id) REFERENCES users(id),
				FOREIGN KEY(recipient_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS deleted_messages (
				id SERIAL PRIMARY KEY,
				user_id INTEGER NOT NULL,
				message_id INTEGER NOT NULL,
				created_at TEXT,
				UNIQUE(user_id, message_id),
				FOREIGN KEY(user_id) REFERENCES users(id),
				FOREIGN KEY(message_id) REFERENCES messages(id)
			);`,
			`CREATE TABLE IF NOT EXISTS health_profiles (
				id SERIAL PRIMARY KEY,
				user_id INTEGER UNIQUE,
				age INTEGER,
				sex TEXT,
				height DOUBLE PRECISION,
				current_weight DOUBLE PRECISION,
				goal_weight DOUBLE PRECISION,
				waist_circumference DOUBLE PRECISION,
				medical_conditions TEXT,
				medications TEXT,
				allergies TEXT,
				glucose_fasting DOUBLE PRECISION,
				hba1c DOUBLE PRECISION,
				cholesterol_total DOUBLE PRECISION,
				cholesterol_ldl DOUBLE PRECISION,
				cholesterol_hdl DOUBLE PRECISION,
				triglycerides DOUBLE PRECISION,
				activity_level TEXT,
				meal_schedule TEXT,
				sleep_hours DOUBLE PRECISION,
				goals TEXT,
				updated_at TEXT,
				FOREIGN KEY(user_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS appointment_changes (
				id SERIAL PRIMARY KEY,
				appointment_id INTEGER NOT NULL,
				proposed_by INTEGER NOT NULL,
				new_date TEXT NOT NULL,
				new_time TEXT NOT NULL,
				reason TEXT,
				status TEXT DEFAULT 'pending',
				created_at TEXT,
				responded_at TEXT,
				FOREIGN KEY(appointment_id) REFERENCES appointments(id),
				FOREIGN KEY(proposed_by) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS notifications (
				id SERIAL PRIMARY KEY,
				user_id INTEGER NOT NULL,
				type TEXT NOT NULL,
				title TEXT NOT NULL,
				message TEXT NOT NULL,
				related_id INTEGER,
				is_read BOOLEAN DEFAULT FALSE,
				created_at TEXT,
				FOREIGN KEY(user_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS nutritionist_availability (
				id SERIAL PRIMARY KEY,
				nutritionist_id INTEGER NOT NULL,
				day_of_week INTEGER NOT NULL,
				start_time TEXT NOT NULL,
				end_time TEXT NOT NULL,
				is_available BOOLEAN DEFAULT TRUE,
				FOREIGN KEY(nutritionist_id) REFERENCES users(id)
			);`,
			`CREATE TABLE IF NOT EXISTS recommendations (
				id SERIAL PRIMARY KEY,
				patient_id INTEGER NOT NULL,
				nutritionist_id INTEGER NOT NULL,
				appointment_id INTEGER,
				recommendation_text TEXT,
				diet_changes TEXT,
				exercise_plan TEXT,
				next_goals TEXT,
				created_at TEXT,
				FOREIGN KEY(patient_id) REFERENCES users(id),
				FOREIGN KEY(nutritionist_id) REFERENCES users(id),
				FOREIGN KEY(appointment_id) REFERENCES appointments(id)
			);`,
			`CREATE TABLE IF NOT EXISTS push_tokens (
				id SERIAL PRIMARY KEY,
				user_id INTEGER NOT NULL,
				token TEXT NOT NULL UNIQUE,
				device_type TEXT,
				created_at TEXT,
				FOREIGN KEY(user_id) REFERENCES users(id)
			);`,
		}
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}

	// Add snacks column to existing meal_plans table (migration)
	db.Exec(`ALTER TABLE meal_plans ADD COLUMN snacks TEXT;`)

	// Add nutritionist_id column to users table if it doesn't exist
	db.Exec(`ALTER TABLE users ADD COLUMN nutritionist_id INTEGER;`)
	db.Exec(`ALTER TABLE users ADD COLUMN phone TEXT;`)
	db.Exec(`ALTER TABLE users ADD COLUMN contact_preference TEXT;`)

	// Add nutritionist_id column to appointments table if it doesn't exist
	db.Exec(`ALTER TABLE appointments ADD COLUMN nutritionist_id INTEGER;`)

	// Add reminder_settings column to existing user_settings table (migration)
	db.Exec(`ALTER TABLE user_settings ADD COLUMN reminder_settings TEXT;`)

	var socialErr error
	if useSQLite {
		_, socialErr = db.Exec(`CREATE TABLE IF NOT EXISTS social_accounts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			provider TEXT NOT NULL,
			provider_user_id TEXT NOT NULL,
			email TEXT,
			name TEXT,
			avatar_url TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id),
			UNIQUE(provider, provider_user_id)
		)`)
	} else {
		_, socialErr = db.Exec(`CREATE TABLE IF NOT EXISTS social_accounts (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			provider TEXT NOT NULL,
			provider_user_id TEXT NOT NULL,
			email TEXT,
			name TEXT,
			avatar_url TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id),
			UNIQUE(provider, provider_user_id)
		)`)
	}
	if socialErr != nil {
		return socialErr
	}

	var auditErr error
	if useSQLite {
		_, auditErr = db.Exec(`CREATE TABLE IF NOT EXISTS admin_audit_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			admin_user_id INTEGER NOT NULL,
			action TEXT NOT NULL,
			target_user_id INTEGER,
			created_at TEXT NOT NULL,
			FOREIGN KEY(admin_user_id) REFERENCES users(id)
		)`)
	} else {
		_, auditErr = db.Exec(`CREATE TABLE IF NOT EXISTS admin_audit_logs (
			id SERIAL PRIMARY KEY,
			admin_user_id INTEGER NOT NULL,
			action TEXT NOT NULL,
			target_user_id INTEGER,
			created_at TEXT NOT NULL,
			FOREIGN KEY(admin_user_id) REFERENCES users(id)
		)`)
	}
	if auditErr != nil {
		return auditErr
	}

	log.Println("✅ Database migration completed successfully")
	return nil
}

// --- Handlers ---

func registerHandler(c *gin.Context) {
	var req struct {
		Name     string `json:"name" binding:"required"`
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "datos inválidos"})
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	res, err := db.Exec(`INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)`, req.Name, req.Email, string(hash), "user")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no se pudo crear el usuario (email puede estar en uso)"})
		return
	}
	id, _ := res.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"id": id, "email": req.Email})
}

func loginHandler(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "datos inválidos"})
		return
	}

	log.Printf("[Login] Attempting login for: %s", req.Email)

	var u User
	row := db.QueryRow(`SELECT id,name,email,password,role FROM users WHERE email = ?`, req.Email)
	if err := row.Scan(&u.ID, &u.Name, &u.Email, &u.Password, &u.Role); err != nil {
		log.Printf("[Login] User not found or scan error: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "credenciales inválidas"})
		return
	}

	log.Printf("[Login] User found: %s (ID: %d, Role: %s)", u.Name, u.ID, u.Role)

	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)); err != nil {
		log.Printf("[Login] Password mismatch: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "credenciales inválidas"})
		return
	}

	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID: u.ID,
		Name:   u.Name,
		Email:  u.Email,
		Role:   u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := token.SignedString(jwtKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo generar token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": s})
}

func meHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	// Get user settings (may not exist yet)
	var mealTimesJSON string
	var enableReminders bool
	var mealTimes map[string]string

	if err := db.QueryRow(`
		SELECT meal_times, enable_reminders
		FROM user_settings
		WHERE user_id = ?
	`, claims.UserID).Scan(&mealTimesJSON, &enableReminders); err == nil {
		json.Unmarshal([]byte(mealTimesJSON), &mealTimes)
	} else {
		mealTimes = map[string]string{
			"breakfast": "08:00",
			"lunch":     "14:00",
			"dinner":    "20:00",
			"snack":     "16:00",
		}
		enableReminders = false
	}

	// Get nutritionist info separately so it works even if user_settings is missing
	var nutritionistID sql.NullInt64
	var nutritionistName sql.NullString
	var nutritionistEmail sql.NullString
	var phone sql.NullString
	var contactPreference sql.NullString
	err := db.QueryRow(`
		SELECT u.nutritionist_id, n.name, n.email, u.phone, u.contact_preference
		FROM users u
		LEFT JOIN users n ON u.nutritionist_id = n.id
		WHERE u.id = ?
	`, claims.UserID).Scan(&nutritionistID, &nutritionistName, &nutritionistEmail, &phone, &contactPreference)

	if err != nil && err != sql.ErrNoRows {
		log.Printf("[Me] Error scanning nutritionist: %v", err)
	}

	response := gin.H{
		"user_id":            claims.UserID,
		"name":               claims.Name,
		"email":              claims.Email,
		"role":               claims.Role,
		"picture":            claims.Picture,
		"given_name":         claims.GivenName,
		"family_name":        claims.FamilyName,
		"locale":             claims.Locale,
		"phone":              phone.String,
		"contact_preference": contactPreference.String,
		"meal_times":         mealTimes,
		"enable_reminders":   enableReminders,
	}

	// Add nutritionist info if assigned
	if nutritionistID.Valid && nutritionistID.Int64 > 0 {
		response["nutritionist_id"] = nutritionistID.Int64
		if nutritionistName.Valid {
			response["nutritionist_name"] = nutritionistName.String
		}
		if nutritionistEmail.Valid {
			response["nutritionist_email"] = nutritionistEmail.String
		}
	}

	c.JSON(http.StatusOK, response)
}

func updateContactPhoneHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	var request struct {
		Name              string `json:"name"`
		Phone             string `json:"phone"`
		ContactPreference string `json:"contact_preference"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "datos de contacto inválidos"})
		return
	}

	phone := strings.TrimSpace(request.Phone)
	name := strings.TrimSpace(request.Name)
	preference := strings.TrimSpace(request.ContactPreference)
	if preference != "app" && preference != "phone" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "elige cómo prefieres que nos comuniquemos contigo"})
		return
	}
	if preference == "phone" && phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "el teléfono es obligatorio para esta preferencia"})
		return
	}
	if len(phone) > 30 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "el teléfono no puede superar 30 caracteres"})
		return
	}
	if len(name) > 120 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "el nombre no puede superar 120 caracteres"})
		return
	}

	query := `UPDATE users SET phone = ?, contact_preference = ?`
	args := []interface{}{phone, preference}
	if name != "" {
		query += `, name = ?`
		args = append(args, name)
	}
	query += ` WHERE id = ?`
	args = append(args, claims.UserID)
	if _, err := db.Exec(query, args...); err != nil {
		log.Printf("[Contact] Error updating phone for user %d: %v", claims.UserID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo guardar el teléfono"})
		return
	}

	var savedName string
	if err := db.QueryRow(`SELECT name FROM users WHERE id = ?`, claims.UserID).Scan(&savedName); err != nil {
		log.Printf("[Contact] Error reading updated name for user %d: %v", claims.UserID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudieron leer los datos actualizados"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"name":               savedName,
		"phone":              phone,
		"contact_preference": preference,
	})
}

func updateProfileHandler(c *gin.Context) {
	updateContactPhoneHandler(c)
}

func createHistoryHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	var req struct {
		Date             string  `json:"date" binding:"required"`
		Weight           float64 `json:"weight"`
		FatPercentage    float64 `json:"fat_percentage"`
		MusclePercentage float64 `json:"muscle_percentage"`
	}
	if err := c.BindJSON(&req); err != nil {
		log.Printf("[History] Error binding JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "datos inválidos"})
		return
	}
	log.Printf("[History] Saving data for user %d: date=%s, weight=%.2f, fat=%.2f, muscle=%.2f",
		claims.UserID, req.Date, req.Weight, req.FatPercentage, req.MusclePercentage)
	_, err := db.Exec(`INSERT INTO histories (user_id,date,weight,fat_percentage,muscle_percentage) VALUES (?,?,?,?,?)`,
		claims.UserID, req.Date, req.Weight, req.FatPercentage, req.MusclePercentage)
	if err != nil {
		log.Printf("[History] Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo guardar historial"})
		return
	}
	log.Printf("[History] Data saved successfully for user %d", claims.UserID)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func listHistoryHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	rows, err := db.Query(`SELECT id,user_id,date,weight,fat_percentage,muscle_percentage FROM histories WHERE user_id = ? ORDER BY date DESC`, claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al leer historiales"})
		return
	}
	defer rows.Close()
	var out []HistoryEntry
	for rows.Next() {
		var entry HistoryEntry
		rows.Scan(&entry.ID, &entry.UserID, &entry.Date, &entry.Weight, &entry.FatPercentage, &entry.MusclePercentage)
		out = append(out, entry)
	}
	c.JSON(http.StatusOK, out)
}

// HealthProfile represents a user's complete health profile
type HealthProfile struct {
	ID                 int     `json:"id"`
	UserID             int     `json:"user_id"`
	Age                int     `json:"age"`
	Sex                string  `json:"sex"`
	Height             float64 `json:"height"`
	CurrentWeight      float64 `json:"current_weight"`
	GoalWeight         float64 `json:"goal_weight"`
	WaistCircumference float64 `json:"waist_circumference"`
	MedicalConditions  string  `json:"medical_conditions"`
	Medications        string  `json:"medications"`
	Allergies          string  `json:"allergies"`
	GlucoseFasting     float64 `json:"glucose_fasting"`
	HbA1c              float64 `json:"hba1c"`
	CholesterolTotal   float64 `json:"cholesterol_total"`
	CholesterolLDL     float64 `json:"cholesterol_ldl"`
	CholesterolHDL     float64 `json:"cholesterol_hdl"`
	Triglycerides      float64 `json:"triglycerides"`
	ActivityLevel      string  `json:"activity_level"`
	MealSchedule       string  `json:"meal_schedule"`
	SleepHours         float64 `json:"sleep_hours"`
	Goals              string  `json:"goals"`
	UpdatedAt          string  `json:"updated_at"`
}

func createHealthProfileHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	var profile HealthProfile
	if err := c.BindJSON(&profile); err != nil {
		log.Printf("[HealthProfile] Error binding JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "datos inválidos"})
		return
	}

	profile.UserID = claims.UserID
	profile.UpdatedAt = time.Now().Format(time.RFC3339)

	log.Printf("[HealthProfile] Creating profile for user %d", claims.UserID)

	_, err := db.Exec(`
		INSERT INTO health_profiles (
			user_id, age, sex, height, current_weight, goal_weight, waist_circumference,
			medical_conditions, medications, allergies, glucose_fasting, hba1c,
			cholesterol_total, cholesterol_ldl, cholesterol_hdl, triglycerides,
			activity_level, meal_schedule, sleep_hours, goals, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, profile.UserID, profile.Age, profile.Sex, profile.Height, profile.CurrentWeight,
		profile.GoalWeight, profile.WaistCircumference, profile.MedicalConditions,
		profile.Medications, profile.Allergies, profile.GlucoseFasting, profile.HbA1c,
		profile.CholesterolTotal, profile.CholesterolLDL, profile.CholesterolHDL,
		profile.Triglycerides, profile.ActivityLevel, profile.MealSchedule,
		profile.SleepHours, profile.Goals, profile.UpdatedAt)

	if err != nil {
		log.Printf("[HealthProfile] Error creating profile: %v", err)
		// If profile already exists, suggest using update instead
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			c.JSON(http.StatusConflict, gin.H{"error": "ya existe un perfil de salud, usa actualizar en su lugar"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo crear perfil de salud"})
		return
	}

	log.Printf("[HealthProfile] Profile created successfully for user %d", claims.UserID)
	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Perfil de salud creado exitosamente"})
}

func getHealthProfileHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	var profile HealthProfile

	err := db.QueryRow(`
		SELECT id, user_id, age, sex, height, current_weight, goal_weight, waist_circumference,
		medical_conditions, medications, allergies, glucose_fasting, hba1c,
		cholesterol_total, cholesterol_ldl, cholesterol_hdl, triglycerides,
		activity_level, meal_schedule, sleep_hours, goals, updated_at
		FROM health_profiles WHERE user_id = ?
	`, claims.UserID).Scan(
		&profile.ID, &profile.UserID, &profile.Age, &profile.Sex, &profile.Height,
		&profile.CurrentWeight, &profile.GoalWeight, &profile.WaistCircumference,
		&profile.MedicalConditions, &profile.Medications, &profile.Allergies,
		&profile.GlucoseFasting, &profile.HbA1c, &profile.CholesterolTotal,
		&profile.CholesterolLDL, &profile.CholesterolHDL, &profile.Triglycerides,
		&profile.ActivityLevel, &profile.MealSchedule, &profile.SleepHours,
		&profile.Goals, &profile.UpdatedAt)

	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			c.JSON(http.StatusOK, gin.H{"profile": nil})
			return
		}
		log.Printf("[HealthProfile] Error fetching profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al obtener perfil"})
		return
	}

	c.JSON(http.StatusOK, profile)
}

func updateHealthProfileHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	var profile HealthProfile
	if err := c.BindJSON(&profile); err != nil {
		log.Printf("[HealthProfile] Error binding JSON for update: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "datos inválidos"})
		return
	}

	profile.UpdatedAt = time.Now().Format(time.RFC3339)

	log.Printf("[HealthProfile] Updating profile for user %d", claims.UserID)

	res, err := db.Exec(`
		UPDATE health_profiles SET
			age = ?, sex = ?, height = ?, current_weight = ?, goal_weight = ?,
			waist_circumference = ?, medical_conditions = ?, medications = ?,
			allergies = ?, glucose_fasting = ?, hba1c = ?, cholesterol_total = ?,
			cholesterol_ldl = ?, cholesterol_hdl = ?, triglycerides = ?,
			activity_level = ?, meal_schedule = ?, sleep_hours = ?, goals = ?,
			updated_at = ?
		WHERE user_id = ?
	`, profile.Age, profile.Sex, profile.Height, profile.CurrentWeight, profile.GoalWeight,
		profile.WaistCircumference, profile.MedicalConditions, profile.Medications,
		profile.Allergies, profile.GlucoseFasting, profile.HbA1c, profile.CholesterolTotal,
		profile.CholesterolLDL, profile.CholesterolHDL, profile.Triglycerides,
		profile.ActivityLevel, profile.MealSchedule, profile.SleepHours, profile.Goals,
		profile.UpdatedAt, claims.UserID)

	if err != nil {
		log.Printf("[HealthProfile] Error updating profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo actualizar perfil"})
		return
	}

	if rows, err := res.RowsAffected(); err == nil {
		if rows == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "perfil no encontrado"})
			return
		}
	}

	log.Printf("[HealthProfile] Profile updated successfully for user %d", claims.UserID)
	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Perfil actualizado exitosamente"})
}

// Helper to get user ID from JWT claims in context
func getUserIDFromContext(c *gin.Context) int {
	claims, ok := c.MustGet("claims").(*Claims)
	if !ok {
		return 0
	}
	return claims.UserID
}

// --- Middleware ---

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "se requiere Authorization header"})
			return
		}
		// Bearer token
		var tokenString string
		_, err := fmt.Sscanf(auth, "Bearer %s", &tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "formato de token inválido"})
			return
		}
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token inválido"})
			return
		}
		claims, ok := token.Claims.(*Claims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "claims inválidos"})
			return
		}
		c.Set("claims", claims)
		c.Next()
	}
}

// --- OCR Handler ---

func ocrHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	// Create uploads directory if it doesn't exist
	os.MkdirAll("./uploads", 0755)

	// Parse form with file
	file, err := c.FormFile("image")
	if err != nil {
		log.Println("[OCR] No image file provided:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "no image file provided"})
		return
	}

	// Save uploaded file temporarily
	filename := filepath.Join("./uploads", fmt.Sprintf("ocr_%d_%d.jpg", claims.UserID, time.Now().UnixNano()))
	log.Println("[OCR] Saving uploaded file to", filename)
	if err := c.SaveUploadedFile(file, filename); err != nil {
		log.Println("[OCR] Failed to save image:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save image"})
		return
	}
	log.Println("[OCR] Saved file successfully")
	defer func() {
		if err := os.Remove(filename); err != nil {
			log.Println("[OCR] Failed to remove temp file:", err)
		} else {
			log.Println("[OCR] Temp file removed")
		}
	}() // Clean up temp file

	// Extract data from image using simple regex patterns
	log.Println("[OCR] Running Tesseract on", filename)
	result := extractDataFromImage(filename)
	log.Printf("[OCR] Result: name=%s, height=%.1fcm, age=%d, sex=%s, weight=%.2f fat=%.2f muscle=%.2f confidence=%s", result.Name, result.Height, result.Age, result.Sex, result.Weight, result.FatPercentage, result.MusclePercentage, result.Confidence)

	// Return extracted data
	c.JSON(http.StatusOK, result)
}

// extractDataFromImage attempts to parse medical report data from image using Tesseract OCR
func extractDataFromImage(imagePath string) OCRResult {
	result := OCRResult{
		Confidence: "low",
	}

	// Check file exists and is readable
	fileInfo, err := os.Stat(imagePath)
	if err != nil || fileInfo.Size() == 0 {
		result.Confidence = "error"
		return result
	}

	// Validate image format
	file, err := os.Open(imagePath)
	if err == nil {
		defer file.Close()
		header := make([]byte, 4)
		file.Read(header)

		isValidImage := (len(header) >= 2 &&
			(header[0] == 0xFF && header[1] == 0xD8) || // JPEG
			(header[0] == 0x89 && header[1] == 0x50)) // PNG

		if !isValidImage {
			result.Confidence = "invalid_format"
			return result
		}
	}

	// Run Tesseract OCR
	text, err := runTesseract(imagePath)
	if err != nil {
		log.Printf("Tesseract error: %v", err)
		result.Confidence = "tesseract_not_installed"
		return result
	}

	// Log a snippet of the OCR text for debugging
	snippet := text
	if len(snippet) > 800 {
		snippet = snippet[:800] + "..."
	}
	log.Println("[OCR] Raw text snippet:\n" + snippet)

	// Parse extracted text for body composition data
	result = parseBodyCompositionData(text)
	return result
}

// runTesseract executes Tesseract OCR on the image
func runTesseract(imagePath string) (string, error) {
	// Try to find tesseract executable
	tesseractCmd := "tesseract"

	// Check common Windows installation paths
	possiblePaths := []string{
		"tesseract",
		"C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
		"C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
	}

	for _, path := range possiblePaths {
		if _, err := exec.LookPath(path); err == nil {
			tesseractCmd = path
			break
		}
	}

	// Run: tesseract image.jpg stdout with language and spacing preserved
	cmd := exec.Command(tesseractCmd, imagePath, "stdout", "-l", "eng+spa", "--psm", "6", "-c", "preserve_interword_spaces=1")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("tesseract execution failed: %w (output: %s)", err, string(output))
	}

	return string(output), nil
}

// parseBodyCompositionData extracts weight, fat%, muscle% from OCR text
func parseBodyCompositionData(text string) OCRResult {
	res := OCRResult{Confidence: "no_data_found"}
	normalize := func(s string) string { return strings.ReplaceAll(s, ",", ".") }
	parse := func(s string) (float64, error) { return strconv.ParseFloat(normalize(s), 64) }

	// Extract name from Id./Nombre or Nombre line
	lines := strings.Split(text, "\n")
	namePattern := regexp.MustCompile(`(?i)(id\.|nombre|name)\s*[:]*\s*([A-ZÁÉÍÓÚÑ\s]+(?:/\s*)?[A-ZÁÉÍÓÚÑ\s]+)`)
	for _, ln := range lines {
		if m := namePattern.FindStringSubmatch(ln); len(m) >= 3 {
			name := strings.TrimSpace(m[2])
			if len(name) > 5 { // reasonable name length
				res.Name = name
				break
			}
		}
	}

	// Extract height (Estatura: 167.0 cm)
	heightPattern := regexp.MustCompile(`(?i)estatura[:\s]+([0-9]+(?:[.,][0-9]+)?)\s*cm`)
	for _, ln := range lines {
		if m := heightPattern.FindStringSubmatch(ln); len(m) >= 2 {
			if v, err := parse(m[1]); err == nil && v >= 100 && v <= 250 {
				res.Height = v
				break
			}
		}
	}

	// Extract age (Edad: 41 años)
	agePattern := regexp.MustCompile(`(?i)edad[:\s]+([0-9]+)`)
	for _, ln := range lines {
		if m := agePattern.FindStringSubmatch(ln); len(m) >= 2 {
			if age, err := strconv.Atoi(m[1]); err == nil && age >= 1 && age <= 120 {
				res.Age = age
				break
			}
		}
	}

	// Extract sex (Sexo: Hombre/Mujer)
	sexPattern := regexp.MustCompile(`(?i)sexo[:\s!]+\s*(hombre|mujer|male|female|man|woman)`)
	for _, ln := range lines {
		if m := sexPattern.FindStringSubmatch(ln); len(m) >= 2 {
			sex := strings.ToLower(m[1])
			if sex == "hombre" || sex == "male" || sex == "man" {
				res.Sex = "Male"
			} else if sex == "mujer" || sex == "female" || sex == "woman" {
				res.Sex = "Female"
			}
			break
		}
	}

	pesoPatterns := []string{
		`(?i)\b(peso|weight)\b.*?([0-9]+(?:[.,][0-9]+)?)\s*kg`,
		`(?i)\b(peso\s*actual|actual\s*peso)\b.*?([0-9]+(?:[.,][0-9]+)?)\s*kg`,
		`(?i)\bweight\b.*?([0-9]+(?:[.,][0-9]+)?)\s*kg`,
	}
	grasaPatterns := []string{
		`(?i)(porcentaje\s+de\s+grasa|grasa\s+corporal|grasa|fat\s+percentage|body\s+fat|fat)[:=\s]+([0-9]+(?:[.,][0-9]+)?)\s*%`,
		`(?i)masa\s+grasa\s*\(\s*%\s*\)\s*[:=\s]*([0-9]+(?:[.,][0-9]+)?)`,
	}
	musculoPatterns := []string{
		`(?i)(porcentaje\s+de\s+m[úu]sculo|m[úu]sculo\s+corporal|m[úu]sculo|muscle\s+percentage|muscle)[:=\s]+([0-9]+(?:[.,][0-9]+)?)\s*%`,
		`(?i)masa\s+muscular\s*\(\s*%\s*\)\s*[:=\s]*([0-9]+(?:[.,][0-9]+)?)`,
	}

	var weight, fat, muscle float64
	var gotW, gotF, gotM bool

	for _, p := range pesoPatterns {
		re := regexp.MustCompile(p)
		if m := re.FindStringSubmatch(text); len(m) >= 3 {
			full := strings.ToLower(m[0])
			// Exclude lines that mention goal/objetivo (goal weight)
			if strings.Contains(full, "objetivo") || strings.Contains(full, "goal") {
				continue
			}
			if v, err := parse(m[2]); err == nil && v >= 20 && v <= 300 {
				weight, gotW = v, true
				break
			}
		}
	}
	for _, p := range grasaPatterns {
		re := regexp.MustCompile(p)
		if m := re.FindStringSubmatch(text); len(m) >= 2 {
			vStr := m[len(m)-1]
			if v, err := parse(vStr); err == nil && v >= 3 && v <= 75 {
				fat, gotF = v, true
				break
			}
		}
	}
	for _, p := range musculoPatterns {
		re := regexp.MustCompile(p)
		if m := re.FindStringSubmatch(text); len(m) >= 2 {
			vStr := m[len(m)-1]
			if v, err := parse(vStr); err == nil && v >= 10 && v <= 80 {
				muscle, gotM = v, true
				break
			}
		}
	}

	// Fallback heuristics using line scanning when strict patterns miss
	if !gotW {
		numKg := regexp.MustCompile(`(?i)([0-9]+(?:[.,][0-9]+)?)\s*kg`)
		type kgCand struct {
			val     float64
			line    string
			labeled bool
		}
		var cands []kgCand
		for _, ln := range lines {
			low := strings.ToLower(ln)
			if strings.Contains(low, "objetivo") || strings.Contains(low, "goal") {
				continue
			}
			if strings.Contains(low, "masa") || strings.Contains(low, "muscular") || strings.Contains(low, "celular") {
				continue
			}
			m := numKg.FindStringSubmatch(ln)
			if len(m) == 2 {
				if v, err := parse(m[1]); err == nil && v >= 20 && v <= 150 {
					cands = append(cands, kgCand{val: v, line: strings.TrimSpace(ln), labeled: strings.Contains(low, "peso") || strings.Contains(low, "weight")})
				}
			}
		}
		if len(cands) > 0 {
			log.Println("[OCR] KG candidates:")
			for _, c := range cands {
				log.Printf("[OCR]   %.2f kg | labeled=%v | line=%s", c.val, c.labeled, c.line)
			}
			pick := func(labeledOnly bool) (float64, bool) {
				var best float64
				found := false
				for _, c := range cands {
					if labeledOnly && !c.labeled {
						continue
					}
					if !found || c.val > best {
						best, found = c.val, true
					}
				}
				return best, found
			}
			if w, ok := pick(true); ok {
				weight, gotW = w, true
			} else if w, ok := pick(false); ok {
				weight, gotW = w, true
			}
		}
	}
	if !gotF {
		numPct := regexp.MustCompile(`([0-9]+(?:[.,][0-9]+)?)\s*%`)
		for _, ln := range lines {
			low := strings.ToLower(ln)
			if (strings.Contains(low, "grasa") || strings.Contains(low, "body fat") || strings.Contains(low, "fat")) && strings.Contains(low, "%") {
				if m := numPct.FindStringSubmatch(ln); len(m) == 2 {
					if v, err := parse(m[1]); err == nil && v >= 3 && v <= 75 {
						fat, gotF = v, true
						break
					}
				}
			}
		}
	}
	if !gotM {
		numPct := regexp.MustCompile(`([0-9]+(?:[.,][0-9]+)?)\s*%`)
		for _, ln := range lines {
			low := strings.ToLower(ln)
			if (strings.Contains(low, "músculo") || strings.Contains(low, "musculo") || strings.Contains(low, "muscle")) && strings.Contains(low, "%") {
				if m := numPct.FindStringSubmatch(ln); len(m) == 2 {
					if v, err := parse(m[1]); err == nil && v >= 10 && v <= 80 {
						muscle, gotM = v, true
						break
					}
				}
			}
		}
	}

	matches := 0
	if gotW {
		matches++
	}
	if gotF {
		matches++
	}
	if gotM {
		matches++
	}

	switch matches {
	case 3:
		res.Confidence = "high"
	case 2:
		res.Confidence = "medium"
	case 1:
		res.Confidence = "low"
	default:
		res.Confidence = "no_data_found"
	}

	if gotW {
		res.Weight = weight
	}
	if gotF {
		res.FatPercentage = fat
	}
	if gotM {
		res.MusclePercentage = muscle
	}

	log.Printf("OCR extracted: name=%s, height=%.1fcm, age=%d, sex=%s, weight=%.1f, fat=%.1f%%, muscle=%.1f%%, confidence=%s",
		res.Name, res.Height, res.Age, res.Sex, res.Weight, res.FatPercentage, res.MusclePercentage, res.Confidence)

	return res
}

// --- Admin Middleware & Handlers ---

func adminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := c.MustGet("claims").(*Claims)
		if claims.Role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}
		c.Next()
	}
}

func isPrivacyAdmin(c *gin.Context) bool {
	claims := c.MustGet("claims").(*Claims)
	privacyEmail := strings.TrimSpace(strings.ToLower(os.Getenv("PRIVACY_ADMIN_EMAIL")))
	return privacyEmail != "" && strings.EqualFold(strings.TrimSpace(claims.Email), privacyEmail)
}

func auditAdminAction(c *gin.Context, action string, targetUserID interface{}) {
	claims := c.MustGet("claims").(*Claims)
	_, err := db.Exec(
		`INSERT INTO admin_audit_logs (admin_user_id, action, target_user_id, created_at) VALUES (?, ?, ?, ?)`,
		claims.UserID,
		action,
		targetUserID,
		time.Now().UTC().Format(time.RFC3339),
	)
	if err != nil {
		log.Printf("[AUDIT] failed to record action %q by admin %d: %v", action, claims.UserID, err)
	}
}

func maskEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 || len(parts[0]) < 2 {
		return "***"
	}
	return string(parts[0][0]) + "***@" + parts[1]
}

func maskName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "Usuario"
	}
	runes := []rune(name)
	return string(runes[0]) + "***"
}

func maskPhone(phone string) string {
	runes := []rune(strings.TrimSpace(phone))
	if len(runes) <= 4 {
		if len(runes) == 0 {
			return ""
		}
		return "***"
	}
	return "***" + string(runes[len(runes)-4:])
}

func adminMetricsHandler(c *gin.Context) {
	metrics := map[string]int{
		"total_users":            0,
		"regular_users":          0,
		"nutritionists":          0,
		"admins":                 0,
		"assigned_users":         0,
		"unassigned_users":       0,
		"pending_appointments":   0,
		"completed_appointments": 0,
		"cancelled_appointments": 0,
	}

	queries := map[string]string{
		"total_users":            `SELECT COUNT(*) FROM users`,
		"regular_users":          `SELECT COUNT(*) FROM users WHERE role = 'user'`,
		"nutritionists":          `SELECT COUNT(*) FROM users WHERE role = 'nutritionist'`,
		"admins":                 `SELECT COUNT(*) FROM users WHERE role = 'admin'`,
		"assigned_users":         `SELECT COUNT(*) FROM users WHERE role = 'user' AND nutritionist_id IS NOT NULL`,
		"unassigned_users":       `SELECT COUNT(*) FROM users WHERE role = 'user' AND nutritionist_id IS NULL`,
		"pending_appointments":   `SELECT COUNT(*) FROM appointments WHERE status IN ('scheduled', 'pending')`,
		"completed_appointments": `SELECT COUNT(*) FROM appointments WHERE status = 'completed'`,
		"cancelled_appointments": `SELECT COUNT(*) FROM appointments WHERE status = 'cancelled'`,
	}

	for key, query := range queries {
		var value int
		if err := db.QueryRow(query).Scan(&value); err != nil {
			log.Printf("[ADMIN] metric %s unavailable: %v", key, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudieron calcular las métricas"})
			return
		}
		metrics[key] = value
	}

	auditAdminAction(c, "view_metrics", nil)
	metrics["can_view_individual_data"] = 0
	if isPrivacyAdmin(c) {
		metrics["can_view_individual_data"] = 1
	}
	c.JSON(http.StatusOK, metrics)
}

func nutritionistOrAdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := c.MustGet("claims").(*Claims)
		if claims.Role != "nutritionist" && claims.Role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "nutritionist or admin access required"})
			return
		}
		c.Next()
	}
}

func listUsersHandler(c *gin.Context) {
	rows, err := db.Query(`SELECT id, name, email, role, phone FROM users`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch users"})
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id int
		var name, email, role, phone string
		if err := rows.Scan(&id, &name, &email, &role, &phone); err != nil {
			continue
		}
		user := map[string]interface{}{
			"id":   id,
			"role": role,
		}
		if isPrivacyAdmin(c) {
			user["name"] = name
			user["email"] = email
			user["phone"] = phone
		} else {
			user["name"] = maskName(name)
			user["email"] = maskEmail(email)
			user["phone"] = maskPhone(phone)
		}
		users = append(users, user)
	}

	if users == nil {
		users = []map[string]interface{}{}
	}
	auditAdminAction(c, "view_user_directory", nil)
	c.JSON(http.StatusOK, users)
}

func userHistoryHandler(c *gin.Context) {
	if !isPrivacyAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "se requiere autorización de privacidad"})
		return
	}
	userID := c.Param("id")
	rows, err := db.Query(`SELECT id, user_id, date, weight, fat_percentage, muscle_percentage FROM histories WHERE user_id = ? ORDER BY date DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch history"})
		return
	}
	defer rows.Close()

	var history []HistoryEntry
	for rows.Next() {
		var entry HistoryEntry
		if err := rows.Scan(&entry.ID, &entry.UserID, &entry.Date, &entry.Weight, &entry.FatPercentage, &entry.MusclePercentage); err != nil {
			continue
		}
		history = append(history, entry)
	}

	if history == nil {
		history = []HistoryEntry{}
	}
	auditAdminAction(c, "view_user_health_history", userID)
	c.JSON(http.StatusOK, history)
}

type ExportRecord struct {
	UserID           int     `json:"user_id"`
	UserName         string  `json:"user_name"`
	Email            string  `json:"email"`
	Role             string  `json:"role"`
	RecordID         int     `json:"record_id"`
	Date             string  `json:"date"`
	Weight           float64 `json:"weight"`
	FatPercentage    float64 `json:"fat_percentage"`
	MusclePercentage float64 `json:"muscle_percentage"`
}

func exportDataHandler(c *gin.Context) {
	if !isPrivacyAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "la exportación requiere autorización de privacidad"})
		return
	}
	query := `
		SELECT u.id, u.name, u.email, u.role, h.id, h.date, h.weight, h.fat_percentage, h.muscle_percentage
		FROM users u
		LEFT JOIN histories h ON u.id = h.user_id
		ORDER BY u.id, h.date DESC
	`
	rows, err := db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "export failed"})
		return
	}
	defer rows.Close()

	var records []ExportRecord
	for rows.Next() {
		var record ExportRecord
		var recordID *int
		var date *string
		var weight *float64
		var fatPct *float64
		var musclePct *float64

		if err := rows.Scan(&record.UserID, &record.UserName, &record.Email, &record.Role, &recordID, &date, &weight, &fatPct, &musclePct); err != nil {
			continue
		}

		record.RecordID = 0
		record.Date = ""
		record.Weight = 0
		record.FatPercentage = 0
		record.MusclePercentage = 0

		if recordID != nil {
			record.RecordID = *recordID
		}
		if date != nil {
			record.Date = *date
		}
		if weight != nil {
			record.Weight = *weight
		}
		if fatPct != nil {
			record.FatPercentage = *fatPct
		}
		if musclePct != nil {
			record.MusclePercentage = *musclePct
		}

		records = append(records, record)
	}

	if records == nil {
		records = []ExportRecord{}
	}
	auditAdminAction(c, "export_user_health_data", nil)
	c.JSON(http.StatusOK, records)
}

func updateUserRoleHandler(c *gin.Context) {
	userID := c.Param("id")
	claims := c.MustGet("claims").(*Claims)

	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Validate role
	if req.Role != "user" && req.Role != "admin" && req.Role != "nutritionist" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role"})
		return
	}

	// Prevent self-demotion from admin
	if fmt.Sprintf("%d", claims.UserID) == userID && req.Role != "admin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot demote yourself"})
		return
	}

	result, err := db.Exec(`UPDATE users SET role = ? WHERE id = ?`, req.Role, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update role"})
		return
	}

	rows, err := result.RowsAffected()
	if err != nil || rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	auditAdminAction(c, "update_user_role", userID)
	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "role updated"})
}

func deleteUserHandler(c *gin.Context) {
	userID := c.Param("id")
	claims := c.MustGet("claims").(*Claims)

	// Prevent self-deletion
	if fmt.Sprintf("%d", claims.UserID) == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete your own account"})
		return
	}

	// Start transaction-like behavior: delete related records first
	_, err := db.Exec(`DELETE FROM histories WHERE user_id = ?`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user history"})
		return
	}

	result, err := db.Exec(`DELETE FROM users WHERE id = ?`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user"})
		return
	}

	rows, err := result.RowsAffected()
	if err != nil || rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	auditAdminAction(c, "delete_user", userID)
	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "user deleted"})
}

// --- Meal Plan Handlers ---

func uploadMealPlanHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	file, err := c.FormFile("pdf")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no PDF file provided"})
		return
	}

	tempPath := filepath.Join("./uploads", fmt.Sprintf("meal_plan_%d_%d.pdf", claims.UserID, time.Now().UnixNano()))
	log.Printf("[MealPlan] Saving PDF to: %s", tempPath)
	if err := c.SaveUploadedFile(file, tempPath); err != nil {
		log.Printf("[MealPlan] Failed to save PDF: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save PDF"})
		return
	}
	defer os.Remove(tempPath)

	log.Printf("[MealPlan] Extracting meals from PDF...")
	meals, snacksText, err := extractMealsFromPDF(tempPath)
	if err != nil {
		log.Printf("[MealPlan] PDF extraction error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse PDF"})
		return
	}
	log.Printf("[MealPlan] Extracted %d meals from PDF", len(meals))

	planName := fmt.Sprintf("Plan %s", time.Now().Format("2006-01-02"))
	result, err := db.Exec(`INSERT INTO meal_plans (user_id, name, start_date, snacks, created_at) VALUES (?, ?, ?, ?, ?)`,
		claims.UserID, planName, time.Now().Format("2006-01-02"), snacksText, time.Now().Format(time.RFC3339))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create meal plan"})
		return
	}

	planID, _ := result.LastInsertId()

	for _, meal := range meals {
		_, err = db.Exec(`INSERT INTO plan_meals (plan_id, day_of_week, meal_type, name, ingredients, preparation) VALUES (?, ?, ?, ?, ?, ?)`,
			planID, meal.DayOfWeek, meal.MealType, meal.Name, meal.Ingredients, meal.Preparation)
		if err != nil {
			log.Printf("[MealPlan] Failed to insert meal: %v", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"plan_id": planID, "meals_count": len(meals)})
}

func getMealPlanHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	var plan MealPlan
	err := db.QueryRow(`SELECT id, user_id, name, start_date, snacks, created_at FROM meal_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`, claims.UserID).
		Scan(&plan.ID, &plan.UserID, &plan.Name, &plan.StartDate, &plan.Snacks, &plan.CreatedAt)
	if err != nil {
		// If the user has no plan yet, return empty data instead of 404 to keep the UI clean
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusOK, gin.H{"plan": nil, "meals": []PlanMeal{}})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "no meal plan found"})
		return
	}

	rows, err := db.Query(`SELECT id, plan_id, day_of_week, meal_type, name, ingredients, preparation FROM plan_meals WHERE plan_id = ? ORDER BY 
		CASE day_of_week 
			WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miércoles' THEN 3 WHEN 'Jueves' THEN 4 
			WHEN 'Viernes' THEN 5 WHEN 'Sábado' THEN 6 WHEN 'Domingo' THEN 7 
		END,
		CASE meal_type 
			WHEN 'Desayuno' THEN 1 WHEN 'Colación' THEN 2 WHEN 'Comida' THEN 3 WHEN 'Cena' THEN 4 
		END`, plan.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch meals"})
		return
	}
	defer rows.Close()

	var meals []PlanMeal
	for rows.Next() {
		var meal PlanMeal
		rows.Scan(&meal.ID, &meal.PlanID, &meal.DayOfWeek, &meal.MealType, &meal.Name, &meal.Ingredients, &meal.Preparation)
		meals = append(meals, meal)
	}

	c.JSON(http.StatusOK, gin.H{"plan": plan, "meals": meals})
}

func createFoodLogHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	var req struct {
		Date      string `json:"date" binding:"required"`
		MealType  string `json:"meal_type" binding:"required"`
		Completed bool   `json:"completed"`
		Notes     string `json:"notes"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid data"})
		return
	}

	_, err := db.Exec(`INSERT OR REPLACE INTO food_logs (user_id, date, meal_type, completed, notes) VALUES (?, ?, ?, ?, ?)`,
		claims.UserID, req.Date, req.MealType, req.Completed, req.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save log"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func getFoodLogHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	date := c.Query("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	rows, err := db.Query(`SELECT id, user_id, date, meal_type, completed, notes FROM food_logs WHERE user_id = ? AND date = ?`, claims.UserID, date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch logs"})
		return
	}
	defer rows.Close()

	var logs []FoodLog
	for rows.Next() {
		var log FoodLog
		rows.Scan(&log.ID, &log.UserID, &log.Date, &log.MealType, &log.Completed, &log.Notes)
		logs = append(logs, log)
	}

	if logs == nil {
		logs = []FoodLog{}
	}
	c.JSON(http.StatusOK, logs)
}

func extractMealsFromPDF(pdfPath string) ([]PlanMeal, string, error) {
	file, reader, err := pdf.Open(pdfPath)
	if err != nil {
		log.Printf("[MealPlan] Failed to open PDF: %v", err)
		return nil, "", err
	}
	defer file.Close()

	var fullText string
	for i := 1; i <= reader.NumPage(); i++ {
		page := reader.Page(i)
		if page.V.IsNull() {
			continue
		}
		text, _ := page.GetPlainText(nil)
		fullText += text + "\n"
	}

	log.Printf("[MealPlan] Extracted text length: %d characters", len(fullText))
	if len(fullText) > 500 {
		log.Printf("[MealPlan] First 500 chars: %s", fullText[:500])
	} else {
		log.Printf("[MealPlan] Full text: %s", fullText)
	}

	// Normalize fragmented text: remove excessive line breaks and join words
	fullText = normalizeFragmentedText(fullText)
	log.Printf("[MealPlan] After normalization: %d characters", len(fullText))
	if len(fullText) > 1000 {
		log.Printf("[MealPlan] First 1000 normalized chars: %s", fullText[:1000])
	} else {
		log.Printf("[MealPlan] Normalized text: %s", fullText)
	}

	meals, snacksText := parseMealPlanText(fullText)
	log.Printf("[MealPlan] Parsed meals: %d", len(meals))

	// Store snacks text if available
	if snacksText != "" {
		log.Printf("[MealPlan] Snacks/Colaciones text: %d chars", len(snacksText))
	}

	return meals, snacksText, nil
}

// normalizeFragmentedText fixes PDFs where words are split across multiple lines
func normalizeFragmentedText(text string) string {
	// First pass: join ALL text with spaces (removing all newlines)
	text = strings.ReplaceAll(text, "\n", " ")

	// Clean up multiple spaces
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)

	// Second pass: try to reconstruct words by looking for patterns
	// Pattern: single letters separated by spaces that form known words
	// For Spanish days: L u n e s -> Lunes, M a r t e s -> Martes, etc.
	wordPatterns := map[string]string{
		"L u n e s":               "Lunes",
		"M a r t e s":             "Martes",
		"M i é r c o l e s":       "Miércoles",
		"M i e r c o l e s":       "Miércoles",
		"J u e v e s":             "Jueves",
		"V i e r n e s":           "Viernes",
		"S á b a d o":             "Sábado",
		"S a b a d o":             "Sábado",
		"D o m i n g o":           "Domingo",
		"D e s a y u n o":         "Desayuno",
		"C o m i d a":             "Comida",
		"C e n a":                 "Cena",
		"C o l a c i ó n":         "Colación",
		"C o l a c i o n":         "Colación",
		"I n g r e d i e n t e s": "Ingredientes",
		"P r e p a r a c i ó n":   "Preparación",
		"P r e p a r a c i o n":   "Preparación",
	}

	for pattern, replacement := range wordPatterns {
		text = strings.ReplaceAll(text, pattern, replacement)
	}

	// Add newlines before key markers to help parsing
	markers := []string{"Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
		"Desayuno", "Comida", "Cena", "Colación", "Ingredientes:", "Preparación:"}
	for _, marker := range markers {
		text = strings.ReplaceAll(text, " "+marker, "\n"+marker)
	}

	return strings.TrimSpace(text)
}

func parseMealPlanText(text string) ([]PlanMeal, string) {
	var meals []PlanMeal
	var snacksText string
	days := []string{"Lunes", "Martes", "Miércoles", "Miercoles", "Jueves", "Viernes", "Sábado", "Sabado", "Domingo"}
	mealTypesOrder := []string{"Desayuno", "Comida", "Cena"}

	lines := strings.Split(text, "\n")
	var currentDay string
	var currentMealIndex int
	var mealName strings.Builder
	var ingredients strings.Builder
	var preparation strings.Builder
	inIngredients := false
	inPreparation := false

	log.Printf("[MealPlan Parser] Processing %d lines", len(lines))

	hasEmojiIngredient := func(s string) bool {
		emojiMarkers := "🥚🍅🧅🌶🌮🫙🧂🥩🎃🌵🧄🍞🍖🧀🥒🥔🫑🐟🫒🫘🥬🍌🌰🌿🍎🍯🥕🍠🌽🍗🫑🌾🥖"
		if len(s) < 2 {
			return false
		}
		runes := []rune(s)
		return strings.ContainsRune(emojiMarkers, runes[0])
	}

	isMealName := func(line string) bool {
		if len(line) < 8 {
			return false
		}
		uppers := 0
		letters := 0
		for _, r := range line {
			if unicode.IsLetter(r) {
				letters++
				if unicode.IsUpper(r) {
					uppers++
				}
			}
		}
		return letters > 0 && float64(uppers)/float64(letters) >= 0.6
	}

	detectEmbeddedMeal := func(text string) (beforeMeal, mealName, mealIngredients, mealPrep, snacks string, found bool) {
		// Try to find FIRST ALL CAPS meal name in text
		// Split by period to get sentences
		sentences := strings.Split(text, ". ")

		for i, sentence := range sentences {
			sentence = strings.TrimSpace(sentence)
			if sentence == "" {
				continue
			}

			// Filter out user name
			if strings.HasPrefix(sentence, "Nombre ") || strings.HasPrefix(sentence, "NOMBRE ") {
				continue
			}

			// Check if sentence is just a meal name
			if !hasEmojiIngredient(sentence) && !strings.Contains(sentence, "👉") && isMealName(sentence) && len(sentence) >= 10 {
				// Reconstruct before
				beforeMealParts := sentences[:i]
				beforeMeal = strings.Join(beforeMealParts, ". ")
				if len(beforeMeal) > 0 && !strings.HasSuffix(beforeMeal, ".") {
					beforeMeal += "."
				}
				// Rest is after this meal name
				afterParts := sentences[i+1:]
				restText := strings.Join(afterParts, ". ")
				return beforeMeal, sentence, "", restText, "", true
			}

			// Check if sentence starts with a meal name (followed by ingredients/prep)
			// OR starts with an emoji followed by a meal name
			words := strings.Fields(sentence)
			if len(words) >= 3 {
				startIdx := 0
				// Check if first word is an emoji - skip it for name detection
				if len(words) > 0 && len(words[0]) > 0 {
					firstRune := []rune(words[0])[0]
					if strings.ContainsRune("🥚🍅🧅🌶🌮🫙🧂🥩🎃🌵🧄🍞🍖🧀🥒🥔🫑🐟🫒🫘🥬🍌🌰🌿🍎🍯🥕🍠🌽🍗🌾🥖🫑", firstRune) {
						startIdx = 1
					}
				}

				// Build meal name by taking words until we hit another emoji or number
				potentialName := ""
				nameWordCount := 0

				for j := startIdx; j < len(words); j++ {
					word := words[j]
					// Stop if we hit a number (ingredient quantity), emoji, or 👉
					if len(word) > 0 && (unicode.IsDigit([]rune(word)[0]) || hasEmojiIngredient(word) || word == "👉" || strings.Contains(word, "👉")) {
						break
					}

					if len(potentialName) > 0 {
						potentialName += " "
					}
					potentialName += word
					nameWordCount = j + 1
				}

				// Filter out user name
				if strings.HasPrefix(potentialName, "Nombre ") || strings.HasPrefix(potentialName, "NOMBRE ") {
					continue
				}

				// Check if we have a valid meal name (10+ chars, 60%+ uppercase)
				if len(potentialName) >= 10 && isMealName(potentialName) && nameWordCount >= 3 {
					// Found meal name - get remaining text (ingredients + prep)
					restText := strings.TrimSpace(strings.Join(words[nameWordCount:], " "))

					// Check if rest has ingredients or prep markers
					if hasEmojiIngredient(restText) || strings.Contains(restText, "👉") || restText == "" {
						// Reconstruct before
						beforeParts := sentences[:i]
						beforeMeal = strings.Join(beforeParts, ". ")
						if len(beforeMeal) > 0 && !strings.HasSuffix(beforeMeal, ".") {
							beforeMeal += "."
						}

						// Get remaining sentences after this one
						afterParts := sentences[i+1:]
						afterText := strings.Join(afterParts, ". ")
						if afterText != "" {
							restText = restText + ". " + afterText
						}

						// Split ingredients and prep from restText
						if idx := strings.Index(restText, "👉"); idx >= 0 {
							mealIngredients = strings.TrimSpace(restText[:idx])
							prepText := strings.TrimSpace(restText[idx+len("👉"):])

							// Check for Colaciones section
							var snacksText string
							if stopIdx := strings.Index(prepText, "Colaciones"); stopIdx >= 0 {
								// Found Colaciones, split prep and snacks
								mealPrep = strings.TrimSpace(prepText[:stopIdx])
								snacksText = strings.TrimSpace(prepText[stopIdx:])
								// Return snacks text and empty remaining to stop processing
								return beforeMeal, potentialName, mealIngredients, mealPrep, snacksText, true
							}
							mealPrep = prepText
						} else {
							mealIngredients = restText
						}
						return beforeMeal, potentialName, mealIngredients, mealPrep, "", true
					}
				}
			}
		}

		return text, "", "", "", "", false
	}

	saveMeal := func() {
		if currentDay != "" && mealName.Len() > 0 && currentMealIndex < len(mealTypesOrder) {
			prepText := strings.TrimSpace(preparation.String())
			ingredText := strings.TrimSpace(ingredients.String())
			nameText := strings.TrimSpace(mealName.String())

			if before, embeddedName, embeddedIngred, embeddedPrep, embeddedSnacks, found := detectEmbeddedMeal(prepText); found {
				meal := PlanMeal{
					DayOfWeek:   currentDay,
					MealType:    mealTypesOrder[currentMealIndex],
					Name:        nameText,
					Ingredients: ingredText,
					Preparation: before,
				}
				meals = append(meals, meal)
				log.Printf("[MealPlan Parser] Saved meal: %s - %s - %s", meal.DayOfWeek, meal.MealType, meal.Name[:min(len(meal.Name), 30)])

				// If snacks text was found, save it
				if embeddedSnacks != "" && snacksText == "" {
					snacksText = embeddedSnacks
					log.Printf("[MealPlan Parser] Captured snacks/colaciones text (%d chars)", len(snacksText))
				}

				currentMealIndex++
				if currentMealIndex < len(mealTypesOrder) {
					embeddedMeal := PlanMeal{
						DayOfWeek:   currentDay,
						MealType:    mealTypesOrder[currentMealIndex],
						Name:        embeddedName,
						Ingredients: embeddedIngred,
						Preparation: embeddedPrep,
					}
					meals = append(meals, embeddedMeal)
					log.Printf("[MealPlan Parser] Saved embedded meal: %s - %s - %s", embeddedMeal.DayOfWeek, embeddedMeal.MealType, embeddedMeal.Name[:min(len(embeddedMeal.Name), 30)])
					currentMealIndex++
				}
			} else {
				meal := PlanMeal{
					DayOfWeek:   currentDay,
					MealType:    mealTypesOrder[currentMealIndex],
					Name:        nameText,
					Ingredients: ingredText,
					Preparation: prepText,
				}
				meals = append(meals, meal)
				log.Printf("[MealPlan Parser] Saved meal: %s - %s - %s", meal.DayOfWeek, meal.MealType, meal.Name[:min(len(meal.Name), 30)])
				currentMealIndex++
			}

			mealName.Reset()
			ingredients.Reset()
			preparation.Reset()
			inIngredients = false
			inPreparation = false
		}
	}

	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Debug: log each line being processed
		if i < 15 {
			log.Printf("[MealPlan Parser] Line %d: %s", i, line[:min(len(line), 80)])
		}

		if line == "Desayuno" || line == "Comida" || line == "Cena" || line == "Plan de al imentació n" {
			continue
		}

		foundDay := false
		for _, day := range days {
			if strings.HasPrefix(line, day) {
				saveMeal()
				log.Printf("[MealPlan Parser] Line %d: Found day: %s", i, day)
				currentDay = day
				if currentDay == "Miercoles" {
					currentDay = "Miércoles"
				}
				if currentDay == "Sabado" {
					currentDay = "Sábado"
				}
				currentMealIndex = 0
				remaining := strings.TrimPrefix(line, day)
				remaining = strings.TrimSpace(remaining)
				if remaining != "" {
					mealName.Reset()
					mealName.WriteString(remaining)
					log.Printf("[MealPlan Parser] First meal name: %s", remaining[:min(len(remaining), 50)])
				}
				foundDay = true
				break
			}
		}
		if foundDay {
			continue
		}

		if strings.HasPrefix(line, "Ingredientes:") {
			// If we already have ingredients, this is a new meal, save the previous one
			if ingredients.Len() > 0 {
				saveMeal()
			}
			inIngredients = true
			inPreparation = false
			remaining := strings.TrimPrefix(line, "Ingredientes:")
			remaining = strings.TrimSpace(remaining)
			if remaining != "" {
				ingredients.WriteString(remaining)
			}
			continue
		}

		// Check if this line looks like a new meal name (ALL CAPS)
		if isMealName(line) {
			// This is a new meal name, save previous meal if any
			if mealName.Len() > 0 {
				saveMeal()
			}
			mealName.Reset()
			mealName.WriteString(line)
			inIngredients = false
			inPreparation = false
			log.Printf("[MealPlan Parser] New meal name: %s", line[:min(len(line), 50)])
			continue
		}

		if strings.HasPrefix(line, "Preparación:") || strings.HasPrefix(line, "Preparacion:") {
			inPreparation = true
			inIngredients = false
			remaining := strings.TrimPrefix(line, "Preparación:")
			remaining = strings.TrimPrefix(remaining, "Preparacion:")
			remaining = strings.TrimSpace(remaining)
			if remaining != "" {
				// Process remaining text, potentially with multiple embedded meals
				loopCount := 0
				for {
					loopCount++
					if loopCount > 5 {
						log.Printf("[MealPlan Parser] WARNING: Loop limit reached processing prep")
						break
					}
					if before, embeddedName, embeddedIngred, embeddedPrep, embeddedSnacks, found := detectEmbeddedMeal(remaining); found {
						// Add prep text before embedded meal to current meal
						if before != "" {
							if preparation.Len() > 0 {
								preparation.WriteString(" ")
							}
							preparation.WriteString(before)
						}
						// Save current meal
						saveMeal()

						// If snacks text was found, save it
						if embeddedSnacks != "" && snacksText == "" {
							snacksText = embeddedSnacks
							log.Printf("[MealPlan Parser] Captured snacks/colaciones text (%d chars)", len(snacksText))
						}

						// Start new meal with embedded name
						mealName.Reset()
						mealName.WriteString(embeddedName)
						// Add embedded ingredients if any
						if embeddedIngred != "" {
							ingredients.WriteString(embeddedIngred)
						}
						// Continue processing rest of text for more embedded meals
						log.Printf("[MealPlan Parser] Found embedded meal in prep: %s (remaining: %d chars)", embeddedName[:min(len(embeddedName), 50)], len(embeddedPrep))
						remaining = embeddedPrep // Continue with prep text after this meal
					} else {
						// No more embedded meals, add remaining as preparation
						if remaining != "" {
							if preparation.Len() > 0 {
								preparation.WriteString(" ")
							}
							preparation.WriteString(remaining)
						}
						break
					}
				}
			}
			continue
		}

		if inIngredients {
			if ingredients.Len() > 0 {
				ingredients.WriteString(" ")
			}
			// Check for embedded meal in ingredients line too
			if isMealName(line) {
				saveMeal()
				mealName.Reset()
				mealName.WriteString(line)
				inIngredients = false
				inPreparation = false
				log.Printf("[MealPlan Parser] New meal name in ingredients: %s", line[:min(len(line), 50)])
			} else {
				ingredients.WriteString(line)
			}
		} else if inPreparation {
			// Check if this line contains an embedded meal name
			if before, embeddedName, embeddedIngred, embeddedPrep, embeddedSnacks, found := detectEmbeddedMeal(line); found {
				// Add prep text before embedded meal
				if before != "" {
					if preparation.Len() > 0 {
						preparation.WriteString(" ")
					}
					preparation.WriteString(before)
				}
				// Save current meal
				saveMeal()

				// If snacks text was found, save it
				if embeddedSnacks != "" && snacksText == "" {
					snacksText = embeddedSnacks
					log.Printf("[MealPlan Parser] Captured snacks/colaciones text (%d chars)", len(snacksText))
				}

				// Start new meal with embedded content
				mealName.Reset()
				mealName.WriteString(embeddedName)
				if embeddedIngred != "" {
					ingredients.WriteString(embeddedIngred)
					inIngredients = true
				}
				if embeddedPrep != "" {
					preparation.WriteString(embeddedPrep)
					inPreparation = true
				}
				log.Printf("[MealPlan Parser] Found embedded meal: %s", embeddedName[:min(len(embeddedName), 50)])
			} else {
				// Debug: log prep lines for Viernes/Sábado
				if currentDay == "Viernes" || currentDay == "Sábado" {
					log.Printf("[MealPlan Parser] %s prep line (no embed): %s", currentDay, line[:min(len(line), 80)])
				}
				if preparation.Len() > 0 {
					preparation.WriteString(" ")
				}
				preparation.WriteString(line)
			}
		}
	}

	saveMeal()
	return meals, snacksText
}

func updateSettingsHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	var req struct {
		MealTimes        map[string]string `json:"meal_times"`
		ReminderSettings any               `json:"reminder_settings"`
		EnableReminders  bool              `json:"enable_reminders"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid data"})
		return
	}

	// Convert meal_times map to JSON string
	mealTimesJSON, err := json.Marshal(req.MealTimes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encode settings"})
		return
	}

	reminderSettingsJSON := ""
	if req.ReminderSettings != nil {
		b, err := json.Marshal(req.ReminderSettings)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encode settings"})
			return
		}
		reminderSettingsJSON = string(b)
	}

	_, err = db.Exec(`
		INSERT INTO user_settings (user_id, meal_times, reminder_settings, enable_reminders)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			meal_times = excluded.meal_times,
			reminder_settings = excluded.reminder_settings,
			enable_reminders = excluded.enable_reminders
	`, claims.UserID, string(mealTimesJSON), reminderSettingsJSON, req.EnableReminders)

	if err != nil {
		log.Printf("[Settings] Error saving: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func getSettingsHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	var mealTimesJSON string
	var reminderSettingsJSON sql.NullString
	var enableReminders bool

	err := db.QueryRow(`
		SELECT meal_times, reminder_settings, enable_reminders
		FROM user_settings
		WHERE user_id = ?
	`, claims.UserID).Scan(&mealTimesJSON, &reminderSettingsJSON, &enableReminders)

	if err == sql.ErrNoRows {
		// Return default settings
		c.JSON(http.StatusOK, gin.H{
			"meal_times": map[string]string{
				"breakfast": "08:00",
				"lunch":     "14:00",
				"dinner":    "20:00",
				"snack":     "16:00",
			},
			"reminder_settings": gin.H{
				"medicineMealOffsetMinutes":    30,
				"diabetesPreMealMinutesBefore": 15,
				"diabetesGlucoseHoursAfter":    2,
				"diabetesActivityMinutesAfter": 30,
			},
			"enable_reminders": false,
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch settings"})
		return
	}

	var mealTimes map[string]string
	if err := json.Unmarshal([]byte(mealTimesJSON), &mealTimes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode settings"})
		return
	}

	var reminderSettings any = gin.H{
		"medicineMealOffsetMinutes":    30,
		"diabetesPreMealMinutesBefore": 15,
		"diabetesGlucoseHoursAfter":    2,
		"diabetesActivityMinutesAfter": 30,
	}
	if reminderSettingsJSON.Valid && strings.TrimSpace(reminderSettingsJSON.String) != "" {
		var parsed any
		if err := json.Unmarshal([]byte(reminderSettingsJSON.String), &parsed); err == nil {
			reminderSettings = parsed
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"meal_times":        mealTimes,
		"reminder_settings": reminderSettings,
		"enable_reminders":  enableReminders,
	})
}

func createAppointmentHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	var req struct {
		Title           string `json:"title" binding:"required"`
		Description     string `json:"description"`
		AppointmentDate string `json:"appointment_date" binding:"required"`
		AppointmentTime string `json:"appointment_time" binding:"required"`
		Notes           string `json:"notes"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid data"})
		return
	}

	createdAt := time.Now().Format("2006-01-02 15:04:05")

	// Use user's assigned nutritionist for the appointment
	var nutritionistID sql.NullInt64
	if err := db.QueryRow(`SELECT nutritionist_id FROM users WHERE id = ?`, claims.UserID).Scan(&nutritionistID); err != nil {
		log.Printf("[Appointments] Error fetching assigned nutritionist: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch assigned nutritionist"})
		return
	}
	if !nutritionistID.Valid || nutritionistID.Int64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "please assign a nutritionist before booking"})
		return
	}

	result, err := db.Exec(`
		INSERT INTO appointments (user_id, nutritionist_id, title, description, appointment_date, appointment_time, status, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)
	`, claims.UserID, nutritionistID.Int64, req.Title, req.Description, req.AppointmentDate, req.AppointmentTime, req.Notes, createdAt)

	if err != nil {
		log.Printf("[Appointments] Error creating: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create appointment"})
		return
	}

	id, _ := result.LastInsertId()

	// Crear notificación para el usuario sobre su nueva cita
	_, err = db.Exec(`
		INSERT INTO notifications (user_id, type, title, message, related_id, is_read, created_at)
		VALUES (?, 'appointment', 'Nueva Cita Programada', ?, ?, 0, ?)
	`, claims.UserID, fmt.Sprintf("Tienes una cita programada: %s el %s a las %s", req.Title, req.AppointmentDate, req.AppointmentTime), id, createdAt)

	if err != nil {
		log.Printf("[Appointments] Warning: Failed to create notification: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{"id": id, "ok": true})
}

func getAppointmentsHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	month := c.Query("month")
	status := c.Query("status")
	archived := c.Query("archived") // "true" to show archived, omit for active only

	query := `SELECT id, user_id, title, description, appointment_date, appointment_time, status, notes, created_at
	          FROM appointments WHERE user_id = ? AND is_archived = ?`
	args := []interface{}{claims.UserID, 0} // default: active only

	if archived == "true" {
		// Show archived instead
		query = `SELECT id, user_id, title, description, appointment_date, appointment_time, status, notes, created_at
		          FROM appointments WHERE user_id = ? AND is_archived = ?`
		args = []interface{}{claims.UserID, 1}
	}

	if month != "" {
		query += " AND strftime('%Y-%m', appointment_date) = ?"
		args = append(args, month)
	}

	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}

	query += " ORDER BY appointment_date DESC, appointment_time DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointments"})
		return
	}
	defer rows.Close()

	var appointments []map[string]interface{}
	for rows.Next() {
		var id, userID int
		var title, description, appointmentDate, appointmentTime, status, notes, createdAt string

		rows.Scan(&id, &userID, &title, &description, &appointmentDate, &appointmentTime, &status, &notes, &createdAt)
		appointments = append(appointments, map[string]interface{}{
			"id":               id,
			"user_id":          userID,
			"title":            title,
			"description":      description,
			"appointment_date": appointmentDate,
			"appointment_time": appointmentTime,
			"status":           status,
			"notes":            notes,
			"created_at":       createdAt,
		})
	}

	if appointments == nil {
		appointments = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, appointments)
}

func updateAppointmentHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	appointmentID := c.Param("id")

	var req struct {
		Title           string `json:"title"`
		Description     string `json:"description"`
		AppointmentDate string `json:"appointment_date"`
		AppointmentTime string `json:"appointment_time"`
		Status          string `json:"status"`
		Notes           string `json:"notes"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid data"})
		return
	}

	_, err := db.Exec(`
		UPDATE appointments
		SET title = ?, description = ?, appointment_date = ?, appointment_time = ?, status = ?, notes = ?
		WHERE id = ? AND user_id = ?
	`, req.Title, req.Description, req.AppointmentDate, req.AppointmentTime, req.Status, req.Notes, appointmentID, claims.UserID)

	if err != nil {
		log.Printf("[Appointments] Error updating: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update appointment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func deleteAppointmentHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	appointmentID := c.Param("id")

	// Soft delete: mark as archived
	_, err := db.Exec(`UPDATE appointments SET is_archived = 1 WHERE id = ? AND user_id = ?`, appointmentID, claims.UserID)

	if err != nil {
		log.Printf("[Appointments] Error archiving: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to archive appointment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func archiveAppointmentHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	appointmentID := c.Param("id")

	_, err := db.Exec(`UPDATE appointments SET is_archived = 1 WHERE id = ? AND user_id = ?`, appointmentID, claims.UserID)
	if err != nil {
		log.Printf("[Appointments] Error archiving: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to archive"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func restoreAppointmentHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	appointmentID := c.Param("id")

	_, err := db.Exec(`UPDATE appointments SET is_archived = 0 WHERE id = ? AND user_id = ?`, appointmentID, claims.UserID)
	if err != nil {
		log.Printf("[Appointments] Error restoring: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to restore"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Recipe handlers
func getRecipesHandler(c *gin.Context) {
	category := c.Query("category")
	search := c.Query("search")

	query := `SELECT id, name, category, prep_time, servings, calories, protein, carbs, fat, ingredients, instructions, image_url, created_at FROM recipes WHERE 1=1`
	args := []interface{}{}

	if category != "" && category != "all" {
		query += " AND category = ?"
		args = append(args, category)
	}

	if search != "" {
		query += " AND (name LIKE ? OR ingredients LIKE ?)"
		searchTerm := "%" + search + "%"
		args = append(args, searchTerm, searchTerm)
	}

	query += " ORDER BY name ASC"

	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("[Recipes] Error querying: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get recipes"})
		return
	}
	defer rows.Close()

	recipes := []map[string]interface{}{}
	for rows.Next() {
		var id, prepTime, servings, calories int
		var name, category, ingredients, instructions, imageURL, createdAt string
		var protein, carbs, fat float64

		if err := rows.Scan(&id, &name, &category, &prepTime, &servings, &calories, &protein, &carbs, &fat, &ingredients, &instructions, &imageURL, &createdAt); err != nil {
			log.Printf("[Recipes] Error scanning: %v", err)
			continue
		}

		recipes = append(recipes, map[string]interface{}{
			"id":           id,
			"name":         name,
			"category":     category,
			"prep_time":    prepTime,
			"servings":     servings,
			"calories":     calories,
			"protein":      protein,
			"carbs":        carbs,
			"fat":          fat,
			"ingredients":  ingredients,
			"instructions": instructions,
			"image_url":    imageURL,
			"created_at":   createdAt,
		})
	}

	c.JSON(http.StatusOK, recipes)
}

func getRecipeHandler(c *gin.Context) {
	recipeID := c.Param("id")

	var id, prepTime, servings, calories int
	var name, category, ingredients, instructions, imageURL, createdAt string
	var protein, carbs, fat float64

	err := db.QueryRow(`
		SELECT id, name, category, prep_time, servings, calories, protein, carbs, fat, ingredients, instructions, image_url, created_at 
		FROM recipes WHERE id = ?
	`, recipeID).Scan(&id, &name, &category, &prepTime, &servings, &calories, &protein, &carbs, &fat, &ingredients, &instructions, &imageURL, &createdAt)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "recipe not found"})
		} else {
			log.Printf("[Recipes] Error getting recipe: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get recipe"})
		}
		return
	}

	c.JSON(http.StatusOK, map[string]interface{}{
		"id":           id,
		"name":         name,
		"category":     category,
		"prep_time":    prepTime,
		"servings":     servings,
		"calories":     calories,
		"protein":      protein,
		"carbs":        carbs,
		"fat":          fat,
		"ingredients":  ingredients,
		"instructions": instructions,
		"image_url":    imageURL,
		"created_at":   createdAt,
	})
}

func seedDefaultUsers() error {
	adminEmail := getenvOrDefault("ADMIN_EMAIL", "admin@bienestar.test")
	adminPassword := getenvOrDefault("ADMIN_PASSWORD", "Admin123!")
	adminName := getenvOrDefault("ADMIN_NAME", "Admin")

	nutriEmail := getenvOrDefault("NUTRITIONIST_EMAIL", "nutriologa@bienestar.test")
	nutriPassword := getenvOrDefault("NUTRITIONIST_PASSWORD", "Nutri123!")
	nutriName := getenvOrDefault("NUTRITIONIST_NAME", "Nutrióloga")

	if err := ensureUserExists(adminEmail, adminName, adminPassword, "admin"); err != nil {
		return err
	}

	if err := ensureUserExists(nutriEmail, nutriName, nutriPassword, "nutritionist"); err != nil {
		return err
	}

	// Documented local test accounts (used in guides and smoke tests)
	if err := ensureUserExists("user@test.com", "Test User", "password123", "user"); err != nil {
		return err
	}
	if err := ensureUserExists("nutritionist@test.com", "Test Nutritionist", "password123", "nutritionist"); err != nil {
		return err
	}
	if err := ensureUserExists("admin@test.com", "Test Admin", "password123", "admin"); err != nil {
		return err
	}

	return nil
}

func ensureUserExists(email, name, password, role string) error {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users WHERE email = ?`, email).Scan(&count); err != nil {
		return err
	}

	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	if _, err := db.Exec(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`, name, email, string(hash), role); err != nil {
		return err
	}

	log.Printf("[Seed] Created %s account %s", role, email)
	return nil
}

func seedRecipes() error {
	// Check if recipes already exist
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM recipes").Scan(&count)
	if err != nil {
		return err
	}

	if count > 0 {
		log.Println("[Recipes] Already seeded")
		return nil
	}

	recipes := []struct {
		name         string
		category     string
		prepTime     int
		servings     int
		calories     int
		protein      float64
		carbs        float64
		fat          float64
		ingredients  string
		instructions string
		imageURL     string
	}{
		{
			name:         "Ensalada de Pollo y Aguacate",
			category:     "Ensaladas",
			prepTime:     15,
			servings:     2,
			calories:     320,
			protein:      28.0,
			carbs:        12.0,
			fat:          18.0,
			ingredients:  "2 pechugas de pollo cocidas\n1 aguacate\n2 tazas de lechuga mixta\n1 tomate\n1/4 cebolla morada\nJugo de 1 limón\n2 cdas aceite de oliva\nSal y pimienta",
			instructions: "1. Corta el pollo en cubos\n2. Pica el aguacate, tomate y cebolla\n3. Mezcla todo con la lechuga\n4. Aliña con limón, aceite, sal y pimienta",
			imageURL:     "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
		},
		{
			name:         "Salmón al Horno con Verduras",
			category:     "Proteínas",
			prepTime:     30,
			servings:     2,
			calories:     380,
			protein:      35.0,
			carbs:        15.0,
			fat:          22.0,
			ingredients:  "2 filetes de salmón\n1 calabacín\n1 pimiento rojo\n200g brócoli\n2 cdas aceite de oliva\nAjo en polvo\nLimón\nSal y pimienta",
			instructions: "1. Precalienta el horno a 200°C\n2. Corta las verduras en trozos\n3. Coloca el salmón y verduras en una bandeja\n4. Rocía con aceite, ajo, sal y pimienta\n5. Hornea por 20-25 minutos",
			imageURL:     "https://images.unsplash.com/photo-1467003909585-2f8a72700288",
		},
		{
			name:         "Bowl de Quinoa y Garbanzos",
			category:     "Vegetariana",
			prepTime:     25,
			servings:     3,
			calories:     350,
			protein:      15.0,
			carbs:        48.0,
			fat:          12.0,
			ingredients:  "1 taza quinoa cocida\n1 lata garbanzos escurridos\n1 pepino\n1 taza tomates cherry\nEspinacas frescas\n1/4 taza hummus\nJugo de limón\nComino",
			instructions: "1. Cocina la quinoa según instrucciones del paquete\n2. Saltea los garbanzos con comino\n3. Corta el pepino y tomates\n4. Arma el bowl con quinoa de base\n5. Agrega garbanzos, verduras y hummus",
			imageURL:     "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
		},
		{
			name:         "Omelette de Claras con Espinacas",
			category:     "Desayunos",
			prepTime:     10,
			servings:     1,
			calories:     180,
			protein:      22.0,
			carbs:        6.0,
			fat:          8.0,
			ingredients:  "4 claras de huevo\n1 taza espinacas frescas\n1/4 taza champiñones\n1/4 taza queso cottage\nSal y pimienta\nSpray de aceite",
			instructions: "1. Bate las claras con sal y pimienta\n2. Saltea las espinacas y champiñones\n3. Vierte las claras en un sartén con spray\n4. Agrega las verduras y queso cottage\n5. Dobla el omelette y sirve",
			imageURL:     "https://images.unsplash.com/photo-1525351484163-7529414344d8",
		},
		{
			name:         "Tacos de Pescado con Repollo",
			category:     "Proteínas",
			prepTime:     20,
			servings:     3,
			calories:     290,
			protein:      25.0,
			carbs:        28.0,
			fat:          10.0,
			ingredients:  "400g filete de pescado blanco\n6 tortillas de maíz\n2 tazas repollo morado rallado\n1 aguacate\n1 limón\nCilantro fresco\nSalsa picante\nComino y pimentón",
			instructions: "1. Sazona el pescado con comino y pimentón\n2. Cocina en sartén 3-4 min por lado\n3. Calienta las tortillas\n4. Mezcla el repollo con limón\n5. Arma los tacos con pescado, repollo y aguacate",
			imageURL:     "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b",
		},
		{
			name:         "Smoothie Bowl de Frutas",
			category:     "Desayunos",
			prepTime:     10,
			servings:     1,
			calories:     280,
			protein:      12.0,
			carbs:        45.0,
			fat:          8.0,
			ingredients:  "1 plátano congelado\n1/2 taza fresas\n1/2 taza arándanos\n1 scoop proteína en polvo\n1/2 taza leche de almendras\nToppings: granola, coco rallado, semillas de chía",
			instructions: "1. Licúa el plátano, fresas, arándanos, proteína y leche\n2. Vierte en un bowl\n3. Decora con granola, coco y semillas\n4. Sirve inmediatamente",
			imageURL:     "https://images.unsplash.com/photo-1590301157890-4810ed352733",
		},
		{
			name:         "Pollo a la Plancha con Ensalada",
			category:     "Proteínas",
			prepTime:     15,
			servings:     2,
			calories:     280,
			protein:      32.0,
			carbs:        8.0,
			fat:          14.0,
			ingredients:  "2 pechugas de pollo\n2 tazas de lechuga\n1 taza de rúcula\n10 tomates cherry\n1/4 cebolla morada\n2 cdas aceite de oliva\nVinagre balsámico\nSal, pimienta y ajo en polvo",
			instructions: "1. Sazona el pollo con sal, pimienta y ajo\n2. Cocina en plancha 5-6 min por lado\n3. Prepara la ensalada con lechugas y verduras\n4. Aliña con aceite y vinagre\n5. Sirve el pollo sobre la ensalada",
			imageURL:     "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca",
		},
		{
			name:         "Pasta Integral con Vegetales",
			category:     "Vegetariana",
			prepTime:     20,
			servings:     3,
			calories:     320,
			protein:      12.0,
			carbs:        52.0,
			fat:          8.0,
			ingredients:  "200g pasta integral\n1 calabacín\n1 berenjena pequeña\n1 pimiento\n2 dientes ajo\n2 cdas aceite de oliva\nAlbahaca fresca\nQueso parmesano rallado",
			instructions: "1. Cocina la pasta según las instrucciones\n2. Corta los vegetales en cubos\n3. Saltea el ajo con aceite\n4. Agrega los vegetales y cocina 8-10 min\n5. Mezcla con la pasta, albahaca y parmesano",
			imageURL:     "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9",
		},
	}

	for _, r := range recipes {
		_, err := db.Exec(`
			INSERT INTO recipes (name, category, prep_time, servings, calories, protein, carbs, fat, ingredients, instructions, image_url, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		`, r.name, r.category, r.prepTime, r.servings, r.calories, r.protein, r.carbs, r.fat, r.ingredients, r.instructions, r.imageURL)

		if err != nil {
			log.Printf("[Recipes] Error seeding recipe %s: %v", r.name, err)
			return err
		}
	}

	log.Println("[Recipes] Seeded successfully")
	return nil
}

// Message handlers
func sendMessageHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	var input struct {
		RecipientID int    `json:"recipient_id"`
		Content     string `json:"content"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	if input.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content is required"})
		return
	}

	result, err := db.Exec(`
		INSERT INTO messages (sender_id, recipient_id, content, is_read, created_at)
		VALUES (?, ?, ?, 0, datetime('now'))
	`, claims.UserID, input.RecipientID, input.Content)

	if err != nil {
		log.Printf("[Messages] Error creating: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send message"})
		return
	}

	messageID, _ := result.LastInsertId()

	// Get sender name for notification
	var senderName string
	db.QueryRow(`SELECT name FROM users WHERE id = ?`, claims.UserID).Scan(&senderName)

	// Create notification for recipient
	notifTitle := "Nuevo mensaje"
	notifMsg := fmt.Sprintf("De: %s", senderName)
	_, err = db.Exec(`
		INSERT INTO notifications (user_id, type, title, message, related_id, is_read, created_at)
		VALUES (?, 'message', ?, ?, ?, 0, ?)
	`, input.RecipientID, notifTitle, notifMsg, messageID)

	if err != nil {
		log.Printf("[Messages] Warning: Failed to create notification: %v", err)
		// Don't fail the message send if notification creation fails
	} else {
		log.Printf("[Messages] Notification created for user %d", input.RecipientID)
	}

	c.JSON(http.StatusOK, gin.H{
		"id":           messageID,
		"sender_id":    claims.UserID,
		"recipient_id": input.RecipientID,
		"content":      input.Content,
		"is_read":      false,
		"created_at":   time.Now().Format(time.RFC3339),
	})
}

func getMessagesHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	otherUserID := c.Query("user_id")

	if otherUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	rows, err := db.Query(`
		SELECT m.id, m.sender_id, m.recipient_id, m.content, m.is_read, m.created_at, 
		       u1.name as sender_name, u2.name as recipient_name
		FROM messages m
		LEFT JOIN users u1 ON m.sender_id = u1.id
		LEFT JOIN users u2 ON m.recipient_id = u2.id
		LEFT JOIN deleted_messages d ON d.message_id = m.id AND d.user_id = ?
		WHERE d.id IS NULL AND (
			(m.sender_id = ? AND m.recipient_id = ?) 
			OR (m.sender_id = ? AND m.recipient_id = ?)
		)
		ORDER BY m.created_at ASC
	`, claims.UserID, claims.UserID, otherUserID, otherUserID, claims.UserID)

	if err != nil {
		log.Printf("[Messages] Error querying: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get messages"})
		return
	}
	defer rows.Close()

	messages := []map[string]interface{}{}
	for rows.Next() {
		var id, senderID, recipientID int
		var content, createdAt, senderName, recipientName string
		var isRead bool

		if err := rows.Scan(&id, &senderID, &recipientID, &content, &isRead, &createdAt, &senderName, &recipientName); err != nil {
			log.Printf("[Messages] Error scanning: %v", err)
			continue
		}

		messages = append(messages, map[string]interface{}{
			"id":             id,
			"sender_id":      senderID,
			"recipient_id":   recipientID,
			"content":        content,
			"is_read":        isRead,
			"created_at":     createdAt,
			"sender_name":    senderName,
			"recipient_name": recipientName,
		})
	}

	c.JSON(http.StatusOK, messages)
}

func getConversationsHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	log.Printf("[Messages] Getting conversations for user_id=%d", claims.UserID)

	// Get unique conversation partners with their latest message info
	rows, err := db.Query(`
		SELECT DISTINCT
			CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END as user_id,
			u.name as user_name,
			u.role as user_role
		FROM messages m
		LEFT JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END
		LEFT JOIN deleted_messages d ON d.message_id = m.id AND d.user_id = ?
		WHERE d.id IS NULL AND (m.sender_id = ? OR m.recipient_id = ?)
		ORDER BY m.id DESC
	`, claims.UserID, claims.UserID, claims.UserID, claims.UserID, claims.UserID)

	if err != nil {
		log.Printf("[Messages] Error getting conversations: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get conversations"})
		return
	}
	defer rows.Close()

	conversations := []map[string]interface{}{}
	seenUsers := make(map[int]bool)

	for rows.Next() {
		var otherUserID int
		var otherUserName, otherUserRole string

		if err := rows.Scan(&otherUserID, &otherUserName, &otherUserRole); err != nil {
			log.Printf("[Messages] Error scanning conversation: %v", err)
			continue
		}

		// Skip duplicates
		if seenUsers[otherUserID] {
			continue
		}
		seenUsers[otherUserID] = true

		// Get last message details for this conversation
		var lastMessage sql.NullString
		var lastMessageTime sql.NullString
		db.QueryRow(`
			SELECT m.content, m.created_at
			FROM messages m
			LEFT JOIN deleted_messages d ON d.message_id = m.id AND d.user_id = ?
			WHERE d.id IS NULL AND (
				(m.sender_id = ? AND m.recipient_id = ?) OR 
				(m.sender_id = ? AND m.recipient_id = ?)
			)
			ORDER BY m.created_at DESC
			LIMIT 1
		`, claims.UserID, claims.UserID, otherUserID, otherUserID, claims.UserID).Scan(&lastMessage, &lastMessageTime)

		// Count unread messages from this user
		var unreadCount int
		db.QueryRow(`
			SELECT COUNT(*)
			FROM messages m
			LEFT JOIN deleted_messages d ON d.message_id = m.id AND d.user_id = ?
			WHERE d.id IS NULL AND m.sender_id = ? AND m.recipient_id = ? AND m.is_read = 0
		`, claims.UserID, otherUserID, claims.UserID).Scan(&unreadCount)

		conversations = append(conversations, map[string]interface{}{
			"user_id":           otherUserID,
			"user_name":         otherUserName,
			"user_role":         otherUserRole,
			"last_message":      lastMessage.String,
			"last_message_time": lastMessageTime.String,
			"unread_count":      unreadCount,
		})
	}

	log.Printf("[Messages] Found %d conversations for user_id=%d", len(conversations), claims.UserID)

	// Always return an array (empty if no conversations), never nil
	if conversations == nil {
		conversations = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, conversations)
}

func markMessageAsReadHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	messageID := c.Param("id")

	// Only mark as read if current user is the recipient
	_, err := db.Exec(`
		UPDATE messages 
		SET is_read = 1 
		WHERE id = ? AND recipient_id = ?
	`, messageID, claims.UserID)

	if err != nil {
		log.Printf("[Notifications] Error marking as read: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark message as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// deleteMessageHandler removes a message if the requester is sender or recipient
func deleteMessageHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	messageID := c.Param("id")

	// Soft delete per user: mark hidden for this user
	_, err := db.Exec(`
		INSERT OR IGNORE INTO deleted_messages (user_id, message_id, created_at)
		VALUES (?, ?, datetime('now'))
	`, claims.UserID, messageID)

	if err != nil {
		log.Printf("[Messages] Error soft-deleting: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// getArchivedMessagesHandler returns messages hidden by current user in a conversation
func getArchivedMessagesHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	otherUserID := c.Query("user_id")

	if otherUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	rows, err := db.Query(`
		SELECT m.id, m.sender_id, m.recipient_id, m.content, m.is_read, m.created_at,
		       u1.name as sender_name, u2.name as recipient_name
		FROM messages m
		LEFT JOIN users u1 ON m.sender_id = u1.id
		LEFT JOIN users u2 ON m.recipient_id = u2.id
		INNER JOIN deleted_messages d ON d.message_id = m.id AND d.user_id = ?
		WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
		ORDER BY m.created_at DESC
	`, claims.UserID, claims.UserID, otherUserID, otherUserID, claims.UserID)

	if err != nil {
		log.Printf("[Messages] Error querying archived: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get archived messages"})
		return
	}
	defer rows.Close()

	messages := []map[string]interface{}{}
	for rows.Next() {
		var id, senderID, recipientID int
		var content, createdAt, senderName, recipientName string
		var isRead bool

		if err := rows.Scan(&id, &senderID, &recipientID, &content, &isRead, &createdAt, &senderName, &recipientName); err != nil {
			log.Printf("[Messages] Error scanning archived: %v", err)
			continue
		}

		messages = append(messages, map[string]interface{}{
			"id":             id,
			"sender_id":      senderID,
			"recipient_id":   recipientID,
			"content":        content,
			"is_read":        isRead,
			"created_at":     createdAt,
			"sender_name":    senderName,
			"recipient_name": recipientName,
		})
	}

	c.JSON(http.StatusOK, messages)
}

// getNotificationsHandler returns all notifications for the current user
func getNotificationsHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	rows, err := db.Query(`
		SELECT id, type, title, message, related_id, is_read, created_at
		FROM notifications
		WHERE user_id = ?
		ORDER BY created_at DESC
		LIMIT 50
	`, claims.UserID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch notifications"})
		return
	}
	defer rows.Close()

	notifications := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var relatedID sql.NullInt64
		var notifType, title, message, createdAt string
		var isRead bool

		if err := rows.Scan(&id, &notifType, &title, &message, &relatedID, &isRead, &createdAt); err != nil {
			continue
		}

		notification := map[string]interface{}{
			"id":         id,
			"type":       notifType,
			"title":      title,
			"message":    message,
			"is_read":    isRead,
			"created_at": createdAt,
		}

		if relatedID.Valid {
			notification["related_id"] = relatedID.Int64
		} else {
			notification["related_id"] = nil
		}

		notifications = append(notifications, notification)
	}

	c.JSON(http.StatusOK, notifications)
}

// markNotificationAsReadHandler marks a single notification as read
func markNotificationAsReadHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	notificationID := c.Param("id")

	result, err := db.Exec(`
		UPDATE notifications 
		SET is_read = 1 
		WHERE id = ? AND user_id = ?
	`, notificationID, claims.UserID)

	if err != nil {
		log.Printf("[Notifications] Error marking as read: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark notification as read"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		log.Printf("[Notifications] No notification found with id=%s for user=%d", notificationID, claims.UserID)
		c.JSON(http.StatusNotFound, gin.H{"error": "notification not found or doesn't belong to user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// markAllNotificationsAsReadHandler marks all notifications as read
func markAllNotificationsAsReadHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	_, err := db.Exec(`
		UPDATE notifications 
		SET is_read = 1 
		WHERE user_id = ?
	`, claims.UserID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark all as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// registerPushTokenHandler registers a push notification token for the user
func registerPushTokenHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	var req struct {
		Token      string `json:"token" binding:"required"`
		DeviceType string `json:"device_type"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "datos inválidos"})
		return
	}

	// Delete old token for this user if exists (one token per user for now)
	db.Exec(`DELETE FROM push_tokens WHERE user_id = ?`, claims.UserID)

	// Insert new token
	_, err := db.Exec(`
		INSERT INTO push_tokens (user_id, token, device_type, created_at)
		VALUES (?, ?, ?, ?)
	`, claims.UserID, req.Token, req.DeviceType, time.Now().Format("2006-01-02 15:04:05"))

	if err != nil {
		log.Printf("[PushToken] Error saving token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save push token"})
		return
	}

	log.Printf("[PushToken] ✅ Token registered for user %d (%s)", claims.UserID, req.DeviceType)
	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "push token registered"})
}

// deletePushTokenHandler removes the push token for the user
func deletePushTokenHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	_, err := db.Exec(`DELETE FROM push_tokens WHERE user_id = ?`, claims.UserID)
	if err != nil {
		log.Printf("[PushToken] Error deleting token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete push token"})
		return
	}

	log.Printf("[PushToken] Token deleted for user %d", claims.UserID)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// sendPushNotification sends a push notification via Expo API
func sendPushNotification(userID int, title, body string, data map[string]interface{}) error {
	// Get push token for user
	var token string
	err := db.QueryRow(`SELECT token FROM push_tokens WHERE user_id = ? LIMIT 1`, userID).Scan(&token)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("[PushNotification] No token found for user %d", userID)
			return nil // Not an error, user just doesn't have push enabled
		}
		return err
	}

	// Prepare Expo push notification payload
	type ExpoPushMessage struct {
		To       string                 `json:"to"`
		Sound    string                 `json:"sound"`
		Title    string                 `json:"title"`
		Body     string                 `json:"body"`
		Data     map[string]interface{} `json:"data,omitempty"`
		Priority string                 `json:"priority"`
	}

	message := ExpoPushMessage{
		To:       token,
		Sound:    "default",
		Title:    title,
		Body:     body,
		Data:     data,
		Priority: "high",
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("error marshaling push notification: %v", err)
	}

	// Send to Expo push notification service
	resp, err := http.Post(
		"https://exp.host/--/api/v2/push/send",
		"application/json",
		strings.NewReader(string(jsonData)),
	)
	if err != nil {
		return fmt.Errorf("error sending push notification: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[PushNotification] ⚠️ Expo API returned status %d for user %d", resp.StatusCode, userID)
		return fmt.Errorf("expo push API returned status %d", resp.StatusCode)
	}

	log.Printf("[PushNotification] ✅ Push notification sent to user %d: %s", userID, title)
	return nil
}

// getAppointmentChangesHandler gets proposed changes for an appointment
func getAppointmentChangesHandler(c *gin.Context) {
	appointmentID := c.Param("appointment_id")

	rows, err := db.Query(`
		SELECT ac.id, ac.new_date, ac.new_time, ac.reason, ac.status, ac.created_at, ac.responded_at,
			u.name as proposed_by_name
		FROM appointment_changes ac
		LEFT JOIN users u ON u.id = ac.proposed_by
		WHERE ac.appointment_id = ?
		ORDER BY ac.created_at DESC
	`, appointmentID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch changes"})
		return
	}
	defer rows.Close()

	changes := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var newDate, newTime, status, createdAt, proposedByName string
		var reason sql.NullString
		var respondedAt sql.NullString

		if err := rows.Scan(&id, &newDate, &newTime, &reason, &status, &createdAt, &respondedAt, &proposedByName); err != nil {
			log.Printf("[AppointmentChanges] Error scanning row: %v", err)
			continue
		}

		change := map[string]interface{}{
			"id":               id,
			"new_date":         newDate,
			"new_time":         newTime,
			"status":           status,
			"created_at":       createdAt,
			"proposed_by_name": proposedByName,
		}

		if reason.Valid {
			change["reason"] = reason.String
		} else {
			change["reason"] = ""
		}

		if respondedAt.Valid {
			change["responded_at"] = respondedAt.String
		} else {
			change["responded_at"] = nil
		}

		changes = append(changes, change)
	}

	c.JSON(http.StatusOK, changes)
}

// acceptAppointmentChangeHandler accepts a proposed change
func acceptAppointmentChangeHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	changeID := c.Param("id")

	// Get change details
	var appointmentID int
	var newDate, newTime string
	err := db.QueryRow(`
		SELECT appointment_id, new_date, new_time 
		FROM appointment_changes 
		WHERE id = ?
	`, changeID).Scan(&appointmentID, &newDate, &newTime)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "change not found"})
		return
	}

	// Verify user owns the appointment
	var userID int
	db.QueryRow(`SELECT user_id FROM appointments WHERE id = ?`, appointmentID).Scan(&userID)
	if userID != claims.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized"})
		return
	}

	// Update appointment
	_, err = db.Exec(`
		UPDATE appointments 
		SET appointment_date = ?, appointment_time = ?
		WHERE id = ?
	`, newDate, newTime, appointmentID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update appointment"})
		return
	}

	// Update change status
	db.Exec(`
		UPDATE appointment_changes 
		SET status = 'accepted', responded_at = ?
		WHERE id = ?
	`, time.Now().Format("2006-01-02 15:04:05"), changeID)

	// Notify nutritionist
	var nutritionistID int
	db.QueryRow(`
		SELECT proposed_by FROM appointment_changes WHERE id = ?
	`, changeID).Scan(&nutritionistID)

	db.Exec(`
		INSERT INTO notifications (user_id, type, title, message, related_id, created_at)
		VALUES (?, 'appointment_accepted', 'Cambio Aceptado', ?, ?, ?)
	`, nutritionistID, "El paciente ha aceptado el cambio de cita.", appointmentID, time.Now().Format("2006-01-02 15:04:05"))

	c.JSON(http.StatusOK, gin.H{"message": "change accepted"})
}

// rejectAppointmentChangeHandler rejects a proposed change
func rejectAppointmentChangeHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	changeID := c.Param("id")

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	// Get change details
	var appointmentID, proposedBy int
	err := db.QueryRow(`
		SELECT appointment_id, proposed_by 
		FROM appointment_changes 
		WHERE id = ?
	`, changeID).Scan(&appointmentID, &proposedBy)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "change not found"})
		return
	}

	// Verify user owns the appointment
	var userID int
	db.QueryRow(`SELECT user_id FROM appointments WHERE id = ?`, appointmentID).Scan(&userID)
	if userID != claims.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized"})
		return
	}

	// Update change status
	db.Exec(`
		UPDATE appointment_changes 
		SET status = 'rejected', responded_at = ?
		WHERE id = ?
	`, time.Now().Format("2006-01-02 15:04:05"), changeID)

	// Notify nutritionist
	message := "El paciente ha rechazado el cambio de cita."
	if req.Reason != "" {
		message += " Razón: " + req.Reason
	}

	db.Exec(`
		INSERT INTO notifications (user_id, type, title, message, related_id, created_at)
		VALUES (?, 'appointment_rejected', 'Cambio Rechazado', ?, ?, ?)
	`, proposedBy, message, appointmentID, time.Now().Format("2006-01-02 15:04:05"))

	c.JSON(http.StatusOK, gin.H{"message": "change rejected"})
}

// --- Nutritionist Handlers (stubs) ---
func listNutritionistsHandler(c *gin.Context) {
	rows, err := db.Query(`SELECT id, name, email FROM users WHERE role = 'nutritionist' ORDER BY id DESC`)
	if err != nil {
		log.Printf("[Nutritionist] Error listing nutritionists: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list nutritionists"})
		return
	}
	defer rows.Close()

	var nutritionists []gin.H
	for rows.Next() {
		var id int
		var name, email string
		if err := rows.Scan(&id, &name, &email); err != nil {
			log.Printf("[Nutritionist] Error scanning nutritionist: %v", err)
			continue
		}
		nutritionists = append(nutritionists, gin.H{
			"id":    id,
			"name":  name,
			"email": email,
		})
	}

	if nutritionists == nil {
		nutritionists = []gin.H{}
	}

	c.JSON(http.StatusOK, nutritionists)
}
func assignNutritionistHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	var req struct {
		NutritionistID int `json:"nutritionist_id" binding:"required"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "datos inválidos"})
		return
	}
	if req.NutritionistID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nutritionist_id inválido"})
		return
	}

	// Validate that the nutritionist exists and has the right role
	var nutritionistCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users WHERE id = ? AND role = 'nutritionist'`, req.NutritionistID).Scan(&nutritionistCount); err != nil {
		log.Printf("[Nutritionist] Error validating nutritionist: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate nutritionist"})
		return
	}
	if nutritionistCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "nutritionist not found"})
		return
	}

	// Assign (or re-assign) nutritionist
	_, err := db.Exec(`UPDATE users SET nutritionist_id = ? WHERE id = ?`, req.NutritionistID, claims.UserID)
	if err != nil {
		log.Printf("[Nutritionist] Error assigning nutritionist: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to assign nutritionist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "nutritionist_id": req.NutritionistID})
}
func getAvailableSlotsForUserHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "getAvailableSlotsForUserHandler not implemented"})
}
