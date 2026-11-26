package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

const recentAuthenticationWindow = 5 * time.Minute

func deleteOwnAccountHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	var passwordHash sql.NullString
	if err := queryRowDB(`SELECT password FROM users WHERE id = ?`, claims.UserID).Scan(&passwordHash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
			return
		}
		log.Printf("Could not verify account before deletion: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify account"})
		return
	}

	if passwordHash.Valid && passwordHash.String != "" && passwordHash.String != socialLoginPasswordPlaceholder {
		var request struct {
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&request); err != nil ||
			bcrypt.CompareHashAndPassword([]byte(passwordHash.String), []byte(request.Password)) != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is required"})
			return
		}
	} else if !hasRecentAuthentication(claims, time.Now()) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "sign in again to confirm account deletion"})
		return
	}

	deleted, err := deleteAccountData(c.Request.Context(), claims.UserID)
	if err != nil {
		log.Printf("Account deletion failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete account"})
		return
	}
	if !deleted {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func hasRecentAuthentication(claims *Claims, now time.Time) bool {
	if claims == nil || claims.IssuedAt == nil {
		return false
	}
	age := now.Sub(claims.IssuedAt.Time)
	return age >= 0 && age <= recentAuthenticationWindow
}

func deleteAccountData(ctx context.Context, userID int) (bool, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	var exists int
	if err := tx.QueryRowContext(ctx, rebindQuery(`SELECT id FROM users WHERE id = ?`), userID).Scan(&exists); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	statements := []struct {
		query string
		args  []interface{}
	}{
		{`DELETE FROM medicine_logs WHERE user_id = ? OR medicine_id IN (SELECT id FROM medicines WHERE user_id = ?)`, []interface{}{userID, userID}},
		{`DELETE FROM medicines WHERE user_id = ?`, []interface{}{userID}},
		{`DELETE FROM plan_meals WHERE plan_id IN (SELECT id FROM meal_plans WHERE user_id = ?)`, []interface{}{userID}},
		{`DELETE FROM meal_plans WHERE user_id = ?`, []interface{}{userID}},
		{`DELETE FROM appointment_changes WHERE proposed_by = ? OR appointment_id IN (SELECT id FROM appointments WHERE user_id = ? OR nutritionist_id = ?)`, []interface{}{userID, userID, userID}},
		{`DELETE FROM recommendations WHERE patient_id = ? OR nutritionist_id = ? OR appointment_id IN (SELECT id FROM appointments WHERE user_id = ? OR nutritionist_id = ?)`, []interface{}{userID, userID, userID, userID}},
		{`DELETE FROM deleted_messages WHERE user_id = ? OR message_id IN (SELECT id FROM messages WHERE sender_id = ? OR recipient_id = ?)`, []interface{}{userID, userID, userID}},
		{`DELETE FROM messages WHERE sender_id = ? OR recipient_id = ?`, []interface{}{userID, userID}},
		{`DELETE FROM appointments WHERE user_id = ?`, []interface{}{userID}},
		{`UPDATE appointments SET nutritionist_id = NULL WHERE nutritionist_id = ?`, []interface{}{userID}},
		{`UPDATE users SET nutritionist_id = NULL WHERE nutritionist_id = ?`, []interface{}{userID}},
		{`DELETE FROM health_profiles WHERE user_id = ?`, []interface{}{userID}},
		{`DELETE FROM histories WHERE user_id = ?`, []interface{}{userID}},
		{`DELETE FROM food_logs WHERE user_id = ?`, []interface{}{userID}},
		{`DELETE FROM user_settings WHERE user_id = ?`, []interface{}{userID}},
		{`DELETE FROM notifications WHERE user_id = ?`, []interface{}{userID}},
		{`DELETE FROM nutritionist_availability WHERE nutritionist_id = ?`, []interface{}{userID}},
		{`DELETE FROM push_tokens WHERE user_id = ?`, []interface{}{userID}},
		{`DELETE FROM social_accounts WHERE user_id = ?`, []interface{}{userID}},
		{`DELETE FROM gemini_reports WHERE user_id = ?`, []interface{}{userID}},
		{`DELETE FROM admin_audit_logs WHERE admin_user_id = ? OR target_user_id = ?`, []interface{}{userID, userID}},
	}

	for _, statement := range statements {
		if _, err := tx.ExecContext(ctx, rebindQuery(statement.query), statement.args...); err != nil {
			return false, err
		}
	}

	result, err := tx.ExecContext(ctx, rebindQuery(`DELETE FROM users WHERE id = ?`), userID)
	if err != nil {
		return false, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	if rows == 0 {
		return false, nil
	}
	if err := tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}
