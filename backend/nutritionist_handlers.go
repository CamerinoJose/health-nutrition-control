package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// listPatientsHandler returns patients assigned to the current nutritionist.
func listPatientsHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	if claims.Role != "nutritionist" {
		c.JSON(http.StatusForbidden, gin.H{"error": "clinical access requires the assigned nutritionist"})
		return
	}
	rows, err := queryDB(`
		SELECT u.id, u.name, u.email, u.role,
			(SELECT COUNT(*) FROM appointments WHERE user_id = u.id) as appointment_count,
			(SELECT MAX(date) FROM histories WHERE user_id = u.id) as last_visit
		FROM users u
		WHERE u.role = 'user' AND u.nutritionist_id = ?
			AND EXISTS (SELECT 1 FROM users n WHERE n.id = ? AND n.role = 'nutritionist')
		ORDER BY u.name
	`, claims.UserID, claims.UserID)
	if err != nil {
		log.Printf("[Nutritionist] Error fetching patients: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch patients"})
		return
	}
	defer rows.Close()

	patients := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var name, email, role string
		var appointmentCount int
		var lastVisit sql.NullString

		if err := rows.Scan(&id, &name, &email, &role, &appointmentCount, &lastVisit); err != nil {
			log.Printf("[Nutritionist] Error scanning patient: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch patients"})
			return
		}

		patients = append(patients, map[string]interface{}{
			"id":                id,
			"name":              name,
			"email":             email,
			"role":              role,
			"appointment_count": appointmentCount,
			"last_visit":        lastVisit.String,
		})
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch patients"})
		return
	}
	c.JSON(http.StatusOK, patients)
}

// getPatientDetailsHandler returns full details of a specific patient
func getPatientDetailsHandler(c *gin.Context) {
	patientID := c.Param("id")
	tx, allowed := beginPatientAccess(c, patientID)
	if !allowed {
		return
	}
	defer tx.Rollback()

	var id int
	var name, email, role string
	err := tx.QueryRowContext(c.Request.Context(), rebindQuery(`SELECT id, name, email, role FROM users WHERE id = ?`), patientID).
		Scan(&id, &name, &email, &role)

	if err != nil {
		log.Printf("[Nutritionist] Error fetching patient: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch patient"})
		return
	}

	// Get health profile
	var profileData map[string]interface{}
	var age sql.NullInt64
	var height, weight, targetWeight sql.NullFloat64
	var birthDate, sex, medicalConditions, medications, allergies, activityLevel, goals sql.NullString

	err = tx.QueryRowContext(c.Request.Context(), rebindQuery(`
		SELECT age, birth_date, sex, height, current_weight, goal_weight,
			medical_conditions, medications, allergies, activity_level, goals
		FROM health_profiles WHERE user_id = ?
	`), patientID).Scan(&age, &birthDate, &sex, &height, &weight, &targetWeight,
		&medicalConditions, &medications, &allergies, &activityLevel, &goals)

	if err == nil {
		if birthDate.Valid {
			calculatedAge, ageErr := ageFromBirthDate(birthDate.String, time.Now())
			if ageErr != nil {
				log.Printf("[Nutritionist] Invalid stored birth date for patient %s", patientID)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid stored birth date"})
				return
			}
			age.Int64 = int64(calculatedAge)
		}
		profileData = map[string]interface{}{
			"age":                age.Int64,
			"birth_date":         birthDate.String,
			"sex":                sex.String,
			"height":             height.Float64,
			"weight":             weight.Float64,
			"target_weight":      targetWeight.Float64,
			"medical_conditions": medicalConditions.String,
			"medications":        medications.String,
			"allergies":          allergies.String,
			"activity_level":     activityLevel.String,
			"goals":              goals.String,
		}
	} else if err != sql.ErrNoRows {
		log.Printf("[Nutritionist] Error fetching patient health profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch patient health profile"})
		return
	}

	// Get latest history entry
	var latestHistory map[string]interface{}
	var histDate string
	var histWeight, histFat, histMuscle float64
	err = tx.QueryRowContext(c.Request.Context(), rebindQuery(`
		SELECT date, weight, fat_percentage, muscle_percentage 
		FROM histories 
		WHERE user_id = ? 
		ORDER BY date DESC LIMIT 1
	`), patientID).Scan(&histDate, &histWeight, &histFat, &histMuscle)

	if err == nil {
		latestHistory = map[string]interface{}{
			"date":              histDate,
			"weight":            histWeight,
			"fat_percentage":    histFat,
			"muscle_percentage": histMuscle,
		}
	} else if err != sql.ErrNoRows {
		log.Printf("[Nutritionist] Error fetching latest patient history: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch patient history"})
		return
	}

	// Get appointment count
	var appointmentCount int
	if err := tx.QueryRowContext(c.Request.Context(), rebindQuery(`SELECT COUNT(*) FROM appointments WHERE user_id = ?`), patientID).Scan(&appointmentCount); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch patient appointments"})
		return
	}

	if !commitClinicalAccess(c, tx) {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":                id,
		"name":              name,
		"email":             email,
		"role":              role,
		"health_profile":    profileData,
		"latest_history":    latestHistory,
		"appointment_count": appointmentCount,
	})
}

// getPatientHistoryHandler returns all history entries for a patient
func getPatientHistoryHandler(c *gin.Context) {
	patientID := c.Param("id")
	tx, allowed := beginPatientAccess(c, patientID)
	if !allowed {
		return
	}
	defer tx.Rollback()

	rows, err := tx.QueryContext(c.Request.Context(), rebindQuery(`
		SELECT id, date, weight, fat_percentage, muscle_percentage
		FROM histories
		WHERE user_id = ?
		ORDER BY date DESC
	`), patientID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch history"})
		return
	}
	defer rows.Close()

	history := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var date string
		var weight, fat, muscle float64

		if err := rows.Scan(&id, &date, &weight, &fat, &muscle); err != nil {
			log.Printf("[Nutritionist] Error scanning history: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch history"})
			return
		}

		history = append(history, map[string]interface{}{
			"id":                id,
			"date":              date,
			"weight":            weight,
			"fat_percentage":    fat,
			"muscle_percentage": muscle,
		})
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch history"})
		return
	}
	rows.Close()
	if !commitClinicalAccess(c, tx) {
		return
	}
	c.JSON(http.StatusOK, history)
}

// createRecipeHandler allows nutritionist to create new recipes
func createRecipeHandler(c *gin.Context) {
	var req struct {
		Name         string  `json:"name" binding:"required"`
		Category     string  `json:"category"`
		PrepTime     int     `json:"prep_time"`
		Servings     int     `json:"servings"`
		Calories     int     `json:"calories"`
		Protein      float64 `json:"protein"`
		Carbs        float64 `json:"carbs"`
		Fat          float64 `json:"fat"`
		Ingredients  string  `json:"ingredients"`
		Instructions string  `json:"instructions"`
		ImageURL     string  `json:"image_url"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var recipeID int
	err := queryRowDB(`
		INSERT INTO recipes (name, category, prep_time, servings, calories, protein, carbs, fat, ingredients, instructions, image_url)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
	`, req.Name, req.Category, req.PrepTime, req.Servings, req.Calories, req.Protein, req.Carbs, req.Fat, req.Ingredients, req.Instructions, req.ImageURL).Scan(&recipeID)
	if err != nil {
		log.Printf("[Nutritionist] Error creating recipe: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create recipe"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": recipeID, "message": "recipe created successfully"})
}

// updateRecipeHandler allows nutritionist to update existing recipes
func updateRecipeHandler(c *gin.Context) {
	recipeID := c.Param("id")

	var req struct {
		Name         string  `json:"name"`
		Category     string  `json:"category"`
		PrepTime     int     `json:"prep_time"`
		Servings     int     `json:"servings"`
		Calories     int     `json:"calories"`
		Protein      float64 `json:"protein"`
		Carbs        float64 `json:"carbs"`
		Fat          float64 `json:"fat"`
		Ingredients  string  `json:"ingredients"`
		Instructions string  `json:"instructions"`
		ImageURL     string  `json:"image_url"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := execDB(`
		UPDATE recipes 
		SET name = ?, category = ?, prep_time = ?, servings = ?, calories = ?, 
			protein = ?, carbs = ?, fat = ?, ingredients = ?, instructions = ?, image_url = ?
		WHERE id = ?
	`, req.Name, req.Category, req.PrepTime, req.Servings, req.Calories, req.Protein, req.Carbs, req.Fat, req.Ingredients, req.Instructions, req.ImageURL, recipeID)

	if err != nil {
		log.Printf("[Nutritionist] Error updating recipe: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update recipe"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "recipe updated successfully"})
}

// deleteRecipeHandler allows nutritionist to delete recipes
func deleteRecipeHandler(c *gin.Context) {
	recipeID := c.Param("id")

	_, err := execDB(`DELETE FROM recipes WHERE id = ?`, recipeID)
	if err != nil {
		log.Printf("[Nutritionist] Error deleting recipe: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete recipe"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "recipe deleted successfully"})
}

// createRecommendationHandler creates a recommendation for a patient
func createRecommendationHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	var req struct {
		PatientID          int    `json:"patient_id" binding:"required"`
		AppointmentID      *int   `json:"appointment_id"`
		RecommendationText string `json:"recommendation_text" binding:"required"`
		DietChanges        string `json:"diet_changes"`
		ExercisePlan       string `json:"exercise_plan"`
		NextGoals          string `json:"next_goals"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, allowed := beginPatientAccess(c, fmt.Sprint(req.PatientID))
	if !allowed {
		return
	}
	defer tx.Rollback()

	// Handle optional appointment_id
	var appointmentID interface{}
	if req.AppointmentID != nil && *req.AppointmentID > 0 {
		if err := lockProfessionalSchedule(c.Request.Context(), tx, claims.UserID); err != nil {
			log.Printf("[Appointments] Failed to lock professional schedule: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify appointment"})
			return
		}
		var found int
		var status sql.NullString
		err := tx.QueryRowContext(c.Request.Context(), rebindQuery(`
			SELECT id, status FROM appointments WHERE id = ? AND user_id = ? AND nutritionist_id = ? FOR UPDATE
		`), *req.AppointmentID, req.PatientID, claims.UserID).Scan(&found, &status)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify appointment"})
			}
			return
		}
		if status.String == "cancelled" {
			var date, clock string
			var startsAt sql.NullTime
			if err := tx.QueryRowContext(c.Request.Context(), rebindQuery(`
				SELECT appointment_date, appointment_time, starts_at FROM appointments WHERE id = ?
			`), found).Scan(&date, &clock, &startsAt); err != nil {
				log.Printf("[Appointments] Failed to load appointment time: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify appointment"})
				return
			}
			instantText := ""
			if startsAt.Valid {
				instantText = startsAt.Time.Format(time.RFC3339)
			}
			_, available, err := lockAndCheckAppointmentSlot(c.Request.Context(), tx, claims.UserID, date, clock, instantText, found)
			if err != nil {
				respondSlotError(c, err)
				return
			}
			if !available {
				c.JSON(http.StatusConflict, gin.H{"error": "appointment time is unavailable"})
				return
			}
		}
		appointmentID = *req.AppointmentID
	} else {
		appointmentID = nil
	}

	var recommendationID int
	err := tx.QueryRowContext(c.Request.Context(), rebindQuery(`
		INSERT INTO recommendations (nutritionist_id, patient_id, appointment_id, recommendation_text, diet_changes, exercise_plan, next_goals, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
	`), claims.UserID, req.PatientID, appointmentID, req.RecommendationText, req.DietChanges, req.ExercisePlan, req.NextGoals, time.Now().Format("2006-01-02 15:04:05")).Scan(&recommendationID)
	if err != nil {
		log.Printf("[Nutritionist] Error creating recommendation: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create recommendation"})
		return
	}

	// Update appointment status if provided
	if req.AppointmentID != nil && *req.AppointmentID > 0 {
		if _, err := tx.ExecContext(c.Request.Context(), rebindQuery(`UPDATE appointments SET status = 'completed' WHERE id = ?`), *req.AppointmentID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update appointment"})
			return
		}
	}

	if !commitClinicalAccess(c, tx) {
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": recommendationID, "message": "recommendation created successfully"})
}

// getRecommendationsHandler gets all recommendations for a patient
func getRecommendationsHandler(c *gin.Context) {
	patientID := c.Param("patient_id")
	tx, allowed := beginPatientAccess(c, patientID)
	if !allowed {
		return
	}
	defer tx.Rollback()

	rows, err := tx.QueryContext(c.Request.Context(), rebindQuery(`
		SELECT r.id, r.nutritionist_id, r.appointment_id, r.recommendation_text, 
			r.diet_changes, r.exercise_plan, r.next_goals, r.created_at,
			u.name as nutritionist_name
		FROM recommendations r
		LEFT JOIN users u ON u.id = r.nutritionist_id
		WHERE r.patient_id = ?
		ORDER BY r.created_at DESC
	`), patientID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch recommendations"})
		return
	}
	defer rows.Close()

	recommendations := []map[string]interface{}{}
	for rows.Next() {
		var id, nutritionistID int
		var appointmentID sql.NullInt64
		var recommendationText, dietChanges, exercisePlan, nextGoals, createdAt, nutritionistName string

		if err := rows.Scan(&id, &nutritionistID, &appointmentID, &recommendationText, &dietChanges, &exercisePlan, &nextGoals, &createdAt, &nutritionistName); err != nil {
			log.Printf("[Nutritionist] Error scanning recommendation: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch recommendations"})
			return
		}

		recommendation := map[string]interface{}{
			"id":                  id,
			"nutritionist_id":     nutritionistID,
			"nutritionist_name":   nutritionistName,
			"recommendation_text": recommendationText,
			"diet_changes":        dietChanges,
			"exercise_plan":       exercisePlan,
			"next_goals":          nextGoals,
			"created_at":          createdAt,
		}

		if appointmentID.Valid {
			recommendation["appointment_id"] = appointmentID.Int64
		} else {
			recommendation["appointment_id"] = nil
		}

		recommendations = append(recommendations, recommendation)
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch recommendations"})
		return
	}
	rows.Close()
	if !commitClinicalAccess(c, tx) {
		return
	}
	c.JSON(http.StatusOK, recommendations)
}

// getNutritionistAppointmentsHandler gets all appointments for the nutritionist
func getNutritionistAppointmentsHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	if claims.Role != "nutritionist" {
		c.JSON(http.StatusForbidden, gin.H{"error": "clinical access requires the assigned nutritionist"})
		return
	}

	rows, err := queryDB(`
		SELECT a.id, a.user_id, u.name as patient_name, a.title, a.description, 
			a.appointment_date, a.appointment_time, a.status, a.notes, a.created_at,
			a.starts_at, COALESCE(s.time_zone, '')
		FROM appointments a
		JOIN users u ON u.id = a.user_id
		JOIN users n ON n.id = u.nutritionist_id
		LEFT JOIN nutritionist_schedule_settings s ON s.nutritionist_id = a.nutritionist_id
		WHERE a.nutritionist_id = ? AND u.role = 'user' AND n.id = ? AND n.role = 'nutritionist'
		ORDER BY a.appointment_date ASC, a.appointment_time ASC
	`, claims.UserID, claims.UserID)

	if err != nil {
		log.Printf("[Nutritionist] Error fetching appointments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointments"})
		return
	}
	defer rows.Close()

	appointments := []map[string]interface{}{}
	for rows.Next() {
		var id, userID int
		var patientName, title, description, appointmentDate, appointmentTime, status, notes, createdAt, timeZone string
		var startsAt sql.NullTime

		if err := rows.Scan(&id, &userID, &patientName, &title, &description, &appointmentDate, &appointmentTime, &status, &notes, &createdAt, &startsAt, &timeZone); err != nil {
			log.Printf("[Nutritionist] Error scanning appointment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointments"})
			return
		}

		var instant interface{}
		if startsAt.Valid {
			instant = startsAt.Time.UTC().Format(time.RFC3339)
		}
		appointments = append(appointments, map[string]interface{}{
			"id":               id,
			"user_id":          userID,
			"patient_name":     patientName,
			"title":            title,
			"description":      description,
			"appointment_date": appointmentDate,
			"appointment_time": appointmentTime,
			"starts_at":        instant,
			"time_zone":        timeZone,
			"status":           status,
			"notes":            notes,
			"created_at":       createdAt,
		})
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointments"})
		return
	}
	c.JSON(http.StatusOK, appointments)
}

// updateAppointmentNotesHandler updates notes for an appointment
func updateAppointmentNotesHandler(c *gin.Context) {
	appointmentID := c.Param("id")

	var req struct {
		Notes  string `json:"notes"`
		Status string `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, _, allowed := beginAppointmentAccess(c, appointmentID)
	if !allowed {
		return
	}
	defer tx.Rollback()
	var existingStatus sql.NullString
	var nutritionistID int
	if err := tx.QueryRowContext(c.Request.Context(), rebindQuery(`
		SELECT status, nutritionist_id FROM appointments WHERE id = ?
	`), appointmentID).Scan(&existingStatus, &nutritionistID); err != nil {
		log.Printf("[Appointments] Failed to load status: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update appointment"})
		return
	}
	if req.Status == "" {
		req.Status = existingStatus.String
	}
	if req.Status != "scheduled" && req.Status != "pending" && req.Status != "completed" && req.Status != "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment status"})
		return
	}
	if existingStatus.String == "cancelled" && req.Status != "cancelled" {
		var date, clock string
		var startsAt sql.NullTime
		if err := tx.QueryRowContext(c.Request.Context(), rebindQuery(`
			SELECT appointment_date, appointment_time, starts_at FROM appointments WHERE id = ?
		`), appointmentID).Scan(&date, &clock, &startsAt); err != nil {
			log.Printf("[Appointments] Failed to load appointment time: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update appointment"})
			return
		}
		id, err := strconv.Atoi(appointmentID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
			return
		}
		instantText := ""
		if startsAt.Valid {
			instantText = startsAt.Time.Format(time.RFC3339)
		}
		_, available, err := lockAndCheckAppointmentSlot(c.Request.Context(), tx, nutritionistID, date, clock, instantText, id)
		if err != nil {
			respondSlotError(c, err)
			return
		}
		if !available {
			c.JSON(http.StatusConflict, gin.H{"error": "appointment time is unavailable"})
			return
		}
	}
	_, err := tx.ExecContext(c.Request.Context(), rebindQuery(`
		UPDATE appointments 
		SET notes = ?, status = ?
		WHERE id = ?
	`), req.Notes, req.Status, appointmentID)

	if err != nil {
		log.Printf("[Nutritionist] Error updating appointment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update appointment"})
		return
	}

	if !commitClinicalAccess(c, tx) {
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "appointment updated successfully"})
}

// proposeAppointmentChangeHandler allows nutritionist to propose a change to an appointment
func proposeAppointmentChangeHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	appointmentID := c.Param("id")

	var req struct {
		NewDate     string `json:"new_date" binding:"required"`
		NewTime     string `json:"new_time" binding:"required"`
		NewStartsAt string `json:"new_starts_at"`
		Reason      string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if _, err := appointmentInstants(req.NewDate, req.NewTime, time.UTC); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment date or time"})
		return
	}
	if req.NewStartsAt != "" {
		if _, err := time.Parse(time.RFC3339, req.NewStartsAt); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment instant"})
			return
		}
	}

	tx, userID, allowed := beginAppointmentAccess(c, appointmentID)
	if !allowed {
		return
	}
	defer tx.Rollback()

	id, err := strconv.Atoi(appointmentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	instant, available, err := lockAndCheckAppointmentSlot(c.Request.Context(), tx, claims.UserID, req.NewDate, req.NewTime, req.NewStartsAt, id)
	if err != nil {
		respondSlotError(c, err)
		return
	}
	if !available {
		c.JSON(http.StatusConflict, gin.H{"error": "appointment time is unavailable"})
		return
	}

	// Create change proposal
	var changeID int
	err = tx.QueryRowContext(c.Request.Context(), rebindQuery(`
		INSERT INTO appointment_changes (appointment_id, proposed_by, new_date, new_time, starts_at, reason, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
	`), appointmentID, claims.UserID, req.NewDate, req.NewTime, instant, req.Reason, time.Now().Format("2006-01-02 15:04:05")).Scan(&changeID)
	if err != nil {
		log.Printf("[Nutritionist] Error creating appointment change: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to propose change"})
		return
	}

	_, err = tx.ExecContext(c.Request.Context(), rebindQuery(`
		INSERT INTO notifications (user_id, type, title, message, related_id, created_at)
		VALUES (?, 'appointment_change', 'Cambio de Cita Propuesto', ?, ?, ?)
	`), userID, "Tu nutrióloga ha propuesto un cambio en tu cita. Por favor revisa y confirma.", changeID, time.Now().Format("2006-01-02 15:04:05"))
	if err != nil {
		log.Printf("[Nutritionist] Error creating appointment notification: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to propose change"})
		return
	}
	if !commitClinicalAccess(c, tx) {
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":      changeID,
		"message": "change proposed successfully",
	})
}

// getNutritionistAvailabilityHandler gets the availability schedule of the nutritionist
func getNutritionistAvailabilityHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	rows, err := queryDB(`
		SELECT id, day_of_week, start_time, end_time, is_available
		FROM nutritionist_availability
		WHERE nutritionist_id = ?
		ORDER BY day_of_week, start_time
	`, claims.UserID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch availability"})
		return
	}
	defer rows.Close()

	availability := []map[string]interface{}{}
	for rows.Next() {
		var id, dayOfWeek int
		var startTime, endTime string
		var isAvailable bool

		if err := rows.Scan(&id, &dayOfWeek, &startTime, &endTime, &isAvailable); err != nil {
			continue
		}

		availability = append(availability, map[string]interface{}{
			"id":           id,
			"day_of_week":  dayOfWeek,
			"start_time":   startTime,
			"end_time":     endTime,
			"is_available": isAvailable,
		})
	}

	c.JSON(http.StatusOK, availability)
}

// setNutritionistAvailabilityHandler sets availability slots for the nutritionist
func setNutritionistAvailabilityHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	if claims.Role != "nutritionist" {
		c.JSON(http.StatusForbidden, gin.H{"error": "professional account required"})
		return
	}

	var req struct {
		DayOfWeek   *int   `json:"day_of_week" binding:"required"`
		StartTime   string `json:"start_time" binding:"required"`
		EndTime     string `json:"end_time" binding:"required"`
		IsAvailable bool   `json:"is_available"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if *req.DayOfWeek < 0 || *req.DayOfWeek > 6 || validateScheduleIntervals([]scheduleInterval{{req.StartTime, req.EndTime}}) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid availability"})
		return
	}
	tx, err := db.BeginTx(c.Request.Context(), nil)
	if err != nil {
		log.Printf("[Nutritionist] Error starting availability update: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set availability"})
		return
	}
	defer tx.Rollback()
	if err := lockProfessionalSchedule(c.Request.Context(), tx, claims.UserID); err != nil {
		log.Printf("[Nutritionist] Error locking availability: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set availability"})
		return
	}
	if req.IsAvailable {
		rows, err := tx.QueryContext(c.Request.Context(), rebindQuery(`
			SELECT start_time, end_time FROM nutritionist_availability
			WHERE nutritionist_id = ? AND day_of_week = ? AND is_available = TRUE
		`), claims.UserID, *req.DayOfWeek)
		if err != nil {
			log.Printf("[Nutritionist] Error checking availability: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set availability"})
			return
		}
		intervals := []scheduleInterval{{req.StartTime, req.EndTime}}
		for rows.Next() {
			var interval scheduleInterval
			if err := rows.Scan(&interval.StartTime, &interval.EndTime); err != nil {
				rows.Close()
				log.Printf("[Nutritionist] Error reading availability: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set availability"})
				return
			}
			intervals = append(intervals, interval)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			log.Printf("[Nutritionist] Error reading availability: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set availability"})
			return
		}
		rows.Close()
		if err := validateScheduleIntervals(intervals); err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "availability overlaps existing hours"})
			return
		}
	}
	_, err = tx.ExecContext(c.Request.Context(), rebindQuery(`
		INSERT INTO nutritionist_availability (nutritionist_id, day_of_week, start_time, end_time, is_available)
		VALUES (?, ?, ?, ?, ?)
	`), claims.UserID, *req.DayOfWeek, req.StartTime, req.EndTime, req.IsAvailable)

	if err != nil {
		log.Printf("[Nutritionist] Error setting availability: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set availability"})
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("[Nutritionist] Error committing availability: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set availability"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "availability set successfully"})
}

// getAvailableSlotsHandler returns available time slots for scheduling
func getAvailableSlotsHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	dateStr := c.Query("date") // Format: YYYY-MM-DD

	if dateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date parameter required"})
		return
	}

	// Parse date to get day of week
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil || date.Format("2006-01-02") != dateStr {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format"})
		return
	}

	slots, err := availableAppointmentSlots(c.Request.Context(), db, claims.UserID, dateStr, 0)
	if err != nil {
		respondSlotError(c, err)
		return
	}
	c.JSON(http.StatusOK, slots)
}

// createMealPlanForPatientHandler creates a personalized meal plan for a patient
func createMealPlanForPatientHandler(c *gin.Context) {
	patientID := c.Param("id")

	var req struct {
		Name      string `json:"name" binding:"required"`
		StartDate string `json:"start_date" binding:"required"`
		Snacks    string `json:"snacks"`
		Meals     []struct {
			DayOfWeek   string `json:"day_of_week" binding:"required"`
			MealType    string `json:"meal_type" binding:"required"`
			Name        string `json:"name" binding:"required"`
			Ingredients string `json:"ingredients"`
			Preparation string `json:"preparation"`
		} `json:"meals" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, allowed := beginPatientAccess(c, patientID)
	if !allowed {
		return
	}
	defer tx.Rollback()

	var planID int
	err := tx.QueryRow(
		rebindQuery(`INSERT INTO meal_plans (user_id, name, start_date, snacks, created_at)
			VALUES (?, ?, ?, ?, ?) RETURNING id`),
		patientID, req.Name, req.StartDate, req.Snacks, time.Now().Format("2006-01-02 15:04:05"),
	).Scan(&planID)
	if err != nil {
		log.Printf("[Nutritionist] Error creating meal plan: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create meal plan"})
		return
	}

	// Insert meals
	for _, meal := range req.Meals {
		_, err := tx.Exec(
			rebindQuery(`INSERT INTO plan_meals (plan_id, day_of_week, meal_type, name, ingredients, preparation)
				VALUES (?, ?, ?, ?, ?, ?)`),
			planID, meal.DayOfWeek, meal.MealType, meal.Name, meal.Ingredients, meal.Preparation,
		)
		if err != nil {
			log.Printf("[Nutritionist] Error creating meal: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create meal plan"})
			return
		}
	}
	_, err = tx.ExecContext(c.Request.Context(), rebindQuery(`
		INSERT INTO notifications (user_id, type, title, message, related_id, is_read, created_at)
		VALUES (?, 'meal_plan', 'Nuevo Plan de Comidas', ?, ?, FALSE, ?)
	`), patientID, fmt.Sprintf("Tu nutrióloga ha creado un nuevo plan de comidas: %s", req.Name), planID, time.Now().Format("2006-01-02 15:04:05"))

	if err != nil {
		log.Printf("[Nutritionist] Error creating meal plan notification: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create meal plan"})
		return
	}
	if !commitClinicalAccess(c, tx) {
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":      planID,
		"message": "meal plan created successfully",
	})
}

// getPatientMealPlanHandler gets the current meal plan for a patient
func getPatientMealPlanHandler(c *gin.Context) {
	patientID := c.Param("id")
	tx, allowed := beginPatientAccess(c, patientID)
	if !allowed {
		return
	}
	defer tx.Rollback()

	var plan struct {
		ID        int    `json:"id"`
		UserID    int    `json:"user_id"`
		Name      string `json:"name"`
		StartDate string `json:"start_date"`
		Snacks    string `json:"snacks"`
		CreatedAt string `json:"created_at"`
	}

	err := tx.QueryRowContext(c.Request.Context(), rebindQuery(`
		SELECT id, user_id, name, start_date, snacks, created_at 
		FROM meal_plans 
		WHERE user_id = ? 
		ORDER BY created_at DESC 
		LIMIT 1
	`), patientID).Scan(&plan.ID, &plan.UserID, &plan.Name, &plan.StartDate, &plan.Snacks, &plan.CreatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "no meal plan found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch meal plan"})
		}
		return
	}

	// Get meals
	rows, err := tx.QueryContext(c.Request.Context(), rebindQuery(`
		SELECT id, plan_id, day_of_week, meal_type, name, ingredients, preparation
		FROM plan_meals
		WHERE plan_id = ?
		ORDER BY 
			CASE day_of_week
				WHEN 'Lunes' THEN 1
				WHEN 'Martes' THEN 2
				WHEN 'Miércoles' THEN 3
				WHEN 'Jueves' THEN 4
				WHEN 'Viernes' THEN 5
				WHEN 'Sábado' THEN 6
				WHEN 'Domingo' THEN 7
			END,
			CASE meal_type
				WHEN 'Desayuno' THEN 1
				WHEN 'Almuerzo' THEN 2
				WHEN 'Cena' THEN 3
			END
	`), plan.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch meals"})
		return
	}
	defer rows.Close()

	meals := []map[string]interface{}{}
	for rows.Next() {
		var id, planID int
		var dayOfWeek, mealType, name, ingredients, preparation string

		if err := rows.Scan(&id, &planID, &dayOfWeek, &mealType, &name, &ingredients, &preparation); err != nil {
			log.Printf("[Nutritionist] Error scanning meal: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch meals"})
			return
		}

		meals = append(meals, map[string]interface{}{
			"id":          id,
			"plan_id":     planID,
			"day_of_week": dayOfWeek,
			"meal_type":   mealType,
			"name":        name,
			"ingredients": ingredients,
			"preparation": preparation,
		})
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch meals"})
		return
	}
	rows.Close()
	if !commitClinicalAccess(c, tx) {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"plan":  plan,
		"meals": meals,
	})
}
