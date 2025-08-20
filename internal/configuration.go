package internal

import (
	"github.com/ilyakaznacheev/cleanenv"
)

type Configuration struct {
	Token string `env:"GITLAB_TOKEN" env-default:"n5sYnGbw__3dZT4sHDXB"`
	Group string `env:"GROUP" env-default:"nghis"`
	Tag   string `env:"TAG" env-default:"services"`
}

func NewConfiguration() (*Configuration, error) {
	var configuration Configuration
	err := cleanenv.ReadEnv(&configuration)
	if err != nil {
		return nil, err
	}
	return &configuration, nil
}
