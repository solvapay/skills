# Managed MCP product console (existing product only)

Use when the user already has a Managed MCP product and needs to bootstrap or reconfigure plans via API — **not** for code-based MCP server work.

Any MCP server monetized in code (greenfield, existing, factory wrap) → hand off to `solvapay/create-mcp-app`.

Call the SDK methods on a `createSolvaPay()` instance. Do not POST a raw JSON blob — `bootstrapMcpProduct` / `configureMcpPlans` own the routes (`POST /v1/sdk/products/mcp/bootstrap`, `PUT /v1/sdk/products/{productRef}/mcp/plans`).

## Bootstrap MCP product

`solvaPay.bootstrapMcpProduct(params)` creates the product, plans, and optional tool mapping in one call.

`originUrl` must be **HTTPS** — HTTP origins are rejected. `plans[].options` is required; there is no `price` / `freeUnits` / `billingCycle` field on the plan. Omitting `tools` triggers auto-discovery from the origin server (`autoMappedTools` / `toolsAutoMapped` on the result).

```typescript
import { createSolvaPay } from '@solvapay/server'

const solvaPay = createSolvaPay()

const result = await solvaPay.bootstrapMcpProduct({
  name: 'Docs Assistant',
  originUrl: 'https://origin.example.com/mcp',
  plans: [
    {
      key: 'free',
      name: 'Free',
      currency: 'USD',
      options: [
        { kind: 'billingCycle', interval: 'month' },
        { kind: 'charge', per: 'flat', amountMinor: 0, currency: 'USD' },
        // Included allowance per cycle; 0 means unlimited.
        { kind: 'entitlement', feature: 'included_units', value: 100 },
      ],
    },
    {
      key: 'pro',
      name: 'Pro',
      currency: 'USD',
      options: [
        { kind: 'billingCycle', interval: 'month' },
        { kind: 'charge', per: 'flat', amountMinor: 2000, currency: 'USD' },
      ],
    },
  ],
  tools: [
    { name: 'list_docs', planKeys: ['free', 'pro'] },
    { name: 'deep_research', planKeys: ['pro'] },
  ],
})
```

Response includes `product.reference`, `mcpServer.mcpProxyUrl`, `planMap`, and (when auto-discovery ran) `autoMappedTools` / `toolsAutoMapped`.

Docs topic: `bootstrap mcp product`, `create a Managed MCP product`.

## Configure MCP plans

`solvaPay.configureMcpPlans(productRef, params)` evolves pricing and tool mapping after bootstrap.

The body is `{ plans?, toolMapping? }` — **not** `tools`. Reusing the bootstrap `tools` key is stripped by validation and no mapping is applied.

```typescript
await solvaPay.configureMcpPlans(result.product.reference, {
  plans: [
    {
      key: 'pro',
      name: 'Pro',
      currency: 'USD',
      options: [
        { kind: 'billingCycle', interval: 'month' },
        { kind: 'charge', per: 'flat', amountMinor: 3000, currency: 'USD' },
      ],
    },
  ],
  toolMapping: [
    { name: 'list_docs', planKeys: ['pro'] },
    { name: 'deep_research', planKeys: ['pro'] },
  ],
})
```

Replace-all plans by sending a full `plans` array. Remap tools only by sending `toolMapping` without `plans`.

Docs topic: `configure mcp plans`.
