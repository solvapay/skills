# Go

The Go API for a paid MCP server: the module `github.com/solvapay/solvapay-sdk/go`, on the official MCP Go SDK (`github.com/modelcontextprotocol/go-sdk`), served with `net/http`. Read [../tool-design.md](../tool-design.md) first for the language-neutral contract; this file is the code. Docs page: `/sdks/go/guides/mcp` (find it through the Docs MCP chain in SKILL.md).

## Install

Go 1.26 or later. New project:

```bash
npm create solvapay@latest my-mcp -- --type mcp --language go
cd my-mcp
go mod tidy
```

The scaffold: `go.mod` (requires `github.com/solvapay/solvapay-sdk/go` at a pinned version), `main.go`, `tools.go`, `tools_test.go`, `.env.example`, a multi-stage `Dockerfile`, `.github/dependabot.yml` (gomod). Go is from-scratch only: `--openapi` with `--language go` fails.

Adding SolvaPay to an existing module: `npx -y solvapay@latest init --language go` writes `.env` and runs `go get github.com/solvapay/solvapay-sdk/go@<version> && go mod tidy`. In a folder without `go.mod`, run `go mod init <module>` first.

## Imports

```go
import (
	"context"
	"encoding/json"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	solvapay "github.com/solvapay/solvapay-sdk/go"
)
```

`solvapay.NewClient(solvapay.Config{})` reads `SOLVAPAY_SECRET_KEY` (fails with `missing_secret` without it). `NewMCPServer` reads `SOLVAPAY_PRODUCT_REF` when `ProductRef` is empty.

## Register a paid tool

```go
// main.go (the scaffold also loads .env before this)
func main() {
	client, err := solvapay.NewClient(solvapay.Config{})
	if err != nil {
		log.Fatal(err)
	}
	server, err := solvapay.NewMCPServer(solvapay.MCPServerOptions{
		Client:        client,
		PublicBaseURL: os.Getenv("PUBLIC_BASE_URL"), // the URL MCP clients use
		Name:          "research",
	})
	if err != nil {
		log.Fatal(err)
	}
	if err := registerTools(server); err != nil {
		log.Fatal(err)
	}
	log.Fatal(http.ListenAndServe(":"+os.Getenv("PORT"), server.Handler())) // MCP endpoint /mcp
}
```

```go
// tools.go
func registerTools(server *solvapay.MCPServer) error {
	return server.RegisterPayable("get_quote", solvapay.PaidTool{
		Title:       "Get quote",
		Description: "Latest price for a ticker symbol.",
		InputSchema: map[string]any{
			"type":       "object",
			"properties": map[string]any{"symbol": map[string]any{"type": "string"}},
			"required":   []any{"symbol"},
		},
		Annotations: &solvapay.ToolAnnotations{IdempotentHint: solvapay.Hint(true)},
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
```

- `InputSchema` is a JSON Schema with `type: object`: a `map[string]any`, a `json.RawMessage` or a `*jsonschema.Schema`. Calls are checked against it before the handler runs. `nil` means no arguments.
- Annotations default to read-only and open-world. Override a hint with `solvapay.Hint(false)`, for example `ReadOnlyHint: solvapay.Hint(false), DestructiveHint: solvapay.Hint(true)` for a tool that changes state.
- The SDK appends a line telling the model to call `account` for balance and cost per call.
- `Product` bills one tool against another product.

## Free tool

**Free-capped** (needs a signed-in customer, counted against a `free-*` meter). `RegisterFree(name, limit, tool)` takes three arguments:

```go
err := server.RegisterFree("search", solvapay.FreeLimit{
	Cap:        20,
	Scope:      "rolling_window", // or "lifetime"
	WindowDays: 30,
}, solvapay.PaidTool{
	Description: "Search the catalogue.",
	Handler: func(ctx context.Context, args json.RawMessage, rc *solvapay.ResponseContext) (*solvapay.ToolResponse, error) {
		return rc.Respond(map[string]any{"results": []string{"AAPL", "MSFT"}}, solvapay.RespondOptions{}), nil
	},
})
```

`FreeLimit.Meter` empty means `free-requests`; otherwise `free-` plus lowercase letters, digits or dashes. Tools naming the same meter must declare the same limit.

**Uncounted** tools go on the underlying `*mcp.Server` with the MCP Go SDK's own `mcp.AddTool`. They skip the paywall, but `/mcp` still requires a signed-in customer (see Gotchas):

```go
type pingArgs struct{}

mcp.AddTool(server.Server(), &mcp.Tool{Name: "ping", Description: "Health check. Free."},
	func(ctx context.Context, req *mcp.CallToolRequest, _ pingArgs) (*mcp.CallToolResult, any, error) {
		return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: "pong"}}}, nil, nil
	})
```

## Respond and narration

- `rc.Respond(data, solvapay.RespondOptions{...})` is the answer. `data` is sent as JSON text and, when it is an object, as structured content. `Text` (a `*string`) replaces the JSON text with your narration; `Nudge` appends a soft prompt; `OmitDataText` drops the data from the content when `Text` or `Nudge` is set.
- `return nil, rc.Gate("Reports over 50 pages need the Pro plan.")` stops the call with a paywall. Nothing is recorded as usage.
- `rc.Emit(block)` queues a content block (`&mcp.TextContent{...}`) ahead of the answer.
- `rc.Customer` has `Ref`, `Balance`, `Remaining`, `WithinLimits`, `Overage`, `IsCreditBased`, `Plan`; `rc.Customer.Fresh(ctx)` re-reads it. `rc.Product.Reference` is the product charged.

```go
options := solvapay.RespondOptions{Text: &narration}
if rc.Customer.Remaining != nil && *rc.Customer.Remaining < 10 {
	options.Nudge = &solvapay.Nudge{Kind: solvapay.NudgeApproachingLimit}
}
return rc.Respond(report, options), nil
```

Nudge kinds: `NudgeLowBalance`, `NudgeCycleEnding`, `NudgeApproachingLimit`. Any other error the handler returns goes back to the model as a tool error, and the call is recorded as failed.

## Run locally

```bash
cp .env.example .env     # or: npx -y solvapay@latest init
ngrok http 8080          # copy the https URL into PUBLIC_BASE_URL in .env
go run .
```

`.env`: `SOLVAPAY_SECRET_KEY`, `SOLVAPAY_PRODUCT_REF`, `PUBLIC_BASE_URL`, `PORT` (8080). Add `<PUBLIC_BASE_URL>/mcp` to an MCP client as a remote server; it opens SolvaPay's sign-in.

## Test

```bash
go test ./...
go vet ./...
npx -y solvapay@latest verify https://<your-tunnel>/    # server running; exits 1 on failure
```

Unit tests need no keys: point the client at an `httptest.Server` that stands in for the SolvaPay API, and pin the customer per tool:

```go
client, err := solvapay.NewClient(solvapay.Config{APIKey: "sk_sandbox_test", APIBaseURL: api.URL})
server, err := solvapay.NewMCPServer(solvapay.MCPServerOptions{Client: client, ProductRef: "prd_1", PublicBaseURL: "https://mcp.example.com"})
// in a PaidTool:
GetCustomerRef: func(context.Context, mcp.Request) (string, error) { return "cus_1", nil },
```

`verify` checks the OAuth discovery documents, that `tools/list` has `account` and `activate_plan` with the widget tools hidden (or a well-formed 401 challenge), the paywall gate narration and the `account` default view.

## Deploy

As a container: [../hosting/container.md](../hosting/container.md). The scaffold's multi-stage `Dockerfile` builds a static binary. Set `PUBLIC_BASE_URL` to the service's public URL and keep `SOLVAPAY_SECRET_KEY` in the host's secret store.

## Existing server

Paid tools need the SDK's own server, `solvapay.NewMCPServer`: `RegisterPayable` and `RegisterFree` are methods on it, and its `Handler()` adds SolvaPay sign-in on `/mcp`, the OAuth routes and the `account` / `activate_plan` tools that every paywall message names. There is no function that adds a paid tool to a `*mcp.Server` you built yourself.

- **Server on the official MCP Go SDK** (`github.com/modelcontextprotocol/go-sdk`): build a `NewMCPServer`, move paid tools to `RegisterPayable` / `RegisterFree`, and re-add the uncounted ones with `mcp.AddTool(server.Server(), ...)`. Serve `server.Handler()`; mount your other routes next to it on your own `http.ServeMux`.
- **Server on another Go MCP library**: move the tools as above; there is no adapter.
- `solvapay.Payable(paywall, options, fn)` gates a plain function for a customer ref you pass in. It works inside any handler, but gives you no SolvaPay sign-in and no `account` tool, which the paywall message names. Use it only for an HTTP API (see `solvapay/app-integration`), not to paywall MCP tools.

## Keep the SDK current

```bash
npx -y solvapay@latest doctor
```

It reads the `github.com/solvapay/solvapay-sdk/go` requirement from `go.mod`, compares it with the newest `go/vX.Y.Z` release and prints the exact command (`go get github.com/solvapay/solvapay-sdk/go@vX.Y.Z && go mod tidy`). Run it after scaffold, before every deploy and before reporting a bug; then run `go test ./...`. Until v1.0.0 a minor release may change the API: fix call sites rather than pinning back. The scaffold's `.github/dependabot.yml` (gomod) opens the upgrade PRs.

## Gotchas

- `PublicBaseURL` must be exactly the URL clients connect to, without `/mcp`. It is the OAuth issuer clients see; `http://localhost:8080` while clients use a tunnel URL makes sign-in fail. Restart after the tunnel URL changes.
- `/mcp` answers only requests whose bearer token SolvaPay verifies. There is no anonymous tool and no anonymous bucket.
- `NewMCPServer` fails without `Client`, `PublicBaseURL` or a product. Check the error; do not start a server that has none.
- `RespondOptions.Text` is a `*string`: take the address of a variable.
- `RegisterPayable` and `RegisterFree` return an error (a bad schema, a mismatched free limit). Fail startup on it.
- The widget's six transport tools are hidden from the model through `_meta.ui.visibility`. Set `HideToolsByAudience: []string{"ui"}` for hosts that list them anyway.
