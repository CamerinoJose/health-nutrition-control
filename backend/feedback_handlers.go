package main

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

const feedbackPageSize = 50

type feedbackItem struct {
	ID        int       `json:"id"`
	Subject   string    `json:"subject"`
	Message   string    `json:"message"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

func createFeedbackHandler(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	var request struct {
		Subject string `json:"subject"`
		Message string `json:"message"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feedback"})
		return
	}
	request.Subject = strings.TrimSpace(request.Subject)
	request.Message = strings.TrimSpace(request.Message)
	if request.Subject == "" || request.Message == "" ||
		utf8.RuneCountInString(request.Subject) > 120 || utf8.RuneCountInString(request.Message) > 2000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feedback"})
		return
	}
	var id int
	err := queryRowDB(`INSERT INTO feedback (user_id, subject, message)
		VALUES (?, ?, ?) RETURNING id`, getUserIDFromContext(c), request.Subject, request.Message).Scan(&id)
	if err != nil {
		log.Printf("[Feedback] Failed to save feedback: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save feedback"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "status": "pending"})
}

func beginFeedbackAdmin(c *gin.Context) (*sql.Tx, bool) {
	claims := c.MustGet("claims").(*Claims)
	if claims.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return nil, false
	}
	tx, err := db.BeginTx(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify access"})
		return nil, false
	}
	var id int
	err = tx.QueryRowContext(c.Request.Context(), rebindQuery(
		`SELECT id FROM users WHERE id = ? AND role = 'admin' FOR SHARE`,
	), claims.UserID).Scan(&id)
	if err != nil {
		_ = tx.Rollback()
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		} else {
			log.Printf("[Feedback] Failed to verify admin: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify access"})
		}
		return nil, false
	}
	return tx, true
}

func commitFeedbackAdmin(c *gin.Context, tx *sql.Tx) bool {
	if err := tx.Commit(); err != nil {
		log.Printf("[Feedback] Failed to commit: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete feedback request"})
		return false
	}
	return true
}

func listFeedbackHandler(c *gin.Context) {
	view := c.DefaultQuery("view", "active")
	if view != "active" && view != "resolved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feedback view"})
		return
	}
	after := 0
	if value := c.Query("after_id"); value != "" {
		var err error
		after, err = strconv.Atoi(value)
		if err != nil || after < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feedback cursor"})
			return
		}
	}
	tx, allowed := beginFeedbackAdmin(c)
	if !allowed {
		return
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(c.Request.Context(), rebindQuery(`
		SELECT id, subject, message, status, created_at FROM feedback
		WHERE id > ? AND ((? = 'active' AND status IN ('pending', 'in_progress'))
			OR (? = 'resolved' AND status = 'resolved'))
		ORDER BY id ASC LIMIT ?
	`), after, view, view, feedbackPageSize+1)
	if err != nil {
		log.Printf("[Feedback] Failed to list feedback: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load feedback"})
		return
	}
	items := make([]feedbackItem, 0, feedbackPageSize+1)
	for rows.Next() {
		var item feedbackItem
		if err := rows.Scan(&item.ID, &item.Subject, &item.Message, &item.Status, &item.CreatedAt); err != nil {
			rows.Close()
			log.Printf("[Feedback] Failed to read feedback: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load feedback"})
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load feedback"})
		return
	}
	if err := rows.Close(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load feedback"})
		return
	}
	next := 0
	if len(items) > feedbackPageSize {
		items = items[:feedbackPageSize]
		next = items[len(items)-1].ID
	}
	if !commitFeedbackAdmin(c, tx) {
		return
	}
	auditAdminAction(c, "view_feedback", nil)
	c.JSON(http.StatusOK, gin.H{"items": items, "next_after_id": next})
}

func updateFeedbackHandler(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feedback id"})
		return
	}
	var request struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&request); err != nil ||
		(request.Status != "pending" && request.Status != "in_progress" && request.Status != "resolved") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feedback status"})
		return
	}
	tx, allowed := beginFeedbackAdmin(c)
	if !allowed {
		return
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(c.Request.Context(), rebindQuery(`UPDATE feedback SET status = ? WHERE id = ?`), request.Status, id)
	if err != nil {
		log.Printf("[Feedback] Failed to update feedback: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update feedback"})
		return
	}
	affected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update feedback"})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "feedback not found"})
		return
	}
	if !commitFeedbackAdmin(c, tx) {
		return
	}
	auditAdminAction(c, "update_feedback", nil)
	c.JSON(http.StatusOK, gin.H{"ok": true, "status": request.Status})
}
