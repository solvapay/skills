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
- `@solvapay/server/fetch`: fetch-native one-liner handlers for Edge / Deno / Cloudflare / Supabase Edge Functions (replaces the old `@solvapay/supabase` and `@solvapay/fetch` packages)
- `@solvapay/next`: Next.js route-wrapper helpers — every wrapper now returns `Promise<NextResponse>` (breaking change vs. SDK 1.0)
- `@solvapay/mcp`: MCP server adapter (`createSolvaPayMcpServer`, `payable.mcp()`); `@solvapay/mcp/fetch` and `@solvapay/mcp/express` subpaths provide runtime-specific OAuth bridges (replaces the old `@solvapay/mcp-sdk`, `@solvapay/mcp-fetch`, `@solvapay/mcp-express`)
- `@solvapay/react`: UI provider, hooks, checkout, and account components (`SolvaPayProvider`, `PaymentForm`, `PurchaseGate`, `CurrentPlanCard`, `LaunchCustomerPortalButton`, `usePurchase`, `usePaymentMethod`, …). Use `config.transport` on the provider — the per-method transport props were removed in SDK 1.1.
- `@solvapay/react/mcp`: `McpApp`, `createMcpAppAdapter` for running `@solvapay/react` inside MCP host iframes
- `@solvapay/react-supabase`: Supabase auth adapter for `@solvapay/react`
- `@solvapay/auth`: auth utilities and adapters

## Common Operations

- Create checkout session
- Create customer session (portal)
- Ensure/sync customer (create-or-link on email collision if `externalRef` supplied)
- Update customer (`PATCH /v1/sdk/customers/:reference`)
- Fetch merchant identity (`GET /v1/sdk/merchant`) for checkout / mandate copy
- Fetch platform config (`GET /v1/sdk/platform-config`) for Stripe publishable key bootstrap
- Fetch mirrored payment method (`GET /v1/sdk/payment-method?customerRef`) for account UI
- Fetch product + public plans (`GET /v1/sdk/products/:productRef`)
- Check subscription/purchase access
- Record usage events
- Verify webhooks
- Bootstrap MCP product
- Configure MCP plans
- Cancel renewal
- Reactivate renewal
- Activate plan (including plan switching and eager PAYG activation)

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
`@solvapay/server/fetch` handler: `cancelRenewal` (one-liner Deno/Edge function)

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
`@solvapay/server/fetch` handler: `reactivateRenewal` (one-liner Deno/Edge function)

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
`@solvapay/server/fetch` handler: `activatePlan` (one-liner Deno/Edge function)

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

Activation policy by plan type:

- **Free**: always `activated`.
- **Usage-based (PAYG)**: `activated` eagerly at zero balance. Top-up via `create_topup_payment_intent` is a separate, optional step and does not block activation.
- **Recurring / hybrid**: returns `topup_required` (has credits but no card) or `payment_required` (no credits and no card). Response includes `creditBalance` / `creditsPerUnit` / `currency` or `checkoutUrl` / `checkoutSessionId` respectively.

Plan switching: if the customer already has an active purchase on a different plan for the same product, the old purchase is expired and a new one is created.

Docs topic hint: `purchase management`, `activate plan`, `plan switching`.

### Update Customer

Use to backfill or change customer fields.

API endpoint: `PATCH /v1/sdk/customers/:reference`

Request shape (all fields optional, only supplied fields are modified):

```json
{
  "externalRef": "auth_user_12345",
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

Note: on `POST /v1/sdk/customers`, an existing customer with the same `email` and no `externalRef` conflict is now **linked** (the supplied `externalRef` is saved onto the existing customer) instead of returning `409 Conflict`. This lets you idempotently adopt pre-existing SolvaPay customers when wiring up your own auth layer.

Docs topic hint: `customer update`, `create or link customer`.

### Fetch Merchant Identity

Use to render merchant branding in checkout, mandate copy, and MCP host chrome.

API endpoint: `GET /v1/sdk/merchant`
`@solvapay/next` helper: `getMerchant(request)`
`@solvapay/server/fetch` handler: `getMerchant` (one-liner Deno/Edge function)

Response includes `name`, `legalName`, `supportContact`, `termsUrl`, `privacyUrl`, `iconUrl` (square app icon — preferred for MCP host chrome and avatar slots), and `logoUrl` (absolute landscape wordmark resolved against `ASSETS_BASE_URL`).

Docs topic hint: `merchant identity`.

### Fetch Platform Config

Use to bootstrap the Stripe.js client with the right publishable key for the current environment.

API endpoint: `GET /v1/sdk/platform-config`
`@solvapay/server/fetch` handler: (use the core helpers directly or call via `fetch`)

Response includes the browser-safe platform Stripe publishable key (sandbox vs. live is resolved against the caller's secret key). Call once on page load before mounting `<PaymentForm>`.

Docs topic hint: `platform config`, `stripe publishable key`.

### Fetch Payment Method

Use to render the mirrored card in account UI. No Stripe round-trip — reads from the Customer record updated by the `payment_intent.succeeded` webhook.

API endpoint: `GET /v1/sdk/payment-method?customerRef={customerRef}`
`@solvapay/next` helper: `getPaymentMethod(request)`
`@solvapay/server/fetch` handler: `getPaymentMethod`
`@solvapay/react` hook: `usePaymentMethod()`

Response shape:

```json
{ "kind": "card", "brand": "visa", "last4": "4242", "expMonth": 12, "expYear": 2030 }
```

or

```json
{ "kind": "none" }
```

Safe to poll alongside `check_purchase`.

Docs topic hint: `payment method preview`, `card mirror`.

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
    "@solvapay/server": "npm:@solvapay/server",
    "@solvapay/server/": "npm:/@solvapay/server/",
    "@solvapay/auth": "npm:@solvapay/auth",
    "@solvapay/core": "npm:@solvapay/core"
  }
}
```

The trailing-slash `"@solvapay/server/"` entry is what unlocks subpath imports (`@solvapay/server/fetch`) in Deno.

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
