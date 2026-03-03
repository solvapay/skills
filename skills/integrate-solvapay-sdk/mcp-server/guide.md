# MCP Server Paywall Integration

Add paywall protection and self-service tools to an MCP server using `@solvapay/server`.

## Contents

- [Guardrails](#guardrails)
- [Prerequisites](#prerequisites)
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

- `@solvapay/server` installed in the project
- A product created in the SolvaPay dashboard with at least one plan
- `SOLVAPAY_SECRET_KEY` and `SOLVAPAY_PRODUCT_REF` set in the environment

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
  // Your business logic -- only runs if customer is within limits
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

### Different plans per tool

Create separate `payable` instances:

```typescript
const freeTier = solvaPay.payable({ product: productRef, plan: 'pln_free' })
const proTier = solvaPay.payable({ product: productRef, plan: 'pln_pro' })

const toolHandlers = {
  list_tasks: freeTier.mcp(listTasks, { getCustomerRef }),
  create_task: proTier.mcp(createTask, { getCustomerRef }),
}
```

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

// Merge tool definitions for tools/list
const allTools = [
  ...virtualTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
  ...businessTools,
]

// Merge handlers for tools/call
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
  "issuer": "<SOLVAPAY_OAUTH_BASE_URL>",
  "authorization_endpoint": "<SOLVAPAY_OAUTH_BASE_URL>/v1/oauth/authorize",
  "token_endpoint": "<SOLVAPAY_OAUTH_BASE_URL>/v1/oauth/token",
  "registration_endpoint": "<SOLVAPAY_OAUTH_BASE_URL>/v1/oauth/register?product_ref=<SOLVAPAY_PRODUCT_REF>",
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
    `${process.env.SOLVAPAY_OAUTH_BASE_URL}/v1/oauth/userinfo`,
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
| `SOLVAPAY_OAUTH_BASE_URL` | Yes | SolvaPay OAuth server URL |
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
