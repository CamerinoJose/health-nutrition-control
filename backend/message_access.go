package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// messageVisibilitySQL requires the current user's ID as its two parameters.
const messageVisibilitySQL = `(
	m.message_type = 'direct'
	OR (m.message_type = 'clinical' AND (
		m.clinical_patient_id = ?
		OR EXISTS (
			SELECT 1 FROM users p JOIN users n ON n.id = p.nutritionist_id
			WHERE p.id = m.clinical_patient_id AND p.role = 'user'
				AND n.id = ? AND n.role = 'nutritionist'
		)
	))
)`

func migrateMessageAccess() error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`SELECT pg_advisory_xact_lock(761294012)`); err != nil {
		return err
	}
	var hasType, hasPatient bool
	err = tx.QueryRow(`
		SELECT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'messages'::regclass
			AND attname = 'message_type' AND NOT attisdropped),
			EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'messages'::regclass
			AND attname = 'clinical_patient_id' AND NOT attisdropped)
	`).Scan(&hasType, &hasPatient)
	if err != nil {
		return err
	}
	if hasType != hasPatient {
		return errors.New("incomplete message access migration")
	}
	if !hasType {
		if _, err := tx.Exec(`ALTER TABLE messages ADD COLUMN message_type TEXT,
			ADD COLUMN clinical_patient_id INTEGER REFERENCES users(id)`); err != nil {
			return err
		}
		// Current roles cannot establish who was the patient when an old message was sent.
	}
	return tx.Commit()
}

type messageParticipant struct {
	id             int
	role           string
	nutritionistID sql.NullInt64
	name           string
	email          string
}

func messageParticipants(ctx context.Context, tx *sql.Tx, senderID, recipientID int) (messageParticipant, messageParticipant, error) {
	rows, err := tx.QueryContext(ctx, rebindQuery(`
		SELECT id, role, nutritionist_id, name, email FROM users WHERE id IN (?, ?)
		ORDER BY id FOR SHARE
	`), senderID, recipientID)
	if err != nil {
		return messageParticipant{}, messageParticipant{}, err
	}
	defer rows.Close()
	var sender, recipient messageParticipant
	for rows.Next() {
		var participant messageParticipant
		if err := rows.Scan(&participant.id, &participant.role, &participant.nutritionistID, &participant.name, &participant.email); err != nil {
			return sender, recipient, err
		}
		if participant.id == senderID {
			sender = participant
		}
		if participant.id == recipientID {
			recipient = participant
		}
	}
	if err := rows.Err(); err != nil {
		return sender, recipient, err
	}
	if sender.id == 0 || recipient.id == 0 || senderID == recipientID {
		return sender, recipient, sql.ErrNoRows
	}
	return sender, recipient, nil
}

func classifyMessage(sender, recipient messageParticipant) (string, interface{}, error) {
	if sender.role == "admin" || recipient.role == "admin" {
		email := supportEmail()
		if email == "" {
			return "", nil, errSupportUnavailable
		}
		if (sender.role == "admin" && strings.EqualFold(sender.email, email)) ||
			(recipient.role == "admin" && strings.EqualFold(recipient.email, email)) {
			return "direct", nil, nil
		}
		return "", nil, errors.New("conversation is not authorized")
	}
	patient, professional := sender, recipient
	if sender.role == "nutritionist" {
		patient, professional = recipient, sender
	}
	if patient.role != "user" || professional.role != "nutritionist" ||
		!patient.nutritionistID.Valid || patient.nutritionistID.Int64 != int64(professional.id) {
		return "", nil, fmt.Errorf("conversation is not authorized")
	}
	return "clinical", patient.id, nil
}

var errSupportUnavailable = errors.New("support is not configured")

func supportEmail() string {
	return strings.ToLower(strings.TrimSpace(os.Getenv("SUPPORT_EMAIL")))
}

func getSupportHandler(c *gin.Context) {
	email := supportEmail()
	if email == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "support is unavailable"})
		return
	}
	var id int
	err := queryRowDB(`SELECT id FROM users WHERE LOWER(email) = ? AND role = 'admin'`, email).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "support is unavailable"})
		return
	}
	if err != nil {
		log.Printf("[Messages] Error finding support: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to find support"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "name": "Soporte"})
}
