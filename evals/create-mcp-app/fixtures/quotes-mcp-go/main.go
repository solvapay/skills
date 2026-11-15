// An existing paid MCP server built with the SolvaPay Go SDK (eval fixture).
// It runs locally with `go run .`; it has never been deployed.
package main

import (
	"log"
	"net/http"
	"os"

	solvapay "github.com/solvapay/solvapay-sdk/go"
)

func main() {
	client, err := solvapay.NewClient(solvapay.Config{}) // SOLVAPAY_SECRET_KEY
	if err != nil {
		log.Fatal(err)
	}
	server, err := solvapay.NewMCPServer(solvapay.MCPServerOptions{
		Client:        client, // product from SOLVAPAY_PRODUCT_REF
		PublicBaseURL: os.Getenv("PUBLIC_BASE_URL"),
		Name:          "quotes",
	})
	if err != nil {
		log.Fatal(err)
	}
	if err := registerTools(server); err != nil {
		log.Fatal(err)
	}
	log.Fatal(http.ListenAndServe(":"+os.Getenv("PORT"), server.Handler()))
}
