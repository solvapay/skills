# SDK Reference

## Purpose

Use this file for TypeScript SDK operation patterns and minimal payload shapes.

## Contents

- Package map
- Common operations
- Operation templates
  - Bootstrap MCP product
  - Configure MCP plans
  - Create checkout session
  - Create customer session
  - Check limits
  - Record usage
  - Create/process payment intent (embedded only)
- Minimal install
- Required environment variables
- Guardrails
- Retrieval hints

## Package Map

- `@solvapay/server`: server SDK, paywall handlers, webhook verification, core helpers (`*Core` functions)
- `@solvapay/next`: Next.js helpers for checkout/customer/access/renewal/activation routes
- `@solvapay/supabase`: Supabase Edge Function adapter (one-liner handlers for all operations + `solvapayWebhook` factory)
- `@solvapay/react`: UI provider/hooks for purchase and plan state
- `@solvapay/react-supabase`: Supabase auth adapter for `@solvapay/react`
- `@solvapay/auth`: auth utilities and adapters

## Common Operations

- Create checkout session
- Create customer session (portal)
- Ensure/sync customer
- Check subscription/purchase access
- Record usage events
- Verify webhooks
- Bootstrap MCP product
- Configure MCP plans
- Cancel renewal
- Reactivate renewal
- Activate plan (including plan switching)

## Operation Templates

### Bootstrap MCP Product

Use when the user wants hosted MCP monetization setup in one API call.

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

Response shape:

```json
{
  "product": { "reference": "prd_xxx" },
  "mcpServer": { "mcpProxyUrl": "https://<slug>.mcp.solvapay.com/mcp" },
  "planMap": {
    "free": { "id": "plan_free_id", "reference": "pln_free" },
    "pro": { "id": "plan_pro_id", "reference": "pln_pro" }
  }
}
```

Docs topic hint: `mcp pay bootstrap`, `create hosted mcp pay product`.

### Configure MCP Plans

Use after bootstrap to evolve pricing and tool mapping without recreating the product.

Request shape (replace all plans):

```json
{
  "plans": [
    { "key": "free", "name": "Free", "price": 0, "freeUnits": 100 },
    { "key": "pro", "name": "Pro", "price": 2000, "billingCycle": "monthly" }
  ],
  "toolMapping": [
    { "name": "deep_research", "planKeys": ["pro"] },
    { "name": "list_docs", "planKeys": ["free", "pro"] }
  ]
}
```

Request shape (revert to free-only):

```json
{
  "plans": [
    { "key": "free", "name": "Free", "price": 0, "freeUnits": 0 }
  ]
}
```

Request shape (remap tools only):

```json
{
  "toolMapping": [
    { "name": "deep_research", "planKeys": ["pro"] }
  ]
}
```

Response shape:

```json
{
  "product": { "reference": "prd_xxx" },
  "mcpServer": { "mcpProxyUrl": "https://<slug>.mcp.solvapay.com/mcp" },
  "planMap": {
    "free": { "id": "plan_free_id", "reference": "pln_free" },
    "pro": { "id": "plan_pro_id", "reference": "pln_pro" }
  }
}
```

Docs topic hint: `configure mcp plans`.

### Create Checkout Session

Use when user needs hosted checkout redirect.

Request shape:

```json
{
  "customerRef": "cus_xxx",
  "productRef": "prd_xxx",
  "planRef": "pln_xxx",
  "returnUrl": "https://app.example.com/billing/return"
}
```

Response shape:

```json
{
  "checkoutUrl": "https://solvapay.com/checkout?...",
  "sessionId": "..."
}
```

Docs topic hint: `checkout sessions create`.

### Create Customer Session

Use when user needs hosted billing portal access.

Request shape:

```json
{
  "customerRef": "cus_xxx"
}
```

Response shape:

```json
{
  "customerUrl": "https://solvapay.com/customer/...",
  "sessionId": "..."
}
```

Docs topic hint: `customer session create`.

### Check Access and Limits

Use before expensive or paid operations to enforce monetization.

Request shape (conceptual):

```json
{
  "customerRef": "cus_xxx",
  "productRef": "prd_xxx"
}
```

Response shape should indicate access status and upgrade path when blocked.

Docs topic hint: `limits check usage limits for customer and product`.

### Record Usage

Use for metered features after successful execution.

Request shape (conceptual):

```json
{
  "customerRef": "cus_xxx",
  "productRef": "prd_xxx",
  "event": "feature_invocation"
}
```

Docs topic hint: `usage record event` and `usage bulk`.

### Cancel Renewal

Use when customer wants to stop auto-renewal. Access continues until period end.

`@solvapay/next` helper: `cancelRenewal(request, { purchaseRef, reason? })`
`@solvapay/server` core: `cancelPurchaseCore(request, { purchaseRef, reason? })`
`@solvapay/supabase` handler: `cancelRenewal` (one-liner Edge Function)

API endpoint: `POST /v1/sdk/purchases/{purchaseRef}/cancel`

Response shape:

```json
{
  "success": true,
  "purchase": { "reference": "pur_xxx", "status": "active", "cancelledAt": "..." }
}
```

### Reactivate Renewal

Use when customer wants to undo a pending cancellation. Only works while purchase is active and before period end.

`@solvapay/next` helper: `reactivateRenewal(request, { purchaseRef })`
`@solvapay/server` core: `reactivatePurchaseCore(request, { purchaseRef })`
`@solvapay/supabase` handler: `reactivateRenewal` (one-liner Edge Function)

API endpoint: `POST /v1/sdk/purchases/{purchaseRef}/reactivate`

Response shape:

```json
{
  "success": true,
  "purchase": { "reference": "pur_xxx", "status": "active", "cancelledAt": null }
}
```

Preconditions: purchase must be `active`, have `cancelledAt` set, and `endDate` not yet passed.

### Activate Plan

Use to activate a product for a customer on a specific plan without checkout. Handles free units, credit balance, and plan switching.

`@solvapay/next` helper: `activatePlan(request, { productRef, planRef })`
`@solvapay/server` core: `activatePlanCore(request, { productRef, planRef })`
`@solvapay/supabase` handler: `activatePlan` (one-liner Edge Function)

API endpoint: `POST /v1/sdk/activate`

Request shape:

```json
{
  "customerRef": "cus_xxx",
  "productRef": "prd_xxx",
  "planRef": "pln_xxx"
}
```

Response shape:

```json
{
  "status": "activated",
  "purchaseRef": "pur_xxx"
}
```

Possible `status` values: `activated`, `already_active`, `topup_required`, `payment_required`, `invalid`.

When `topup_required`: response includes `creditBalance`, `creditsPerUnit`, `currency`.
When `payment_required`: response includes `checkoutUrl`, `checkoutSessionId`.

Plan switching: if the customer already has an active purchase on a different plan for the same product, the old purchase is expired and a new one is created.

Docs topic hint: `purchase management`, `activate plan`, `plan switching`.

### Create/Process Payment Intent (Embedded Only)

Use only when hosted checkout is not acceptable for the use case.

Docs topic hint: `payment intents create` and `payment intents process`.

## Minimal Install (typical web app)

Preferred setup (SDK integration):

```bash
npx solvapay init
```

Manual fallback (when CLI setup cannot run):

```bash
npm install @solvapay/server @solvapay/next @solvapay/react @solvapay/auth @solvapay/react-supabase @supabase/supabase-js
```

Supabase Edge Functions (Deno) -- no npm install needed, use `deno.json` import map:

```json
{
  "imports": {
    "@solvapay/supabase": "npm:@solvapay/supabase",
    "@solvapay/server": "npm:@solvapay/server",
    "@solvapay/auth": "npm:@solvapay/auth",
    "@solvapay/core": "npm:@solvapay/core"
  }
}
```

## Required Environment Variables (Typical)

- `SOLVAPAY_SECRET_KEY` (server only)
- `SOLVAPAY_API_BASE_URL` (optional override)
- `SOLVAPAY_WEBHOOK_SECRET` (when webhooks enabled)
- Auth provider vars (for example Supabase keys)

## Guardrails

- Never put `SOLVAPAY_SECRET_KEY` in `NEXT_PUBLIC_*` or client bundles.
- Always map your authenticated user ID to a stable customer reference.
- Always verify webhook signatures before parsing business data.
- Always keep pricing/product configuration in SolvaPay backend, not hardcoded in UI.

## Retrieval Hints

When docs URLs change, resolve by topic using the documentation sources defined in the root [SKILL.md](../SKILL.md#documentation-sources).
