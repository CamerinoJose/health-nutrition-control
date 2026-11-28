package main

import "fmt"

func migrateAppointmentSchedule() error {
	for _, statement := range []string{
		`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ`,
		`ALTER TABLE appointment_changes ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ`,
		`CREATE TABLE IF NOT EXISTS nutritionist_schedule_settings (
			nutritionist_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			time_zone TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS nutritionist_schedule_exceptions (
			nutritionist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			exception_date DATE NOT NULL,
			intervals JSONB NOT NULL,
			PRIMARY KEY (nutritionist_id, exception_date)
		)`,
	} {
		if _, err := execDB(statement); err != nil {
			return fmt.Errorf("appointment schedule migration: %w", err)
		}
	}
	return nil
}
