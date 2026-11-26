package main

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

const (
	maxGeminiReportBytes = 24 << 10
	maxGeminiReportRunes = 5000
)

const geminiReportRetention = 90 * 24 * time.Hour

var geminiReportReasons = map[string]struct{}{
	"unsafe_medical_advice": {},
	"harmful":               {},
	"privacy":               {},
	"other":                 {},
}

type geminiReport struct {
	ID           int       `json:"id"`
	ResponseText string    `json:"response_text"`
	Reason       string    `json:"reason"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
}

func createGeminiReportHandler(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxGeminiReportBytes)
	var request struct {
		ResponseText string `json:"responseText" binding:"required"`
		Reason       string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report"})
		return
	}

	request.ResponseText = strings.TrimSpace(request.ResponseText)
	request.Reason = strings.TrimSpace(request.Reason)
	if request.ResponseText == "" ||
		utf8.RuneCountInString(request.ResponseText) > maxGeminiReportRunes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report"})
		return
	}
	if _, ok := geminiReportReasons[request.Reason]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report reason"})
		return
	}

	userID := getUserIDFromContext(c)
	var reportID int
	err := queryRowDB(`
		INSERT INTO gemini_reports (user_id, response_text, reason, status)
		VALUES (?, ?, ?, 'pending')
		RETURNING id
	`, userID, request.ResponseText, request.Reason).Scan(&reportID)
	if err != nil {
		log.Printf("Could not save Gemini response report: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save report"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": reportID, "status": "pending"})
}

func listGeminiReportsHandler(c *gin.Context) {
	rows, err := queryDB(`
		SELECT id, response_text, reason, status, created_at
		FROM gemini_reports
		ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC
		LIMIT 200
	`)
	if err != nil {
		log.Printf("Could not list Gemini response reports: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load reports"})
		return
	}
	defer rows.Close()

	reports := make([]geminiReport, 0)
	for rows.Next() {
		var report geminiReport
		if err := rows.Scan(&report.ID, &report.ResponseText, &report.Reason, &report.Status, &report.CreatedAt); err != nil {
			log.Printf("Could not read Gemini response report: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load reports"})
			return
		}
		reports = append(reports, report)
	}
	if err := rows.Err(); err != nil {
		log.Printf("Could not finish reading Gemini response reports: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load reports"})
		return
	}

	c.JSON(http.StatusOK, reports)
}

func updateGeminiReportHandler(c *gin.Context) {
	reportID, err := strconv.Atoi(c.Param("id"))
	if err != nil || reportID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report id"})
		return
	}
	var request struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&request); err != nil ||
		(request.Status != "reviewed" && request.Status != "dismissed") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report status"})
		return
	}

	result, err := execDB(`UPDATE gemini_reports SET status = ? WHERE id = ?`, request.Status, reportID)
	if err != nil {
		log.Printf("Could not update Gemini response report: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update report"})
		return
	}
	rows, err := result.RowsAffected()
	if err != nil {
		log.Printf("Could not confirm Gemini response report update: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update report"})
		return
	}
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "status": request.Status})
}

func cleanupExpiredGeminiReports() error {
	_, err := execDB(
		`DELETE FROM gemini_reports WHERE created_at < ?`,
		time.Now().UTC().Add(-geminiReportRetention),
	)
	return err
}

func geminiReportRetentionWorker() {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		if err := cleanupExpiredGeminiReports(); err != nil {
			log.Printf("Could not remove expired Gemini reports: %v", err)
		}
	}
}
