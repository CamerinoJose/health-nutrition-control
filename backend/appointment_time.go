package main

import (
	"fmt"
	"sort"
	"time"
	_ "time/tzdata"
)

// appointmentInstants returns every instant represented by a local appointment
// time. A daylight-saving transition can make the local time absent or repeated.
func appointmentInstants(date, clock string, location *time.Location) ([]time.Time, error) {
	if location == nil {
		return nil, fmt.Errorf("appointment time zone is required")
	}
	local, err := time.Parse("2006-01-02 15:04", date+" "+clock)
	if err != nil || local.Format("2006-01-02 15:04") != date+" "+clock {
		return nil, fmt.Errorf("invalid appointment date or time")
	}

	start := local.Add(-48 * time.Hour)
	end := local.Add(48 * time.Hour)
	offsets := make(map[int]struct{})
	for current := start; current.Before(end); {
		zoned := current.In(location)
		_, offset := zoned.Zone()
		offsets[offset] = struct{}{}
		_, next := zoned.ZoneBounds()
		if next.IsZero() || !next.After(current) || !next.Before(end) {
			break
		}
		current = next
	}

	var instants []time.Time
	for offset := range offsets {
		candidate := local.Add(-time.Duration(offset) * time.Second)
		if candidate.In(location).Format("2006-01-02 15:04") == date+" "+clock {
			instants = append(instants, candidate)
		}
	}
	sort.Slice(instants, func(i, j int) bool { return instants[i].Before(instants[j]) })
	return instants, nil
}
