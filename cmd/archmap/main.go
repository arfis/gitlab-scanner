// cmd/archmap/main.go
package main

import (
	"flag"
	"fmt"
	"gitlab-list/internal"
	"gitlab-list/internal/service/archmap"
	"os"
)

func main() {
	// ----- flags / env -----
	var (
		ref     string
		mod     string
		radius  int
		ignores string
	)
	flag.StringVar(&ref, "ref", internal.Getenv("REF", ""), "Git ref (branch/commit) to scan (default: repo default branch)")
	flag.StringVar(&mod, "module", internal.Getenv("MODULE", ""), "Module/service to focus on (e.g., drg or full module path)")
	flag.IntVar(&radius, "radius", internal.GetenvInt("RADIUS", 1), "Neighborhood radius from the selected node (ignored if no module)")
	flag.StringVar(&ignores, "ignore", internal.Getenv("IGNORE", "archived,sandbox"), "Comma-separated substrings to ignore in project path")
	flag.Parse()

	// Create and run the application
	app, err := archmap.NewApp()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create application: %v\n", err)
		os.Exit(1)
	}

	if err := app.Run(ref, mod, radius, internal.SplitCSV(ignores)); err != nil {
		fmt.Fprintf(os.Stderr, "Application failed: %v\n", err)
		os.Exit(1)
	}
}
