package main

import (
	"fmt"
	"os"

	"gitlab-list/internal/configuration"
	"gitlab-list/internal/service/scanner"
)

func main() {
	cfg, err := configuration.NewConfiguration()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load configuration: %v\n", err)
		os.Exit(1)
	}

	//scanner.NewGoScanner(cfg).
	//	SetParams("1.21.0").
	//	SetIgnore("client").
	//	Scan()
	//
	scanner.NewClientScanner(cfg).
		SetPrefixes("git.prosoftke.sk/nghis/openapi/clients/go/nghisorganizationgoclient").
		SetIgnore("archived", "sandbox").
		SetPrintFullPath(false).
		Scan()
}
