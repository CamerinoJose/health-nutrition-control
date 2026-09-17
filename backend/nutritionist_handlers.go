package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// listPatientsHandler returns all patients (users with role 'user')
func listPatientsHandler(c *gin.Context) {
	rows, err := queryDB(`
		SELECT u.id, u.name, u.email, u.role,
			(SELECT COUNT(*) FROM appointments WHERE user_id = u.id) as appointment_count,
			(SELECT MAX(date) FROM histories WHERE user_id = u.id) as last_visit
		FROM users u
		WHERE u.role = 'user'
		ORDER BY u.name
	`)
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
			continue
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

	c.JSON(http.StatusOK, patients)
}

// getPatientDetailsHandler returns full details of a specific patient
func getPatientDetailsHandler(c *gin.Context) {
	patientID := c.Param("id")

	var id int
	var name, email, role string
	err := queryRowDB(`SELECT id, name, email, role FROM users WHERE id = ?`, patientID).
		Scan(&id, &name, &email, &role)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "patient not found"})
		return
	}

	// Get health profile
	var profileData map[string]interface{}
	var age sql.NullInt64
	var height, weight, targetWeight, fatPercentage, musclePercentage sql.NullFloat64
	var sex, medicalConditions, medications, allergies, activityLevel, goals sql.NullString

	err = queryRowDB(`
		SELECT age, sex, height, weight, target_weight, fat_percentage, muscle_percentage,
			medical_conditions, medications, allergies, activity_level, goals
		FROM health_profiles WHERE user_id = ?
	`, patientID).Scan(&age, &sex, &height, &weight, &targetWeight, &fatPercentage,
		&musclePercentage, &medicalConditions, &medications, &allergies, &activityLevel, &goals)

	if err == nil {
		profileData = map[string]interface{}{
			"age":                age.Int64,
			"sex":                sex.String,
			"height":             height.Float64,
			"weight":             weight.Float64,
			"target_weight":      targetWeight.Float64,
			"fat_percentage":     fatPercentage.Float64,
			"muscle_percentage":  musclePercentage.Float64,
			"medical_conditions": medicalConditions.String,
			"medications":        medications.String,
			"allergies":          allergies.String,
			"activity_level":     activityLevel.String,
			"goals":              goals.String,
		}
	}

	// Get latest history entry
	var latestHistory map[string]interface{}
	var histDate string
	var histWeight, histFat, histMuscle float64
	err = queryRowDB(`
		SELECT date, weight, fat_percentage, muscle_percentage 
		FROM histories 
		WHERE user_id = ? 
		ORDER BY date DESC LIMIT 1
	`, patientID).Scan(&histDate, &histWeight, &histFat, &histMuscle)

	if err == nil {
		latestHistory = map[string]interface{}{
			"date":              histDate,
			"weight":            histWeight,
			"fat_percentage":    histFat,
			"muscle_percentage": histMuscle,
		}
	}

	// Get appointment count
	var appointmentCount int
	queryRowDB(`SELECT COUNT(*) FROM appointments WHERE user_id = ?`, patientID).Scan(&appointmentCount)

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

	rows, err := queryDB(`
		SELECT id, date, weight, fat_percentage, muscle_percentage
		FROM histories
		WHERE user_id = ?
		ORDER BY date DESC
	`, patientID)

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
			continue
		}

		history = append(history, map[string]interface{}{
			"id":                id,
			"date":              date,
			"weight":            weight,
			"fat_percentage":    fat,
			"muscle_percentage": muscle,
		})
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

	result, err := execDB(`
		INSERT INTO recipes (name, category, prep_time, servings, calories, protein, carbs, fat, ingredients, instructions, image_url)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.Name, req.Category, req.PrepTime, req.Servings, req.Calories, req.Protein, req.Carbs, req.Fat, req.Ingredients, req.Instructions, req.ImageURL)

	if err != nil {
		log.Printf("[Nutritionist] Error creating recipe: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create recipe"})
		return
	}

	recipeID, _ := result.LastInsertId()
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

	// Handle optional appointment_id
	var appointmentID interface{}
	if req.AppointmentID != nil && *req.AppointmentID > 0 {
		appointmentID = *req.AppointmentID
	} else {
		appointmentID = nil
	}

	result, err := execDB(`
		INSERT INTO recommendations (nutritionist_id, patient_id, appointment_id, recommendation_text, diet_changes, exercise_plan, next_goals, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, claims.UserID, req.PatientID, appointmentID, req.RecommendationText, req.DietChanges, req.ExercisePlan, req.NextGoals, time.Now().Format("2006-01-02 15:04:05"))

	if err != nil {
		log.Printf("[Nutritionist] Error creating recommendation: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create recommendation"})
		return
	}

	recommendationID, _ := result.LastInsertId()

	// Update appointment status if provided
	if req.AppointmentID != nil && *req.AppointmentID > 0 {
		execDB(`UPDATE appointments SET status = 'completed' WHERE id = ?`, *req.AppointmentID)
	}

	c.JSON(http.StatusOK, gin.H{"id": recommendationID, "message": "recommendation created successfully"})
}

// getRecommendationsHandler gets all recommendations for a patient
func getRecommendationsHandler(c *gin.Context) {
	patientID := c.Param("patient_id")

	rows, err := queryDB(`
		SELECT r.id, r.nutritionist_id, r.appointment_id, r.recommendation_text, 
			r.diet_changes, r.exercise_plan, r.next_goals, r.created_at,
			u.name as nutritionist_name
		FROM recommendations r
		LEFT JOIN users u ON u.id = r.nutritionist_id
		WHERE r.patient_id = ?
		ORDER BY r.created_at DESC
	`, patientID)

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
			continue
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

	c.JSON(http.StatusOK, recommendations)
}

// getNutritionistAppointmentsHandler gets all appointments for the nutritionist
func getNutritionistAppointmentsHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)

	rows, err := queryDB(`
		SELECT a.id, a.user_id, u.name as patient_name, a.title, a.description, 
			a.appointment_date, a.appointment_time, a.status, a.notes, a.created_at
		FROM appointments a
		LEFT JOIN users u ON u.id = a.user_id
		WHERE a.nutritionist_id = ?
		ORDER BY a.appointment_date ASC, a.appointment_time ASC
	`, claims.UserID)

	if err != nil {
		log.Printf("[Nutritionist] Error fetching appointments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointments"})
		return
	}
	defer rows.Close()

	appointments := []map[string]interface{}{}
	for rows.Next() {
		var id, userID int
		var patientName, title, description, appointmentDate, appointmentTime, status, notes, createdAt string

		if err := rows.Scan(&id, &userID, &patientName, &title, &description, &appointmentDate, &appointmentTime, &status, &notes, &createdAt); err != nil {
			continue
		}

		appointments = append(appointments, map[string]interface{}{
			"id":               id,
			"user_id":          userID,
			"patient_name":     patientName,
			"title":            title,
			"description":      description,
			"appointment_date": appointmentDate,
			"appointment_time": appointmentTime,
			"status":           status,
			"notes":            notes,
			"created_at":       createdAt,
		})
	}

	// If role is admin, return all appointments
	// If role is nutritionist, we could filter by nutritionist_id if we had that field
	_ = claims // For future use

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

	_, err := execDB(`
		UPDATE appointments 
		SET notes = ?, status = ?
		WHERE id = ?
	`, req.Notes, req.Status, appointmentID)

	if err != nil {
		log.Printf("[Nutritionist] Error updating appointment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update appointment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "appointment updated successfully"})
}

// proposeAppointmentChangeHandler allows nutritionist to propose a change to an appointment
func proposeAppointmentChangeHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	appointmentID := c.Param("id")

	var req struct {
		NewDate string `json:"new_date" binding:"required"`
		NewTime string `json:"new_time" binding:"required"`
		Reason  string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get appointment details to find patient
	var userID int
	err := queryRowDB(`SELECT user_id FROM appointments WHERE id = ?`, appointmentID).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}

	// Create change proposal
	result, err := execDB(`
		INSERT INTO appointment_changes (appointment_id, proposed_by, new_date, new_time, reason, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, appointmentID, claims.UserID, req.NewDate, req.NewTime, req.Reason, time.Now().Format("2006-01-02 15:04:05"))

	if err != nil {
		log.Printf("[Nutritionist] Error creating appointment change: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to propose change"})
		return
	}

	changeID, _ := result.LastInsertId()

	// Create notification for patient
	execDB(`
		INSERT INTO notifications (user_id, type, title, message, related_id, created_at)
		VALUES (?, 'appointment_change', 'Cambio de Cita Propuesto', ?, ?, ?)
	`, userID, "Tu nutrióloga ha propuesto un cambio en tu cita. Por favor revisa y confirma.", changeID, time.Now().Format("2006-01-02 15:04:05"))

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

	var req struct {
		DayOfWeek   int    `json:"day_of_week" binding:"required"`
		StartTime   string `json:"start_time" binding:"required"`
		EndTime     string `json:"end_time" binding:"required"`
		IsAvailable bool   `json:"is_available"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := execDB(`
		INSERT INTO nutritionist_availability (nutritionist_id, day_of_week, start_time, end_time, is_available)
		VALUES (?, ?, ?, ?, ?)
	`, claims.UserID, req.DayOfWeek, req.StartTime, req.EndTime, req.IsAvailable)

	if err != nil {
		log.Printf("[Nutritionist] Error setting availability: %v", err)
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
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format"})
		return
	}

	dayOfWeek := int(date.Weekday())

	// Get availability for that day
	rows, err := queryDB(`
		SELECT start_time, end_time
		FROM nutritionist_availability
		WHERE nutritionist_id = ? AND day_of_week = ? AND is_available = 1
	`, claims.UserID, dayOfWeek)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch slots"})
		return
	}
	defer rows.Close()

	slots := []map[string]interface{}{}
	for rows.Next() {
		var startTime, endTime string
		if err := rows.Scan(&startTime, &endTime); err != nil {
			continue
		}

		// Get existing appointments for this time slot
		var count int
		queryRowDB(`
			SELECT COUNT(*) FROM appointments 
			WHERE appointment_date = ? 
			AND appointment_time >= ? 
			AND appointment_time < ?
			AND status != 'cancelled'
		`, dateStr, startTime, endTime).Scan(&count)

		slots = append(slots, map[string]interface{}{
			"start_time": startTime,
			"end_time":   endTime,
			"available":  count == 0,
		})
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

	// Create meal plan
	result, err := execDB(`
		INSERT INTO meal_plans (user_id, name, start_date, snacks, created_at)
		VALUES (?, ?, ?, ?, ?)
	`, patientID, req.Name, req.StartDate, req.Snacks, time.Now().Format("2006-01-02 15:04:05"))

	if err != nil {
		log.Printf("[Nutritionist] Error creating meal plan: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create meal plan"})
		return
	}

	planID, _ := result.LastInsertId()

	// Insert meals
	for _, meal := range req.Meals {
		_, err := execDB(`
			INSERT INTO plan_meals (plan_id, day_of_week, meal_type, name, ingredients, preparation)
			VALUES (?, ?, ?, ?, ?, ?)
		`, planID, meal.DayOfWeek, meal.MealType, meal.Name, meal.Ingredients, meal.Preparation)

		if err != nil {
			log.Printf("[Nutritionist] Error creating meal: %v", err)
		}
	}

	// Create notification for patient
	_, err = execDB(`
		INSERT INTO notifications (user_id, type, title, message, related_id, is_read, created_at)
		VALUES (?, 'meal_plan', 'Nuevo Plan de Comidas', ?, ?, 0, ?)
	`, patientID, fmt.Sprintf("Tu nutrióloga ha creado un nuevo plan de comidas: %s", req.Name), planID, time.Now().Format("2006-01-02 15:04:05"))

	if err != nil {
		log.Printf("[Nutritionist] Warning: Failed to create notification: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"id":      planID,
		"message": "meal plan created successfully",
	})
}

// getPatientMealPlanHandler gets the current meal plan for a patient
func getPatientMealPlanHandler(c *gin.Context) {
	patientID := c.Param("id")

	var plan struct {
		ID        int    `json:"id"`
		UserID    int    `json:"user_id"`
		Name      string `json:"name"`
		StartDate string `json:"start_date"`
		Snacks    string `json:"snacks"`
		CreatedAt string `json:"created_at"`
	}

	err := queryRowDB(`
		SELECT id, user_id, name, start_date, snacks, created_at 
		FROM meal_plans 
		WHERE user_id = ? 
		ORDER BY created_at DESC 
		LIMIT 1
	`, patientID).Scan(&plan.ID, &plan.UserID, &plan.Name, &plan.StartDate, &plan.Snacks, &plan.CreatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no meal plan found"})
		return
	}

	// Get meals
	rows, err := queryDB(`
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
	`, plan.ID)

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
			continue
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

	c.JSON(http.StatusOK, gin.H{
		"plan":  plan,
		"meals": meals,
	})
}
