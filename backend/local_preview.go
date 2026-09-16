package main

import (
	"os"
	"strings"
)

func localPreviewOrigins() []string {
	raw := strings.TrimSpace(os.Getenv("EXTRA_CORS_ORIGINS"))
	if raw == "" {
		return nil
	}

	origins := make([]string, 0)
	for _, value := range strings.Split(raw, ",") {
		origin := strings.TrimSpace(value)
		if origin != "" {
			origins = append(origins, origin)
		}
	}
	return origins
}
