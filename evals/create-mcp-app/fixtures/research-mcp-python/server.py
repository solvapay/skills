"""An existing research MCP server on the official MCP Python SDK (mcp 2.x).

    uv run python server.py    # MCP endpoint: http://localhost:8080/mcp

No sign-in and no paywall yet: every tool is free to anyone.
"""

from __future__ import annotations

import os

import uvicorn
from mcp.server.mcpserver import MCPServer

server = MCPServer("research")


@server.tool(name="get_quote", description="Latest price for a ticker symbol.")
def get_quote(symbol: str) -> dict[str, object]:
    return {"symbol": symbol.upper(), "price": 101.5, "currency": "USD"}


@server.tool(name="company_brief", description="A short company profile for a ticker symbol.")
def company_brief(symbol: str) -> dict[str, object]:
    return {"symbol": symbol.upper(), "summary": "Makes widgets.", "employees": 1200}


@server.tool(name="ping", description="Health check.")
def ping() -> str:
    return "pong"


app = server.streamable_http_app()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ["PORT"]))
