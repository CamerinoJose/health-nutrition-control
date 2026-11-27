package main

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func beginPatientAccess(c *gin.Context, patientID string) (*sql.Tx, bool) {
	claims := c.MustGet("claims").(*Claims)
	if claims.Role != "nutritionist" {
		c.JSON(http.StatusForbidden, gin.H{"error": "clinical access requires the assigned nutritionist"})
		return nil, false
	}
	id, err := strconv.Atoi(patientID)
	if err != nil || id <= 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "patient not found"})
		return nil, false
	}
	tx, err := db.BeginTx(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify clinical access"})
		return nil, false
	}
	var found int
	err = tx.QueryRowContext(c.Request.Context(), rebindQuery(`
		SELECT p.id FROM users p JOIN users n ON n.id = p.nutritionist_id
		WHERE p.id = ? AND p.role = 'user' AND n.id = ? AND n.role = 'nutritionist'
		FOR SHARE OF p, n
	`), id, claims.UserID).Scan(&found)
	if err != nil {
		_ = tx.Rollback()
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "patient not found"})
		} else {
			log.Printf("[ClinicalAccess] Failed to verify patient access: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify clinical access"})
		}
		return nil, false
	}
	return tx, true
}

func beginAppointmentAccess(c *gin.Context, appointmentID string) (*sql.Tx, int, bool) {
	claims := c.MustGet("claims").(*Claims)
	if claims.Role != "nutritionist" {
		c.JSON(http.StatusForbidden, gin.H{"error": "clinical access requires the assigned nutritionist"})
		return nil, 0, false
	}
	id, err := strconv.Atoi(appointmentID)
	if err != nil || id <= 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return nil, 0, false
	}
	tx, err := db.BeginTx(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify clinical access"})
		return nil, 0, false
	}
	var patientID int
	err = tx.QueryRowContext(c.Request.Context(), rebindQuery(`
		SELECT a.user_id FROM appointments a
		JOIN users p ON p.id = a.user_id
		JOIN users n ON n.id = p.nutritionist_id
		WHERE a.id = ? AND p.role = 'user' AND n.id = ?
			AND n.role = 'nutritionist' AND a.nutritionist_id = n.id
		FOR UPDATE OF a FOR SHARE OF p, n
	`), id, claims.UserID).Scan(&patientID)
	if err != nil {
		_ = tx.Rollback()
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		} else {
			log.Printf("[ClinicalAccess] Failed to verify appointment access: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify clinical access"})
		}
		return nil, 0, false
	}
	return tx, patientID, true
}

func commitClinicalAccess(c *gin.Context, tx *sql.Tx) bool {
	if err := tx.Commit(); err != nil {
		log.Printf("[ClinicalAccess] Failed to commit: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete clinical request"})
		return false
	}
	return true
}
