package main

import (
	"strings"
	"testing"
)

func TestAppointmentRemindersUseInstants(t *testing.T) {
	testDB := openTemporaryPostgres(t)
	for _, statement := range []string{
		`CREATE TEMP TABLE nutritionist_schedule_settings (nutritionist_id INTEGER, time_zone TEXT)`,
		`INSERT INTO nutritionist_schedule_settings VALUES (2, 'Pacific/Auckland')`,
		`CREATE TEMP TABLE appointments (id INTEGER, user_id INTEGER, nutritionist_id INTEGER, title TEXT, appointment_date TEXT, appointment_time TEXT, starts_at TIMESTAMPTZ, status TEXT, is_archived BOOLEAN)`,
		`CREATE TEMP TABLE notifications (user_id INTEGER, type TEXT, title TEXT, message TEXT, related_id INTEGER, is_read BOOLEAN, created_at TEXT)`,
		`INSERT INTO appointments VALUES
			(1, 1, 2, 'Consulta', '2030-01-02', '09:00', CURRENT_TIMESTAMP + INTERVAL '1 hour', 'scheduled', FALSE),
			(2, 1, 2, 'Lejana', '2030-01-02', '09:00', CURRENT_TIMESTAMP + INTERVAL '25 hours', 'scheduled', FALSE),
			(3, 1, 2, 'Pasada', '2030-01-02', '09:00', CURRENT_TIMESTAMP - INTERVAL '1 hour', 'scheduled', FALSE),
			(4, 1, 2, 'Antigua', '2030-01-02', '09:00', NULL, 'scheduled', FALSE),
			(5, 1, 2, 'Cancelada', '2030-01-02', '09:00', CURRENT_TIMESTAMP + INTERVAL '1 hour', 'cancelled', FALSE),
			(6, 1, 2, 'Archivada', '2030-01-02', '09:00', CURRENT_TIMESTAMP + INTERVAL '1 hour', 'scheduled', TRUE)`,
	} {
		if _, err := testDB.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	previousDB := db
	db = testDB
	t.Cleanup(func() { db = previousDB })

	checkUpcomingAppointments()
	checkUpcomingAppointments()
	var count, id int
	var message string
	if err := testDB.QueryRow(`SELECT COUNT(*), MIN(related_id), MIN(message) FROM notifications`).Scan(&count, &id, &message); err != nil {
		t.Fatal(err)
	}
	if count != 1 || id != 1 || !strings.Contains(message, "Pacific/Auckland") {
		t.Fatalf("unexpected reminders: count=%d id=%d message=%q", count, id, message)
	}
}
