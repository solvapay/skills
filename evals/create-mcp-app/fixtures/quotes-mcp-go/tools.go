package main

import (
	"context"
	"encoding/json"

	solvapay "github.com/solvapay/solvapay-sdk/go"
)

func registerTools(server *solvapay.MCPServer) error {
	return server.RegisterPayable("get_quote", solvapay.PaidTool{
		Title:       "Get quote",
		Description: "Latest price for a ticker symbol.",
		InputSchema: map[string]any{
			"type":       "object",
			"properties": map[string]any{"symbol": map[string]any{"type": "string"}},
			"required":   []any{"symbol"},
		},
		Handler: func(ctx context.Context, args json.RawMessage, rc *solvapay.ResponseContext) (*solvapay.ToolResponse, error) {
			var in struct {
				Symbol string `json:"symbol"`
			}
			if err := json.Unmarshal(args, &in); err != nil {
				return nil, err
			}
			text := in.Symbol + " trades at 101.5. Render as a one-line quote."
			return rc.Respond(map[string]any{"symbol": in.Symbol, "price": 101.5}, solvapay.RespondOptions{Text: &text}), nil
		},
	})
}
