package configuration

import (
	"os"
	"path/filepath"

	"github.com/ilyakaznacheev/cleanenv"
)

type Configuration struct {
	Token           string `env:"GITLAB_TOKEN"`
	Group           string `env:"GROUP" env-default:"nghis"`
	Tag             string `env:"TAG" env-default:"services"`
	Port            string `env:"PORT" env-default:"8080"`
	MongoDBURI      string `env:"MONGODB_URI" env-default:"mongodb://localhost:27017"`
	MongoDBUsername string `env:"MONGODB_USERNAME"`
	MongoDBPassword string `env:"MONGODB_PASSWORD"`
	MongoDBDatabase string `env:"MONGODB_DATABASE" env-default:"gitlab_cache"`
	CacheTTL        string `env:"CACHE_TTL" env-default:"24h"`
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

// GetMongoDBURI returns the MongoDB URI with authentication if credentials are provided
func (c *Configuration) GetMongoDBURI() string {
	if c.MongoDBUsername != "" && c.MongoDBPassword != "" {
		// If we have credentials, build authenticated URI
		// Extract host and port from the base URI
		baseURI := c.MongoDBURI
		if baseURI == "" {
			baseURI = "mongodb://localhost:27017"
		}

		// Simple URI building - assumes format like mongodb://host:port
		// For more complex URIs, you might want to use a proper URI parser
		if baseURI == "mongodb://localhost:27017" {
			return "mongodb://" + c.MongoDBUsername + ":" + c.MongoDBPassword + "@localhost:27017"
		}

		// For other URIs, try to insert credentials
		// This is a simple approach - for production, consider using a proper URI builder
		return "mongodb://" + c.MongoDBUsername + ":" + c.MongoDBPassword + "@" + baseURI[10:] // Remove "mongodb://" prefix
	}

	// Return original URI if no credentials
	return c.MongoDBURI
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
