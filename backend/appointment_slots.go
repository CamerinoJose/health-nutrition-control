package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
)

type appointmentSlot struct {
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
	Available bool   `json:"available"`
	StartsAt  string `json:"starts_at"`
	TimeZone  string `json:"time_zone"`
	UTCOffset string `json:"utc_offset"`
}

type timeInterval struct {
	start int
	end   int
}

type slotQuerier interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

var errScheduleNotConfigured = errors.New("professional schedule is not configured")
var errLegacySchedule = errors.New("existing appointment times need confirmation")
var errAmbiguousAppointment = errors.New("appointment time requires an explicit instant")

func respondSlotError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, errScheduleNotConfigured):
		c.JSON(http.StatusConflict, gin.H{"error": "professional schedule is not configured", "code": "schedule_not_configured"})
	case errors.Is(err, errLegacySchedule):
		c.JSON(http.StatusConflict, gin.H{"error": "existing appointments require time zone confirmation", "code": "legacy_zone_required"})
	case errors.Is(err, errAmbiguousAppointment):
		c.JSON(http.StatusConflict, gin.H{"error": "choose a specific occurrence of this time", "code": "ambiguous_time"})
	default:
		log.Printf("[Appointments] Failed to check availability: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check availability"})
	}
}

func clockMinutes(value string, allowEndOfDay bool) (int, error) {
	if allowEndOfDay && value == "24:00" {
		return 24 * 60, nil
	}
	parsed, err := time.Parse("15:04", value)
	if err != nil || parsed.Format("15:04") != value {
		return 0, fmt.Errorf("invalid time %q", value)
	}
	return parsed.Hour()*60 + parsed.Minute(), nil
}

func formatClock(minutes int) string {
	return fmt.Sprintf("%02d:%02d", minutes/60, minutes%60)
}

func lockProfessionalSchedule(ctx context.Context, tx *sql.Tx, nutritionistID int) error {
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock($1, $2)`, 734112, nutritionistID); err != nil {
		return fmt.Errorf("lock professional schedule: %w", err)
	}
	return nil
}

func lockAndCheckAppointmentSlot(ctx context.Context, tx *sql.Tx, nutritionistID int, date, clock, startsAt string, excludeAppointmentID int) (time.Time, bool, error) {
	if err := lockProfessionalSchedule(ctx, tx, nutritionistID); err != nil {
		return time.Time{}, false, err
	}
	slots, err := availableAppointmentSlots(ctx, tx, nutritionistID, date, excludeAppointmentID)
	if err != nil {
		return time.Time{}, false, err
	}
	var selected time.Time
	if startsAt != "" {
		selected, err = time.Parse(time.RFC3339, startsAt)
		if err != nil {
			return time.Time{}, false, fmt.Errorf("invalid appointment instant")
		}
	}
	var matches []appointmentSlot
	for _, slot := range slots {
		if slot.StartTime == clock {
			matches = append(matches, slot)
		}
	}
	if startsAt == "" && len(matches) > 1 {
		return time.Time{}, false, errAmbiguousAppointment
	}
	for _, slot := range matches {
		instant, err := time.Parse(time.RFC3339, slot.StartsAt)
		if err != nil {
			return time.Time{}, false, fmt.Errorf("invalid computed appointment instant: %w", err)
		}
		if startsAt == "" || instant.Equal(selected) {
			return instant, slot.Available, nil
		}
	}
	return time.Time{}, false, nil
}

func intervalContainsInstant(instant time.Time, location *time.Location, date string, interval timeInterval) bool {
	local := instant.In(location)
	minute := local.Hour()*60 + local.Minute()
	return local.Format("2006-01-02") == date && minute >= interval.start && minute < interval.end
}

func appointmentFitsInterval(start time.Time, location *time.Location, date string, interval timeInterval) bool {
	end := start.Add(30 * time.Minute)
	if !intervalContainsInstant(start, location, date, interval) ||
		!intervalContainsInstant(end.Add(-time.Nanosecond), location, date, interval) {
		return false
	}
	for current := start; current.Before(end); {
		_, next := current.In(location).ZoneBounds()
		if next.IsZero() || !next.After(current) || !next.Before(end) {
			break
		}
		if !intervalContainsInstant(next.Add(-time.Nanosecond), location, date, interval) ||
			!intervalContainsInstant(next, location, date, interval) {
			return false
		}
		current = next
	}
	return true
}

func availableAppointmentSlots(ctx context.Context, db slotQuerier, nutritionistID int, date string, excludeAppointmentID int) ([]appointmentSlot, error) {
	parsedDate, err := time.Parse("2006-01-02", date)
	if err != nil || parsedDate.Format("2006-01-02") != date {
		return nil, fmt.Errorf("invalid appointment date")
	}

	var zoneName string
	err = db.QueryRowContext(ctx, rebindQuery(`
		SELECT time_zone FROM nutritionist_schedule_settings WHERE nutritionist_id = ?
	`), nutritionistID).Scan(&zoneName)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errScheduleNotConfigured
	}
	if err != nil {
		return nil, fmt.Errorf("fetch schedule time zone: %w", err)
	}
	location, err := time.LoadLocation(zoneName)
	if err != nil {
		return nil, fmt.Errorf("invalid configured time zone: %w", err)
	}
	var legacyCount int
	if err := db.QueryRowContext(ctx, rebindQuery(`
		SELECT COUNT(*) FROM appointments WHERE nutritionist_id = ? AND starts_at IS NULL
	`), nutritionistID).Scan(&legacyCount); err != nil {
		return nil, fmt.Errorf("check legacy appointments: %w", err)
	}
	if legacyCount > 0 {
		return nil, errLegacySchedule
	}

	var exceptionJSON []byte
	err = db.QueryRowContext(ctx, rebindQuery(`
		SELECT intervals FROM nutritionist_schedule_exceptions WHERE nutritionist_id = ? AND exception_date = ?
	`), nutritionistID, date).Scan(&exceptionJSON)
	var configured []scheduleInterval
	if err == nil {
		if err := json.Unmarshal(exceptionJSON, &configured); err != nil {
			return nil, fmt.Errorf("read schedule exception: %w", err)
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("fetch schedule exception: %w", err)
	} else {
		rows, err := db.QueryContext(ctx, rebindQuery(`
			SELECT start_time, end_time FROM nutritionist_availability
			WHERE nutritionist_id = ? AND day_of_week = ? AND is_available = TRUE
		`), nutritionistID, int(parsedDate.Weekday()))
		if err != nil {
			return nil, fmt.Errorf("fetch availability: %w", err)
		}
		for rows.Next() {
			var interval scheduleInterval
			if err := rows.Scan(&interval.StartTime, &interval.EndTime); err != nil {
				rows.Close()
				return nil, fmt.Errorf("read availability: %w", err)
			}
			configured = append(configured, interval)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, fmt.Errorf("read availability: %w", err)
		}
		if err := rows.Close(); err != nil {
			return nil, fmt.Errorf("close availability: %w", err)
		}
	}
	if err := validateScheduleIntervals(configured); err != nil {
		return nil, fmt.Errorf("invalid configured availability: %w", err)
	}
	intervals := make([]timeInterval, 0, len(configured))
	for _, configuredInterval := range configured {
		start, _ := clockMinutes(configuredInterval.StartTime, false)
		end, _ := clockMinutes(configuredInterval.EndTime, true)
		intervals = append(intervals, timeInterval{start, end})
	}

	rows, err := db.QueryContext(ctx, rebindQuery(`
		SELECT starts_at FROM appointments
		WHERE nutritionist_id = ? AND starts_at >= ? AND starts_at < ?
			AND (status IS NULL OR status <> 'cancelled') AND id <> ?
	`), nutritionistID, parsedDate.Add(-48*time.Hour), parsedDate.Add(72*time.Hour), excludeAppointmentID)
	if err != nil {
		return nil, fmt.Errorf("fetch appointments: %w", err)
	}
	booked := []time.Time{}
	for rows.Next() {
		var start time.Time
		if err := rows.Scan(&start); err != nil {
			rows.Close()
			return nil, fmt.Errorf("read appointment: %w", err)
		}
		booked = append(booked, start)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, fmt.Errorf("read appointments: %w", err)
	}
	if err := rows.Close(); err != nil {
		return nil, fmt.Errorf("close appointments: %w", err)
	}

	starts := make(map[time.Time]struct{})
	for _, interval := range intervals {
		for minute := interval.start; minute < interval.end; minute += 30 {
			instants, err := appointmentInstants(date, formatClock(minute), location)
			if err != nil {
				return nil, fmt.Errorf("calculate appointment instants: %w", err)
			}
			for _, instant := range instants {
				if appointmentFitsInterval(instant, location, date, interval) {
					starts[instant] = struct{}{}
				}
			}
		}
	}
	ordered := make([]time.Time, 0, len(starts))
	for start := range starts {
		ordered = append(ordered, start)
	}
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].Before(ordered[j]) })
	slots := make([]appointmentSlot, 0, len(ordered))
	for _, start := range ordered {
		available := true
		for _, appointment := range booked {
			if start.Before(appointment.Add(30*time.Minute)) && appointment.Before(start.Add(30*time.Minute)) {
				available = false
				break
			}
		}
		localEnd := start.Add(30 * time.Minute).In(location)
		endTime := localEnd.Format("15:04")
		if localEnd.Format("2006-01-02") != date && endTime == "00:00" {
			endTime = "24:00"
		}
		slots = append(slots, appointmentSlot{
			StartTime: start.In(location).Format("15:04"), EndTime: endTime,
			Available: available, StartsAt: start.UTC().Format(time.RFC3339), TimeZone: zoneName,
			UTCOffset: start.In(location).Format("-07:00"),
		})
	}
	return slots, nil
}
