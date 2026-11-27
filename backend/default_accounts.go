package main

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

var defaultAccountEmails = []string{
	"admin@bienestar.test",
	"nutriologa@bienestar.test",
	"user@test.com",
	"nutritionist@test.com",
	"admin@test.com",
}

func isDefaultAccountEmail(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	for _, candidate := range defaultAccountEmails {
		if email == candidate {
			return true
		}
	}
	return false
}

func disableDefaultAccounts() error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, email := range defaultAccountEmails {
		if _, err := tx.Exec(rebindQuery(`UPDATE users SET is_disabled = TRUE WHERE LOWER(email) = ?`), email); err != nil {
			return fmt.Errorf("disable default account: %w", err)
		}
	}

	for _, account := range []struct {
		emailEnv        string
		defaultPassword string
	}{
		{"ADMIN_EMAIL", "Admin123!"},
		{"NUTRITIONIST_EMAIL", "Nutri123!"},
	} {
		email := strings.ToLower(strings.TrimSpace(os.Getenv(account.emailEnv)))
		if email == "" {
			continue
		}
		var id int
		var password sql.NullString
		err := tx.QueryRow(rebindQuery(`SELECT id, password FROM users WHERE LOWER(email) = ? FOR UPDATE`), email).Scan(&id, &password)
		if errors.Is(err, sql.ErrNoRows) {
			continue
		}
		if err != nil {
			return fmt.Errorf("check configured account: %w", err)
		}
		if password.Valid && bcrypt.CompareHashAndPassword([]byte(password.String), []byte(account.defaultPassword)) == nil {
			if _, err := tx.Exec(rebindQuery(`UPDATE users SET is_disabled = TRUE WHERE id = ?`), id); err != nil {
				return fmt.Errorf("disable configured account: %w", err)
			}
		}
	}

	return tx.Commit()
}
