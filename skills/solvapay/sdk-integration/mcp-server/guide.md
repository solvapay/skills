# MCP Server Paywall Integration

Add paywall protection and self-service tools to an MCP server using `@solvapay/mcp` (batteries-included factory) or `@solvapay/server` (low-level primitives).

This guide is for SDK-based integrations where you self-host the MCP server and add paywall/auth
logic in code. If you want SolvaPay to host auth, billing, and paywall enforcement through a
managed proxy (no paywall code in your server), use [MCP Pay guide](../../mcp-pay/guide.md).

## Contents

- [Guardrails](#guardrails)
- [Prerequisites](#prerequisites)
- [Factory setup (recommended)](#factory-setup-recommended)
- [SDK initialization](#sdk-initialization)
- [Wrap tool handlers](#wrap-tool-handlers)
- [Register virtual tools](#register-virtual-tools)
- [OAuth bridge setup](#oauth-bridge-setup)
- [Environment variables](#environment-variables)
- [Verification checklist](#verification-checklist)

## Guardrails

- Never wrap virtual tool handlers with `payable.mcp()` -- they bypass the paywall by design.
- Never expose `SOLVAPAY_SECRET_KEY` to clients or public environment variables.
- Never execute paid tool logic before the paywall check runs.
- Always require a stable customer identity for protected tools.
- Always use `@solvapay/server` helpers over raw HTTP calls to the SolvaPay API.

## Prerequisites

- Run `npx solvapay init` to authenticate, write `SOLVAPAY_SECRET_KEY` to
  `.env`, and install base SDK packages.
- Install `@solvapay/mcp` for the batteries-included factory:

  ```bash
  npm install @solvapay/mcp @solvapay/server
  ```

- A product created in SolvaPay Console with at least one plan
- `SOLVAPAY_SECRET_KEY` and `SOLVAPAY_PRODUCT_REF` set in the environment

## Factory setup (recommended)

For new MCP servers, prefer the batteries-included factories from `@solvapay/mcp`. They wire up the full SolvaPay tool surface (check_purchase, create_checkout_session, activate_plan, upgrade, topup, manage_account, plus your paywalled business tools), register the OAuth bridge, and emit the text-only paywall response format — in a single call.

Three runtime-specific factories are exposed via subpaths:

- `@solvapay/mcp` — `createSolvaPayMcpServer` — framework-neutral MCP server object you mount onto any transport.
- `@solvapay/mcp/fetch` — `createSolvaPayMcpFetch` — single `(req: Request) => Promise<Response>` handler for Cloudflare Workers, Deno, Supabase Edge Functions, Bun. Also exposes `createOAuthFetchRouter` if you want to assemble the bridge yourself.
- `@solvapay/mcp/express` — Express middleware variant.

```typescript
// src/server.ts (Cloudflare Worker / Deno / Supabase Edge / Bun)
import { createSolvaPayMcpFetch } from '@solvapay/mcp/fetch'
import { createSolvaPay } from '@solvapay/server'

const solvaPay = createSolvaPay({ apiKey: process.env.SOLVAPAY_SECRET_KEY! })

const handler = createSolvaPayMcpFetch({
  solvaPay,
  productRef: process.env.SOLVAPAY_PRODUCT_REF!,
  publicBaseUrl: process.env.MCP_PUBLIC_BASE_URL!,
  tools: [
    {
      name: 'predict_price_chart',
      description: 'Return a seeded price chart for a ticker.',
      inputSchema: { type: 'object', properties: { ticker: { type: 'string' } } },
      // Wrap the handler with `payable.mcp(...)` to enforce the paywall.
      handler: solvaPay.payable({ product: process.env.SOLVAPAY_PRODUCT_REF! }).mcp(predictPriceChart),
    },
  ],
  // Optional: hide certain tools from certain audiences (LLM / user / agent).
  hideToolsByAudience: { user: ['internal_admin_tool'] },
})

export default { fetch: handler } // Cloudflare Worker export
// or: Deno.serve(handler)
// or: app.use(handler)  // Express via createSolvaPayMcpExpress from @solvapay/mcp/express
```

Key behaviors baked in:

- **Text-only paywall.** When `payable.mcp(…)` detects an over-limit call, the response is a plain-text `Purchase required` narration that routes the host model to the correct recovery intent (`upgrade` / `topup` / `activate_plan`) via the SolvaPay tool surface. No `McpPaywallView` / structured UI payload.
- **CSP auto-injection.** `createSolvaPayMcpFetch` sets `_meta.ui.csp.frameDomains` to include `solvaPay.apiBaseUrl` automatically so MCP App widgets hosted on compliant clients can embed Stripe Elements without extra config.
- **OAuth bridge.** `/oauth/{register,authorize,token,revoke}` + `/.well-known/{oauth-protected-resource,oauth-authorization-server,openid-configuration}` routes are mounted for free.

See examples: [`cloudflare-workers-mcp`](https://github.com/solvapay/solvapay-sdk/tree/main/examples/cloudflare-workers-mcp), [`supabase-edge-mcp`](https://github.com/solvapay/solvapay-sdk/tree/main/examples/supabase-edge-mcp), and [`mcp-checkout-app`](https://github.com/solvapay/solvapay-sdk/tree/main/examples/mcp-checkout-app).

If you need full control (custom transport, legacy servers, bespoke auth), drop down to the manual pattern below.

## SDK initialization

Create a shared config module. All other files import from here.

```typescript
import { createSolvaPay, createSolvaPayClient } from '@solvapay/server'

const apiClient = createSolvaPayClient({
  apiKey: process.env.SOLVAPAY_SECRET_KEY!,
  apiBaseUrl: process.env.SOLVAPAY_API_BASE_URL,
})

export const productRef = process.env.SOLVAPAY_PRODUCT_REF!

export const solvaPay = createSolvaPay({ apiClient })

export const payable = solvaPay.payable({ product: productRef })
```

## Wrap tool handlers

### getCustomerRef helper

The adapter needs a function to extract customer identity from tool arguments. The `_auth` field is injected by the HTTP layer (see [OAuth bridge setup](#oauth-bridge-setup)).

```typescript
const getCustomerRef = (args: Record<string, unknown>) => {
  const auth = args?._auth as { customer_ref?: string } | undefined
  return auth?.customer_ref || 'anonymous'
}
```

### Wrapping pattern

Write business logic as plain functions. Wrap each one with `payable.mcp()`:

```typescript
async function createTask(args: { title: string }) {
  return { success: true, task: { id: crypto.randomUUID(), title: args.title } }
}

const toolHandlers = {
  create_task: payable.mcp(createTask, { getCustomerRef }),
  get_task: payable.mcp(getTask, { getCustomerRef }),
  list_tasks: payable.mcp(listTasks, { getCustomerRef }),
}
```

The adapter automatically:
- Checks usage limits before running business logic
- Tracks usage after successful execution
- Wraps results in MCP `content` format
- Returns a structured paywall error with checkout URL when limits are exceeded

No manual `PaywallError` handling is needed.

## Register virtual tools

Virtual tools provide self-service account management. They are **not** paywall-protected.

| Tool | Description |
| --- | --- |
| `get_user_info` | Returns user profile and purchase status |
| `upgrade` | Returns available plans and checkout URLs |
| `manage_account` | Returns a secure customer portal link |

### Create and merge

```typescript
const virtualTools = solvaPay.getVirtualTools({
  product: productRef,
  getCustomerRef,
})

const allTools = [
  ...virtualTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
  ...businessTools,
]

const virtualToolHandlers = Object.fromEntries(
  virtualTools.map(t => [t.name, t.handler]),
)

const allHandlers = {
  ...virtualToolHandlers,
  create_task: payable.mcp(createTask, { getCustomerRef }),
  get_task: payable.mcp(getTask, { getCustomerRef }),
}
```

To exclude specific virtual tools, pass `exclude: ['manage_account']` in the options.

## OAuth bridge setup

MCP clients authenticate via OAuth. Your server serves discovery endpoints that point to SolvaPay's hosted OAuth backend. SolvaPay handles login, dynamic client registration, and token issuance.

### Well-known endpoints

Serve these two JSON responses from your HTTP server.

**`GET /.well-known/oauth-protected-resource`**

```json
{
  "resource": "<MCP_PUBLIC_BASE_URL>",
  "authorization_servers": ["<MCP_PUBLIC_BASE_URL>"],
  "scopes_supported": ["openid", "profile", "email"]
}
```

**`GET /.well-known/oauth-authorization-server`**

```json
{
  "issuer": "<SOLVAPAY_API_BASE_URL>",
  "authorization_endpoint": "<SOLVAPAY_API_BASE_URL>/v1/customer/auth/authorize",
  "token_endpoint": "<SOLVAPAY_API_BASE_URL>/v1/customer/auth/token",
  "registration_endpoint": "<SOLVAPAY_API_BASE_URL>/v1/customer/auth/register?product_ref=<SOLVAPAY_PRODUCT_REF>",
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "scopes_supported": ["openid", "profile", "email"],
  "code_challenge_methods_supported": ["S256", "plain"]
}
```

### Resolve customer identity

Validate the bearer token by calling SolvaPay's userinfo endpoint:

```typescript
async function resolveCustomerRef(authHeader?: string): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null

  const response = await fetch(
    `${process.env.SOLVAPAY_API_BASE_URL || 'https://api.solvapay.com'}/v1/customer/auth/userinfo`,
    { headers: { Authorization: authHeader } },
  )
  if (!response.ok) return null

  const payload = await response.json() as {
    customerRef?: string
    customer_ref?: string
    sub?: string
  }
  return payload.customerRef || payload.customer_ref || payload.sub || null
}
```

### Inject auth into tool arguments

In your HTTP handler, before passing the request to the MCP framework, inject the customer ref:

```typescript
if (request.body?.method === 'tools/call') {
  request.body.params.arguments._auth = { customer_ref: customerRef }
}
```

For unauthenticated requests, return 401 with:

```
WWW-Authenticate: Bearer resource_metadata="<MCP_PUBLIC_BASE_URL>/.well-known/oauth-protected-resource"
```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `SOLVAPAY_SECRET_KEY` | Yes | API secret key (`sk_...`) |
| `SOLVAPAY_API_BASE_URL` | No | API base URL (defaults to `https://api.solvapay.com`) |
| `SOLVAPAY_PRODUCT_REF` | Yes | Product reference for paywall and OAuth DCR |
| `MCP_PUBLIC_BASE_URL` | Yes | Your server's public origin |

## Verification checklist

- [ ] `resolveCustomerRef` returns null for missing/invalid bearer tokens
- [ ] Unauthenticated requests receive 401 with `WWW-Authenticate` header
- [ ] `GET /.well-known/oauth-protected-resource` returns correct resource metadata
- [ ] `GET /.well-known/oauth-authorization-server` returns endpoints pointing to SolvaPay
- [ ] Protected tool denies over-limit calls with a paywall error containing a checkout URL
- [ ] Protected tool allows authenticated, in-limit calls and returns business logic result
- [ ] Virtual tools (`get_user_info`, `upgrade`, `manage_account`) respond without paywall
- [ ] Virtual tool handlers are NOT wrapped with `payable.mcp()`
