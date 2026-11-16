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

Adding SolvaPay to an existing uv or Poetry project: run `npx -y solvapay@latest init --language python --features mcp`. It writes `.env` and installs an exact pin with `uv add` or `poetry add`. With plain pip it only prints the `python -m pip install 'solvapay[mcp]==<version>'` line for you to run.

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
- **Server on MCP SDK 1.x (`FastMCP`) or the separate `fastmcp` package**: `solvapay[mcp]` needs `mcp>=2.3,<3`, where `FastMCP` became `MCPServer`. Move the tools as above; there is no adapter.
- **Server with its own sign-in** (its own OAuth or token check on `/mcp`): SolvaPay sign-in replaces it on `/mcp`. Python has no external authorization server mode, so a server cannot keep accepting its own tokens and sell paid tools. Do not offer that as an option. Tell the user that their MCP customers will sign in through SolvaPay, and that their identity service stays in place for everything outside `/mcp`.
- Do not use the lower-level `solvapay.mcp.register_payable_tool` to keep an existing server or its sign-in. It adds no SolvaPay sign-in and no `account` / `activate_plan` tools, so a customer who meets the paywall has no way to pay.

## Keep the SDK current

```bash
npx -y solvapay@latest doctor
```

It reads the `solvapay` pin from `uv.lock`, `poetry.lock` or `requirements.txt`, compares it with the newest release and prints the exact upgrade command (`uv add 'solvapay[mcp]==<v>'`, `poetry add …` or a pip line). Run it after scaffold, before every deploy and before reporting a bug; then run `uv run pytest`. Until 1.0.0 a minor release may change the API: fix call sites rather than pinning back. The scaffold's `.github/dependabot.yml` (uv) opens the upgrade PRs.

## Gotchas

- `PUBLIC_BASE_URL` must be exactly the URL clients connect to, without `/mcp`. It is the OAuth issuer (sign-in fails on a mismatch) and the DNS-rebinding allow-list: a request through any other host gets `421`. Restart after the tunnel URL changes.
- Every request to `/mcp` needs a bearer token SolvaPay verifies. There is no anonymous tool and no anonymous bucket; a tool argument is never trusted as the customer.
- `create_solvapay_mcp_server` needs a product (`SOLVAPAY_PRODUCT_REF` or `product_ref=`), or it raises `missing_product`.
- `from mcp.server.fastmcp import FastMCP` fails on `mcp` 2.x. Import `MCPServer` from `mcp.server.mcpserver` if you need the type.
- Annotation fields are snake_case on `mcp` 2.x: `ToolAnnotations(idempotent_hint=True)`, not `idempotentHint`.
- The widget's six transport tools are hidden from the model through `_meta.ui.visibility`. Pass `hide_tools_by_audience=["ui"]` to `create_solvapay_mcp_server` for hosts that list them anyway.
