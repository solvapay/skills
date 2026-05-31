# MCP Product Console (existing product only)

Use when the user already has a hosted MCP product and needs to bootstrap or reconfigure plans via API — **not** for greenfield MCP worker scaffold.

Greenfield paid MCP server → hand off to `solvapay/create-mcp-app`.

## Bootstrap MCP product

When user wants one-call MCP product + plan + tool mapping setup:

Request shape:

```json
{
  "name": "Docs Assistant",
  "originUrl": "https://origin.example.com/mcp",
  "plans": [
    { "key": "free", "name": "Free", "price": 0, "freeUnits": 0 },
    { "key": "pro", "name": "Pro", "price": 2000, "billingCycle": "monthly" }
  ],
  "tools": [
    { "name": "list_docs", "planKeys": ["free", "pro"] },
    { "name": "deep_research", "planKeys": ["pro"] }
  ]
}
```

Response includes `product.reference`, `mcpServer.mcpProxyUrl`, `planMap`.

Docs topic: `bootstrap mcp product`, `create hosted mcp product`.

## Configure MCP plans

Use after bootstrap to evolve pricing and tool mapping.

Replace-all plans, revert to free-only, or remap tools only — see prior REFERENCE templates in SolvaPay docs.

Docs topic: `configure mcp plans`.
