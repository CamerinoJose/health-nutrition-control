package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type scheduleInterval struct {
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

type weeklyScheduleInterval struct {
	DayOfWeek int `json:"day_of_week"`
	scheduleInterval
}

type scheduleException struct {
	Date      string             `json:"date"`
	Intervals []scheduleInterval `json:"intervals"`
}

type scheduleRequest struct {
	TimeZone       string                   `json:"time_zone"`
	LegacyTimeZone string                   `json:"legacy_time_zone"`
	LegacyInstants map[string]string        `json:"legacy_instants"`
	Weekly         []weeklyScheduleInterval `json:"weekly"`
	Exceptions     []scheduleException      `json:"exceptions"`
}

func validateScheduleIntervals(intervals []scheduleInterval) error {
	ranges := make([]timeInterval, 0, len(intervals))
	for _, interval := range intervals {
		start, startErr := clockMinutes(interval.StartTime, false)
		end, endErr := clockMinutes(interval.EndTime, true)
		if startErr != nil || endErr != nil || end <= start {
			return fmt.Errorf("invalid schedule interval")
		}
		ranges = append(ranges, timeInterval{start, end})
	}
	sort.Slice(ranges, func(i, j int) bool { return ranges[i].start < ranges[j].start })
	for i := 1; i < len(ranges); i++ {
		if ranges[i].start < ranges[i-1].end {
			return fmt.Errorf("schedule intervals overlap")
		}
	}
	return nil
}

func validateSchedule(req scheduleRequest) error {
	if req.TimeZone == "" || req.TimeZone == "Local" {
		return fmt.Errorf("a valid time zone is required")
	}
	if _, err := time.LoadLocation(req.TimeZone); err != nil {
		return fmt.Errorf("invalid time zone")
	}
	days := make(map[int][]scheduleInterval)
	for _, interval := range req.Weekly {
		if interval.DayOfWeek < 0 || interval.DayOfWeek > 6 {
			return fmt.Errorf("invalid day of week")
		}
		days[interval.DayOfWeek] = append(days[interval.DayOfWeek], interval.scheduleInterval)
	}
	for _, intervals := range days {
		if err := validateScheduleIntervals(intervals); err != nil {
			return err
		}
	}
	dates := make(map[string]bool)
	for _, exception := range req.Exceptions {
		date, err := time.Parse("2006-01-02", exception.Date)
		if err != nil || date.Format("2006-01-02") != exception.Date || dates[exception.Date] {
			return fmt.Errorf("invalid or duplicate exception date")
		}
		dates[exception.Date] = true
		if err := validateScheduleIntervals(exception.Intervals); err != nil {
			return err
		}
	}
	return nil
}

type legacyScheduleTime struct {
	ID   int
	Date sql.NullString
	Time sql.NullString
}

type legacySchedulePreview struct {
	Kind     string   `json:"kind"`
	ID       int      `json:"id"`
	Date     string   `json:"date"`
	Time     string   `json:"time"`
	Status   string   `json:"status"`
	Instants []string `json:"instants"`
}

func getLegacySchedulePreviewHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	if claims.Role != "nutritionist" {
		c.JSON(http.StatusForbidden, gin.H{"error": "professional account required"})
		return
	}
	zone := strings.TrimSpace(c.Query("time_zone"))
	location, err := time.LoadLocation(zone)
	if zone == "" || err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid time_zone is required"})
		return
	}
	sets := []struct {
		kind  string
		query string
	}{
		{"appointment", `SELECT a.id, a.appointment_date, a.appointment_time FROM appointments a JOIN users p ON p.id = a.user_id WHERE a.nutritionist_id = ? AND p.nutritionist_id = ? AND a.starts_at IS NULL ORDER BY a.appointment_date, a.appointment_time, a.id`},
		{"change", `SELECT ac.id, ac.new_date, ac.new_time FROM appointment_changes ac JOIN appointments a ON a.id = ac.appointment_id JOIN users p ON p.id = a.user_id WHERE a.nutritionist_id = ? AND p.nutritionist_id = ? AND ac.status = 'pending' AND ac.starts_at IS NULL ORDER BY ac.new_date, ac.new_time, ac.id`},
	}
	items := []legacySchedulePreview{}
	for _, set := range sets {
		rows, err := queryDB(set.query, claims.UserID, claims.UserID)
		if err != nil {
			log.Printf("[Schedule] Failed to load legacy preview: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to preview legacy appointments"})
			return
		}
		for rows.Next() {
			var item legacyScheduleTime
			if err := rows.Scan(&item.ID, &item.Date, &item.Time); err != nil {
				rows.Close()
				log.Printf("[Schedule] Failed to read legacy preview: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to preview legacy appointments"})
				return
			}
			preview := legacySchedulePreview{Kind: set.kind, ID: item.ID, Status: "invalid", Instants: []string{}}
			if item.Date.Valid {
				preview.Date = item.Date.String
			}
			if item.Time.Valid {
				preview.Time = item.Time.String
			}
			if item.Date.Valid && item.Time.Valid {
				instants, err := appointmentInstants(item.Date.String, item.Time.String, location)
				switch {
				case err != nil:
					preview.Status = "invalid"
				case len(instants) == 0:
					preview.Status = "nonexistent"
				case len(instants) == 1:
					preview.Status = "unambiguous"
				default:
					preview.Status = "ambiguous"
				}
				for _, instant := range instants {
					preview.Instants = append(preview.Instants, instant.UTC().Format(time.RFC3339))
				}
			} else {
				preview.Status = "missing"
			}
			items = append(items, preview)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			log.Printf("[Schedule] Failed to read legacy preview: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to preview legacy appointments"})
			return
		}
		rows.Close()
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func convertLegacyScheduleTime(item legacyScheduleTime, kind string, location *time.Location, choices map[string]string) (time.Time, error) {
	key := fmt.Sprintf("%s:%d", kind, item.ID)
	choice := strings.TrimSpace(choices[key])
	selected, choiceErr := time.Parse(time.RFC3339, choice)
	if !item.Date.Valid || !item.Time.Valid {
		if choiceErr == nil {
			return selected, nil
		}
		return time.Time{}, fmt.Errorf("legacy %s %d has no date or time", kind, item.ID)
	}
	instants, err := appointmentInstants(item.Date.String, item.Time.String, location)
	if err != nil {
		if choiceErr == nil {
			return selected, nil
		}
		return time.Time{}, fmt.Errorf("legacy %s %d has an invalid time", kind, item.ID)
	}
	if len(instants) == 0 {
		if choiceErr == nil {
			return selected, nil
		}
		return time.Time{}, fmt.Errorf("legacy %s %d has an invalid or nonexistent time", kind, item.ID)
	}
	if len(instants) == 1 {
		return instants[0], nil
	}
	if choiceErr == nil {
		for _, candidate := range instants {
			if candidate.Equal(selected) {
				return candidate, nil
			}
		}
	}
	return time.Time{}, fmt.Errorf("legacy %s %d has an ambiguous time", kind, item.ID)
}

func getNutritionistScheduleHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	if claims.Role != "nutritionist" {
		c.JSON(http.StatusForbidden, gin.H{"error": "professional account required"})
		return
	}
	var zone sql.NullString
	err := queryRowDB(`SELECT time_zone FROM nutritionist_schedule_settings WHERE nutritionist_id = ?`, claims.UserID).Scan(&zone)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Printf("[Schedule] Failed to load time zone: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load schedule"})
		return
	}
	rows, err := queryDB(`
		SELECT day_of_week, start_time, end_time FROM nutritionist_availability
		WHERE nutritionist_id = ? AND is_available = TRUE ORDER BY day_of_week, start_time
	`, claims.UserID)
	if err != nil {
		log.Printf("[Schedule] Failed to load weekly hours: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load schedule"})
		return
	}
	weekly := []weeklyScheduleInterval{}
	for rows.Next() {
		var interval weeklyScheduleInterval
		if err := rows.Scan(&interval.DayOfWeek, &interval.StartTime, &interval.EndTime); err != nil {
			rows.Close()
			log.Printf("[Schedule] Failed to read weekly hours: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load schedule"})
			return
		}
		weekly = append(weekly, interval)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		log.Printf("[Schedule] Failed to read weekly hours: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load schedule"})
		return
	}
	rows.Close()
	rows, err = queryDB(`
		SELECT TO_CHAR(exception_date, 'YYYY-MM-DD'), intervals
		FROM nutritionist_schedule_exceptions WHERE nutritionist_id = ? ORDER BY exception_date
	`, claims.UserID)
	if err != nil {
		log.Printf("[Schedule] Failed to load exceptions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load schedule"})
		return
	}
	exceptions := []scheduleException{}
	for rows.Next() {
		var exception scheduleException
		var raw []byte
		if err := rows.Scan(&exception.Date, &raw); err != nil {
			rows.Close()
			log.Printf("[Schedule] Failed to read exception: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load schedule"})
			return
		}
		if err := json.Unmarshal(raw, &exception.Intervals); err != nil {
			rows.Close()
			log.Printf("[Schedule] Invalid stored exception: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load schedule"})
			return
		}
		exceptions = append(exceptions, exception)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		log.Printf("[Schedule] Failed to read exceptions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load schedule"})
		return
	}
	rows.Close()
	var legacyCount int
	if err := queryRowDB(`
		SELECT
			(SELECT COUNT(*) FROM appointments a JOIN users p ON p.id = a.user_id
			 WHERE a.nutritionist_id = ? AND p.nutritionist_id = ? AND a.starts_at IS NULL) +
			(SELECT COUNT(*) FROM appointment_changes ac JOIN appointments a ON a.id = ac.appointment_id
			 JOIN users p ON p.id = a.user_id
			 WHERE a.nutritionist_id = ? AND p.nutritionist_id = ? AND ac.status = 'pending' AND ac.starts_at IS NULL)
	`, claims.UserID, claims.UserID, claims.UserID, claims.UserID).Scan(&legacyCount); err != nil {
		log.Printf("[Schedule] Failed to count legacy appointments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load schedule"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"time_zone": zone.String, "weekly": weekly, "exceptions": exceptions, "legacy_count": legacyCount})
}

func setNutritionistScheduleHandler(c *gin.Context) {
	claims := c.MustGet("claims").(*Claims)
	if claims.Role != "nutritionist" {
		c.JSON(http.StatusForbidden, gin.H{"error": "professional account required"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
	var req scheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schedule"})
		return
	}
	req.TimeZone = strings.TrimSpace(req.TimeZone)
	req.LegacyTimeZone = strings.TrimSpace(req.LegacyTimeZone)
	if err := validateSchedule(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tx, err := db.BeginTx(c.Request.Context(), nil)
	if err != nil {
		log.Printf("[Schedule] Failed to begin update: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
		return
	}
	defer tx.Rollback()
	var id int
	err = tx.QueryRowContext(c.Request.Context(), rebindQuery(`
		SELECT id FROM users WHERE id = ? AND role = 'nutritionist' AND is_disabled = FALSE FOR SHARE
	`), claims.UserID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusForbidden, gin.H{"error": "professional account required"})
		return
	}
	if err != nil {
		log.Printf("[Schedule] Failed to verify professional: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
		return
	}
	if err := lockProfessionalSchedule(c.Request.Context(), tx, id); err != nil {
		log.Printf("[Schedule] Failed to lock schedule: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
		return
	}
	var oldZone string
	err = tx.QueryRowContext(c.Request.Context(), rebindQuery(`
		SELECT time_zone FROM nutritionist_schedule_settings WHERE nutritionist_id = ?
	`), id).Scan(&oldZone)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Printf("[Schedule] Failed to load previous zone: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
		return
	}

	type legacySet struct {
		kind  string
		query string
		items []legacyScheduleTime
	}
	sets := []legacySet{
		{"appointment", `SELECT a.id, a.appointment_date, a.appointment_time FROM appointments a JOIN users p ON p.id = a.user_id WHERE a.nutritionist_id = ? AND p.nutritionist_id = ? AND a.starts_at IS NULL FOR UPDATE OF a`, nil},
		{"change", `SELECT ac.id, ac.new_date, ac.new_time FROM appointment_changes ac JOIN appointments a ON a.id = ac.appointment_id JOIN users p ON p.id = a.user_id WHERE a.nutritionist_id = ? AND p.nutritionist_id = ? AND ac.status = 'pending' AND ac.starts_at IS NULL FOR UPDATE OF ac`, nil},
	}
	for i := range sets {
		rows, err := tx.QueryContext(c.Request.Context(), rebindQuery(sets[i].query), id, id)
		if err != nil {
			log.Printf("[Schedule] Failed to load legacy times: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
			return
		}
		for rows.Next() {
			var item legacyScheduleTime
			if err := rows.Scan(&item.ID, &item.Date, &item.Time); err != nil {
				rows.Close()
				log.Printf("[Schedule] Failed to read legacy time: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
				return
			}
			sets[i].items = append(sets[i].items, item)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			log.Printf("[Schedule] Failed to read legacy times: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
			return
		}
		rows.Close()
	}
	if len(sets[0].items)+len(sets[1].items) > 0 {
		if req.LegacyTimeZone == "" || req.LegacyTimeZone == "Local" {
			c.JSON(http.StatusConflict, gin.H{"error": "confirm the time zone of existing appointments", "code": "legacy_zone_required"})
			return
		}
		location, err := time.LoadLocation(req.LegacyTimeZone)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid legacy time zone"})
			return
		}
		for _, set := range sets {
			for _, item := range set.items {
				instant, err := convertLegacyScheduleTime(item, set.kind, location, req.LegacyInstants)
				if err != nil {
					c.JSON(http.StatusConflict, gin.H{"error": "an existing appointment time needs review", "code": "legacy_time_needs_review"})
					return
				}
				query := `UPDATE appointments SET starts_at = ? WHERE id = ?`
				if set.kind == "change" {
					query = `UPDATE appointment_changes SET starts_at = ? WHERE id = ?`
				}
				if _, err := tx.ExecContext(c.Request.Context(), rebindQuery(query), instant, item.ID); err != nil {
					log.Printf("[Schedule] Failed to convert legacy time: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
					return
				}
			}
		}
	}
	if _, err := tx.ExecContext(c.Request.Context(), rebindQuery(`
		INSERT INTO nutritionist_schedule_settings (nutritionist_id, time_zone) VALUES (?, ?)
		ON CONFLICT (nutritionist_id) DO UPDATE SET time_zone = EXCLUDED.time_zone
	`), id, req.TimeZone); err != nil {
		log.Printf("[Schedule] Failed to save time zone: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
		return
	}
	if _, err := tx.ExecContext(c.Request.Context(), rebindQuery(`
		UPDATE appointments SET appointment_date = TO_CHAR(starts_at AT TIME ZONE ?, 'YYYY-MM-DD'),
			appointment_time = TO_CHAR(starts_at AT TIME ZONE ?, 'HH24:MI')
		WHERE nutritionist_id = ? AND starts_at IS NOT NULL
	`), req.TimeZone, req.TimeZone, id); err != nil {
		log.Printf("[Schedule] Failed to convert appointment display times: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
		return
	}
	if _, err := tx.ExecContext(c.Request.Context(), rebindQuery(`
		UPDATE appointment_changes ac SET new_date = TO_CHAR(ac.starts_at AT TIME ZONE ?, 'YYYY-MM-DD'),
			new_time = TO_CHAR(ac.starts_at AT TIME ZONE ?, 'HH24:MI')
		FROM appointments a WHERE ac.appointment_id = a.id AND a.nutritionist_id = ? AND ac.starts_at IS NOT NULL
	`), req.TimeZone, req.TimeZone, id); err != nil {
		log.Printf("[Schedule] Failed to convert proposed display times: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
		return
	}
	if oldZone != "" && oldZone != req.TimeZone {
		if _, err := tx.ExecContext(c.Request.Context(), rebindQuery(`
			INSERT INTO notifications (user_id, type, title, message, related_id, created_at)
			SELECT a.user_id, 'appointment', 'Zona horaria actualizada',
				'El profesional cambió de zona horaria. Revisa la hora de tu cita.', a.id, ?
			FROM appointments a JOIN users p ON p.id = a.user_id
			WHERE a.nutritionist_id = ? AND p.nutritionist_id = ? AND a.starts_at >= CURRENT_TIMESTAMP
				AND (a.status IS NULL OR a.status <> 'cancelled')
		`), time.Now().Format("2006-01-02 15:04:05"), id, id); err != nil {
			log.Printf("[Schedule] Failed to notify patients: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
			return
		}
	}
	if _, err := tx.ExecContext(c.Request.Context(), rebindQuery(`DELETE FROM nutritionist_availability WHERE nutritionist_id = ?`), id); err != nil {
		log.Printf("[Schedule] Failed to replace weekly hours: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
		return
	}
	for _, interval := range req.Weekly {
		if _, err := tx.ExecContext(c.Request.Context(), rebindQuery(`
			INSERT INTO nutritionist_availability (nutritionist_id, day_of_week, start_time, end_time, is_available)
			VALUES (?, ?, ?, ?, TRUE)
		`), id, interval.DayOfWeek, interval.StartTime, interval.EndTime); err != nil {
			log.Printf("[Schedule] Failed to save weekly hours: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
			return
		}
	}
	if _, err := tx.ExecContext(c.Request.Context(), rebindQuery(`DELETE FROM nutritionist_schedule_exceptions WHERE nutritionist_id = ?`), id); err != nil {
		log.Printf("[Schedule] Failed to replace exceptions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
		return
	}
	for _, exception := range req.Exceptions {
		intervals := exception.Intervals
		if intervals == nil {
			intervals = []scheduleInterval{}
		}
		raw, err := json.Marshal(intervals)
		if err != nil {
			log.Printf("[Schedule] Failed to encode exception: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
			return
		}
		if _, err := tx.ExecContext(c.Request.Context(), rebindQuery(`
			INSERT INTO nutritionist_schedule_exceptions (nutritionist_id, exception_date, intervals) VALUES (?, ?, ?)
		`), id, exception.Date, string(raw)); err != nil {
			log.Printf("[Schedule] Failed to save exception: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
			return
		}
	}
	if err := tx.Commit(); err != nil {
		log.Printf("[Schedule] Failed to commit update: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update schedule"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "schedule updated"})
}
