// internal/utils.go
package internal

import (
	"fmt"
	"os"
	"strings"
)

// Getenv returns the value of the environment variable named by the key.
// If the variable is not present, it returns the default value.
func Getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// GetenvInt returns the integer value of the environment variable named by the key.
// If the variable is not present or cannot be parsed, it returns the default value.
func GetenvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		var x int
		if _, err := fmt.Sscanf(v, "%d", &x); err == nil {
			return x
		}
	}
	return def
}

// SplitCSV splits a comma-separated string and returns a slice of trimmed strings.
// Empty strings are filtered out.
func SplitCSV(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
