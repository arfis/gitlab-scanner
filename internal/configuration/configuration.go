package configuration

import (
	"os"
	"path/filepath"

	"github.com/ilyakaznacheev/cleanenv"
)

type Configuration struct {
	Token string `env:"GITLAB_TOKEN"`
	Group string `env:"GROUP" env-default:"nghis"`
	Tag   string `env:"TAG" env-default:"services"`
}

func NewConfiguration() (*Configuration, error) {
	var configuration Configuration

	// Try to find .env file in current directory or parent directories
	envPath := findEnvFile()

	if envPath != "" {
		// Load from .env file
		err := cleanenv.ReadConfig(envPath, &configuration)
		if err != nil {
			return nil, err
		}
	} else {
		// Fall back to environment variables only
		err := cleanenv.ReadEnv(&configuration)
		if err != nil {
			return nil, err
		}
	}

	return &configuration, nil
}

// findEnvFile searches for .env file in current directory and parent directories
func findEnvFile() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}

	for {
		envPath := filepath.Join(dir, ".env")
		if _, err := os.Stat(envPath); err == nil {
			return envPath
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached root directory
			break
		}
		dir = parent
	}

	return ""
}
