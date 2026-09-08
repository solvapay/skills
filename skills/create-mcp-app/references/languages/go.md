# Go paid MCP app

Delta only. Shared paywall contract lives in [../tool-design.md](../tool-design.md). Do not open another `languages/*.md`.

Host: `./scripts/http.sh` on **3030**. `inputModes: scratch` only — OpenAPI codegen is not on this row.

## Imports

```go
import (
	"context"

	solvapaymcp "github.com/solvapay/solvapay-sdk/sdks/go/mcp"
)
```

## Registration

```go
func registerTools(srv *solvapaymcp.Server, product string) error {
	return srv.RegisterPayable("get_item", solvapaymcp.Options{
		Product:     product,
		Title:       "Get item",
		Description: "Returns the requested item. 1 credit per call; when gated, text-only narration names `account`.",
		InputSchema: map[string]any{
			"type":       "object",
			"properties": map[string]any{"id": map[string]any{"type": "string"}},
			"required":   []string{"id"},
		},
		Handler: func(ctx context.Context, args map[string]any, rc *solvapaymcp.ResponseContext) (solvapaymcp.Response, error) {
			id, _ := args["id"].(string)
			data := loadItem(id)
			return rc.Respond(data, map[string]any{"text": "Item " + id + ". Render as a card with the key fields."})
		},
	})
}
```

`main.go` calls `registerTools(srv, product)` after constructing the server.

## Respond

Paid handlers return `rc.Respond(data, map[string]any{"text": narration})`. The second argument may be `nil` when you have no narration; prefer a render-instruction `text`. Never assemble a raw MCP content slice from a paid handler.

## File layout

```
main.go              HTTP boot
tools.go             registerTools
serve.go
dotenv.go
go.mod
scripts/http.sh
```

Replace the placeholder in `tools.go`. Add further `RegisterPayable` calls from `registerTools`. Pass `--module github.com/you/my-mcp` at scaffold time.

## Install and run

```bash
node scripts/check-toolchain.mjs --language go
node scripts/scaffold-app.mjs ./my-mcp --language go --tool-name generate_haiku --module github.com/you/my-mcp
npm create solvapay@latest my-mcp -- --type mcp --language go --no-openapi --tool-name generate_haiku --module github.com/you/my-mcp
npx -y solvapay@latest init --language go
go mod tidy
./scripts/http.sh     # :3030
```

If the gate printed `ok checkout`, pass `--dev` so `go.mod` gets a `replace … => <checkout>/sdks/go` line.

## Environment

| Variable | Role |
| --- | --- |
| `SOLVAPAY_SECRET_KEY` | Server secret. `.env` only, never client-side |
| `SOLVAPAY_PRODUCT_REF` | `prd_…` |
| `MCP_PUBLIC_BASE_URL` | Public origin (`http://localhost:3030` locally) |
| `SOLVAPAY_API_BASE_URL` | Optional. Local stack: `http://localhost:3010` |
| `MCP_PORT` / `MCP_HOST` | Optional listen override (default `127.0.0.1:3030`) |

## Troubleshooting

- Missing `go`: https://go.dev/dl.
- Go proxy 404 for `github.com/solvapay/solvapay-sdk/sdks/go`: expected until the module is published. Use `--dev` + `SOLVAPAY_SDK_ROOT`.
- Scaffolder `⚠️` means `go mod tidy` failed — do not continue.
- `--module` is the `module` path in `go.mod`. Pick it before scaffold; renaming later means rewriting the module line and imports.
