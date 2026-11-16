# Python

The Python API for a paid MCP server: the `solvapay` package with the `mcp` extra, on the official MCP Python SDK (`mcp` 2.x) and Starlette, served with uvicorn. Read [../tool-design.md](../tool-design.md) first for the language-neutral contract; this file is the code. Docs page: `/sdks/python/guides/mcp` (find it through the Docs MCP chain in SKILL.md).

## Install

Python 3.10 or later and [uv](https://docs.astral.sh/uv/). New project:

```bash
npm create solvapay@latest my-mcp -- --type mcp --language python
cd my-mcp
uv sync
```

The scaffold is a uv project: `pyproject.toml` (`solvapay[mcp]` pinned exactly, `uvicorn`, `python-dotenv`; dev group `pytest`), `server.py`, `tools.py`, `tests/test_tools.py`, `.env.example`, `Dockerfile`, `.github/dependabot.yml`. Python is from-scratch only: `--openapi` with `--language python` fails.

Adding SolvaPay to an existing uv or Poetry project: run `npx -y solvapay@latest init --language python --features mcp`. It writes `.env` (with `PORT` and `PUBLIC_BASE_URL` when they're missing) and installs an exact pin with `uv add` or `poetry add`. With plain pip it only prints the `python -m pip install 'solvapay[mcp]==<version>'` line for you to run. It stops before sign-in, with nothing written, when the project can't take `mcp` 2.x yet: `mcp` locked below 2, a requirement that rules out 2.3, `fastapi-mcp`, or code importing `mcp.server.fastmcp` or `fastapi_mcp`. See Existing server.

## Imports

```python
import os

from mcp.types import ToolAnnotations
from solvapay import FreeLimit, create_solvapay
from solvapay.mcp import Nudge, ResponseContext, create_solvapay_mcp_server
from solvapay.mcp.response import ResponseResult
```

`create_solvapay()` reads `SOLVAPAY_SECRET_KEY` (raises `missing_secret` without it) and `SOLVAPAY_PRODUCT_REF`.

## Register a paid tool

`server.py` builds the server and serves it; `tools.py` registers the tools.

```python
# server.py
import os

import uvicorn
from dotenv import load_dotenv
from solvapay import create_solvapay
from solvapay.mcp import create_solvapay_mcp_server

from tools import register_tools

load_dotenv()

mcp = create_solvapay_mcp_server(
    solvapay=create_solvapay(),
    public_base_url=os.environ["PUBLIC_BASE_URL"],  # the URL MCP clients use
    name="research",
    hide_tools_by_audience=["ui"],  # keep the widget's own tools out of tools/list
)
register_tools(mcp)
app = mcp.http_app()  # MCP endpoint /mcp, plus the OAuth routes

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ["PORT"]))
```

```python
# tools.py
from typing import Annotated

from mcp.types import ToolAnnotations
from pydantic import Field
from solvapay.mcp import ResponseContext, SolvaPayMcpServer
from solvapay.mcp.response import ResponseResult


def register_tools(mcp: SolvaPayMcpServer) -> None:
    async def get_quote(
        symbol: Annotated[str, Field(description="Ticker symbol, such as AAPL.")],
        ctx: ResponseContext,
    ) -> ResponseResult:
        data = {"symbol": symbol, "price": 101.5}
        return ctx.respond(data, text=f"{symbol} trades at 101.5. Render as a one-line quote.")

    mcp.register_payable(
        "get_quote",
        handler=get_quote,
        title="Get quote",
        description="Latest price for a ticker symbol.",
        annotations=ToolAnnotations(idempotent_hint=True),
    )
```

- The handler is an `async` function. Its parameters, except the `ResponseContext`, become the input schema. A handler without a `ctx: ResponseContext` parameter raises `invalid_handler` at registration.
- `register_payable` appends a line telling the model the tool is paid and that `account` shows the cost.
- Annotations default to read-only and open-world. Pass `ToolAnnotations(read_only_hint=False, destructive_hint=True)` for a tool that changes state.
- `product="prd_..."` bills one tool against another product.

## Free tool

**Free-capped** (needs a signed-in customer, counted against a `free-*` meter):

```python
async def search(query: str, ctx: ResponseContext) -> ResponseResult:
    return ctx.respond({"query": query, "results": []}, text="No matches. Say so in one line.")


mcp.register_free(
    "search",
    handler=search,
    limit=FreeLimit(cap=20, scope="rolling_window", window_days=30),
    description="Search the research archive.",
)
```

`scope` is `rolling_window` (with `window_days`) or `lifetime`. `meter` defaults to `free-requests` and must match `free-[a-z0-9-]+`. Tools naming the same meter must pass an equal `FreeLimit`, or registration raises `invalid_free_limit`.

**Uncounted** tools go on the underlying MCP server, `mcp.server`, with the MCP SDK's own decorator. They skip the paywall, but the `/mcp` endpoint still requires a signed-in customer (see Gotchas):

```python
@mcp.server.tool(name="ping", description="Health check. Free.")
def ping() -> str:
    return "pong"
```

## Respond and narration

| Call | What it does |
| --- | --- |
| `ctx.respond(data, text=None, nudge=None, data_in_text=True)` | The answer. A dict `data` becomes `structuredContent`; `text` replaces the JSON as the first text block. |
| `ctx.gate(reason)` | Stops the call with a paywall naming your reason. Nothing is billed. |
| `await ctx.emit(block)` | Adds a content block ahead of the answer. |
| `ctx.customer` | `ref`, `balance`, `is_credit_based`, `remaining`, `within_limits`, `overage`, `plan`; `await ctx.customer.fresh()` re-reads it. |

```python
nudge = None
if ctx.customer.is_credit_based and (ctx.customer.balance or 0) < 500:
    nudge = Nudge(kind="low-balance")
return ctx.respond(report, text="Render as a table with columns: symbol, price.", nudge=nudge)
```

`Nudge` kinds: `low-balance`, `cycle-ending`, `approaching-limit`. If the handler raises, the tool returns an error result with the message and the call is recorded as failed.

## Run locally

```bash
cp .env.example .env     # or: npx -y solvapay@latest init
ngrok http 8080          # copy the https URL into PUBLIC_BASE_URL in .env
uv run python server.py
```

`.env`: `SOLVAPAY_SECRET_KEY`, `SOLVAPAY_PRODUCT_REF`, `PUBLIC_BASE_URL`, `PORT` (8080). Add `<PUBLIC_BASE_URL>/mcp` to an MCP client as a remote server; it opens SolvaPay's sign-in.

## Test

```bash
uv run pytest
npx -y solvapay@latest verify https://<your-tunnel>/    # server running; exits 1 on failure
```

Unit tests need no keys: build the server with a fake API base URL, pin the customer, and mock the SolvaPay API (for example with `respx`):

```python
solvapay = create_solvapay(api_key="sk_sandbox_test", api_base_url="https://api.test", product_ref="prd_1")
mcp = create_solvapay_mcp_server(solvapay=solvapay, public_base_url="https://mcp.test")
mcp.register_payable("get_quote", handler=get_quote, get_customer_ref=lambda _args, _context: "cus_1")
tools = {t.name for t in await mcp.server.list_tools()}
result = await mcp.server.call_tool("get_quote", {"symbol": "AAPL"})
```

`verify` checks the OAuth discovery documents, that `tools/list` has `account` and `activate_plan` with the widget tools hidden (or a well-formed 401 challenge), the paywall gate narration and the `account` default view.

## Deploy

As a container: [../hosting/container.md](../hosting/container.md). The scaffold's `Dockerfile` runs `server.py`. Set `PUBLIC_BASE_URL` to the service's public URL and keep `SOLVAPAY_SECRET_KEY` in the host's secret store.

## Existing server

Paid tools need the SDK's own server, `create_solvapay_mcp_server`: it adds SolvaPay sign-in on `/mcp`, the OAuth routes and the `account` / `activate_plan` tools that every paywall message names.

- **Server on the official MCP Python SDK 2.x** (`mcp.server.mcpserver.MCPServer`): move the tools onto `create_solvapay_mcp_server(...)`. Paid tools become `register_payable`, capped ones `register_free`, and uncounted ones stay `@mcp.server.tool(...)` on the new server's `.server`. Serve `mcp.http_app()` instead of your old app, or mount your other routes next to it.
- **Server on MCP SDK 1.x (`from mcp.server.fastmcp import FastMCP`)**: `solvapay[mcp]` needs `mcp>=2.3,<3`, where `FastMCP` became `MCPServer`. Installing it would upgrade `mcp` under your server and stop it starting, so `init --features mcp` refuses to run until you migrate. Migrate first with the MCP SDK's guide (`https://py.sdk.modelcontextprotocol.io/v2/migration/`), then move the tools as above. Beyond the import, `mcp` 2.x renames other APIs a larger server may use, such as snake_case annotation fields.
- **Server on the separate `fastmcp` package**: it installs alongside `mcp` 2.3, but its `FastMCP` is not an `MCPServer` and there is no adapter. `init` warns and carries on. Move the tools onto `create_solvapay_mcp_server` as above; fastmcp's middleware, `Context`, server composition and auth providers don't come with them.
- **FastAPI with `fastapi-mcp`**: `fastapi-mcp` runs only on `mcp` 1.x and has no 2.x release, so `init` stops while it is in the project. Remove it, write each generated tool by hand as a `register_payable` handler that calls your route function, and serve FastAPI next to the MCP server as below. Your REST routes keep working unchanged.
- The lower-level `solvapay.mcp.register_payable_tool(server, name, solvapay=..., handler=..., product=...)` takes any `MCPServer`, but without the SolvaPay sign-in the call has no verified customer and is refused unless you pass `get_customer_ref` from your own verified auth, and the `account` tool the paywall names is missing. Use it only when you already verify customers yourself and say so in the handoff.

### FastAPI next to the MCP server

Serve one ASGI app that holds both. The SolvaPay app goes outside, with FastAPI mounted inside it, last, so `/mcp` and the OAuth routes match first:

```python
# server.py
import os

from solvapay import create_solvapay
from solvapay.mcp import ResponseContext, create_solvapay_mcp_server
from solvapay.mcp.response import ResponseResult

from main import api, read_item  # your existing FastAPI app and one of its route functions

mcp = create_solvapay_mcp_server(
    solvapay=create_solvapay(),
    public_base_url=os.environ["PUBLIC_BASE_URL"],
    name="items",
    hide_tools_by_audience=["ui"],
)


async def get_item(item_id: int, ctx: ResponseContext) -> ResponseResult:
    return ctx.respond(read_item(item_id))  # the route function, called directly


mcp.register_payable("get_item", handler=get_item, description="Read one item.")

app = mcp.http_app()
app.mount("/", api)
```

Starlette doesn't run a mounted app's lifespan. If your FastAPI app has its own lifespan or startup handlers, keep FastAPI outside and start SolvaPay's inside it:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI

mcp_app = mcp.http_app()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # your own startup here
    async with mcp_app.router.lifespan_context(mcp_app):  # the MCP session manager
        yield


api = FastAPI(lifespan=lifespan)
# ... your routes ...
api.mount("/", mcp_app)  # last, so your routes match first
```

Never mount `mcp.http_app()` inside FastAPI without that lifespan (`api.mount("/", mcp.http_app())` on its own). The MCP session manager never starts, and every call to `/mcp` fails with a 500: `RuntimeError: Task group is not initialized`.

## Keep the SDK current

```bash
npx -y solvapay@latest doctor
```

It reads the `solvapay` pin from `uv.lock`, `poetry.lock` or `requirements.txt`, compares it with the newest release and prints the exact upgrade command (`uv add 'solvapay[mcp]==<v>'`, `poetry add …` or a pip line). Run it after scaffold, before every deploy and before reporting a bug; then run `uv run pytest`. Until 1.0.0 a minor release may change the API: fix call sites rather than pinning back. The scaffold's `.github/dependabot.yml` (uv) opens the upgrade PRs.

## Gotchas

- `PUBLIC_BASE_URL` must be exactly the URL clients connect to, without `/mcp`. It is the OAuth issuer (sign-in fails on a mismatch) and the DNS-rebinding allow-list: a request through any other host gets `421`. Restart after the tunnel URL changes.
- Every request to `/mcp` needs a bearer token SolvaPay verifies. There is no anonymous tool and no anonymous bucket; a tool argument is never trusted as the customer.
- `create_solvapay_mcp_server` needs a product (`SOLVAPAY_PRODUCT_REF` or `product_ref=`), or it raises `missing_product`.
- `get_customer_ref=` on `create_solvapay_mcp_server` sets the customer for the built-in tools only (`account`, `activate_plan`, the widget's tools). A paid or free tool takes the signed-in customer unless you pass `get_customer_ref=` to its own `register_payable` / `register_free`. If you resolve customers yourself, pass the same function in both places; otherwise your tools refuse the call as having no signed-in customer.
- `from mcp.server.fastmcp import FastMCP` fails on `mcp` 2.x. Import `MCPServer` from `mcp.server.mcpserver` if you need the type.
- Annotation fields are snake_case on `mcp` 2.x: `ToolAnnotations(idempotent_hint=True)`, not `idempotentHint`.
- The widget's six transport tools are hidden from the model through `_meta.ui.visibility`, but some hosts list them anyway. Always pass `hide_tools_by_audience=["ui"]` to `create_solvapay_mcp_server`, as the scaffold does: without it `tools/list` shows them and `verify` fails. ChatGPT still gets the full list, since its widget can only call listed tools.
