# Python paid MCP app

Delta only. Shared paywall contract lives in [../tool-design.md](../tool-design.md). Do not open another `languages/*.md`.

Host: `./scripts/http.sh` on **3030**. `inputModes: scratch` only — OpenAPI codegen is not on this row.

## Imports

```python
from mcp.server.lowlevel.server import Server
from solvapay.facade import SolvaPay
from solvapay_mcp import ResponseContext, register_payable_tool
```

Factory in `main.py`: `create_solvapay_mcp_server` from `solvapay_mcp` with `hide_tools_by_audience=["ui"]`; client via `create_solvapay` from `solvapay.facade`.

## Registration

```python
def register_tools(server: Server[object], *, solvapay: SolvaPay, product: str) -> None:
    async def get_item(args: dict[str, object], ctx: ResponseContext) -> object:
        item_id = args.get("id")
        data = await load_item(item_id)
        return ctx.respond(
            data,
            {"text": f"Item {item_id}. Render as a card with the key fields."},
        )

    register_payable_tool(
        server,
        "get_item",
        solvapay=solvapay,
        product=product,
        title="Get item",
        description=(
            "Returns the requested item. 1 credit per call; when gated, "
            "text-only narration names `account`."
        ),
        input_schema={
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
        handler=get_item,
    )
```

Call `register_tools(server, solvapay=solvapay, product=product)` after `create_solvapay_mcp_server(...)`.

## Respond

Paid handlers return `ctx.respond(data, {"text": narration})`. Second argument is a dict with `text`. Never a raw MCP `content` list from a paid handler.

## File layout

```
main.py              HTTP boot
tools.py             register_tools(...)
http_serve.py        Starlette/uvicorn app
pyproject.toml
scripts/http.sh
```

Replace the placeholder in `tools.py`. Add further paid tools in the same file (or a module it imports) and register them from `register_tools`.

## Install and run

```bash
node scripts/check-toolchain.mjs --language python
node scripts/scaffold-app.mjs ./my-mcp --language python --tool-name generate_haiku --dev
npx -y solvapay@latest init
uv sync
./scripts/http.sh     # :3030
```

If the gate printed `ok checkout`, pass `--dev` to the scaffolder so `pyproject.toml` gets `[tool.uv.sources]` path deps.

## Environment

| Variable | Role |
| --- | --- |
| `SOLVAPAY_SECRET_KEY` | Server secret. `.env` only, never client-side |
| `SOLVAPAY_PRODUCT_REF` | `prd_…` (`SOLVAPAY_PRODUCT` is accepted as an alias) |
| `MCP_PUBLIC_BASE_URL` | Public origin (`http://localhost:3030` locally) |
| `SOLVAPAY_API_BASE_URL` | Optional. Local stack: `http://localhost:3010` |
| `MCP_PORT` / `MCP_HOST` | Optional listen override (default `127.0.0.1:3030`) |

## Troubleshooting

- Missing `uv`: https://docs.astral.sh/uv/ — required for `uv sync` and `http.sh`.
- PyPI 404 for `solvapay` / `solvapay-mcp` is the expected steady state. This row installs from a local `solvapay-sdk` checkout (`--dev` + `SOLVAPAY_SDK_ROOT`), not from a package registry.
- `uv sync` builds the native extension via PEP 517; a missing global `maturin` is not a blocker.
- `--dev` path deps are **not** uv-editable. That keeps the PyO3 `.so` out of the checkout's shared `target/`. Do not add `editable = true` to the generated `[tool.uv.sources]` — a leftover Mac dylib in that `target/` wins over a fresh Linux build (`invalid ELF header`).
- After changing checkout Python sources, stale uv wheels keep the old files. Run `uv cache clean solvapay-mcp` (and `solvapay` if the facade changed) before the next `uv sync`.
- If you must compile against the checkout, set `CARGO_TARGET_DIR` to a directory **outside** the SDK tree so a foreign-platform artifact cannot shadow the build.
- Scaffolder `⚠️` means install failed — do not continue.
- First `uv sync` against a checkout can take several minutes.
