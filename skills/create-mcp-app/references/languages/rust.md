# Rust paid MCP app

Delta only. Shared paywall contract lives in [../tool-design.md](../tool-design.md). Do not open another `languages/*.md`.

Host: `./scripts/http.sh` on **3030**. `inputModes: scratch` only — OpenAPI codegen is not on this row.

## Imports

```rust
use serde_json::{json, Map, Value};
use solvapay_mcp::{PayableHandler, PayableTool};
use std::sync::Arc;
use futures::FutureExt;
```

The scaffold registers tools on `McpHttpServer` in `src/main.rs`.

## Registration

```rust
let mut fields = Map::new();
fields.insert("id".into(), json!({ "type": "string" }));
server.register_payable(
    PayableTool {
        name: "get_item".into(),
        product: product.clone(),
        title: Some("Get item".into()),
        description: Some(
            "Returns the requested item. 1 credit per call; when gated, \
             text-only narration names `account`."
                .into(),
        ),
        input_schema: Some(fields),
        output_schema: None,
        usage_type: None,
    },
    handler,
    None,
)?;
```

The third argument is `Option<_>` metadata — pass `None`.

## Respond

```rust
fn get_item_handler() -> PayableHandler {
    Arc::new(|args, mut ctx| {
        async move {
            let id = args
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned();
            let data = load_item(&id);
            ctx.respond(data, Some(json!({ "text": format!("Item {id}. Render as a card.") })))
        }
        .boxed()
    })
}
```

`ctx.respond(json!(data), Some(json!({"text": narration})))`. The second argument may be `None`; prefer a render-instruction `text`.

## File layout

```
src/main.rs          server + payable registration (inline)
Cargo.toml
scripts/http.sh
```

Replace the placeholder handler and `PayableTool { name: ... }` in `src/main.rs`. Additional paid tools are more `register_payable` calls in `main`.

## Install and run

```bash
node scripts/check-toolchain.mjs --language rust
node scripts/scaffold-app.mjs ./my-mcp --language rust --tool-name generate_haiku
npm create solvapay@latest my-mcp -- --type mcp --language rust --no-openapi --tool-name generate_haiku
npx -y solvapay@latest init --language rust
cargo fetch
./scripts/http.sh     # :3030
```

If the gate printed `ok checkout`, pass `--dev` so `Cargo.toml` uses `solvapay = { path = "…" }`.

## Environment

| Variable | Role |
| --- | --- |
| `SOLVAPAY_SECRET_KEY` | Server secret. `.env` only, never client-side |
| `SOLVAPAY_PRODUCT_REF` | `prd_…` (`SOLVAPAY_PRODUCT` is accepted as an alias) |
| `MCP_PUBLIC_BASE_URL` | Public origin (`http://localhost:3030` locally) |
| `SOLVAPAY_API_BASE_URL` | Optional. Local stack: `http://localhost:3010` |
| `MCP_PORT` / `MCP_HOST` | Optional listen override (default `127.0.0.1:3030`) |

## Troubleshooting

- Missing `cargo`: https://rustup.rs.
- crates.io 404 for `solvapay` / `solvapay-mcp`: expected until publish. Use `--dev` + `SOLVAPAY_SDK_ROOT`.
- First `cargo` build against the checkout compiles the core — several minutes. Timeouts belong on the language row, not a shorter global.
- Scaffolder `⚠️` means `cargo fetch` failed — do not continue.
