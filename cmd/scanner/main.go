package main

import (
	"gitlab-list/internal/configuration"
	"gitlab-list/internal/service/scanner"
)

func main() {
	cfg, err := configuration.NewConfiguration()
	if err != nil {
		panic(err)
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
