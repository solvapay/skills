# SDK Reference

## Purpose

Use this file for concrete operation patterns and minimal payload shapes.

## Package Map

- `@solvapay/server`: server SDK, paywall handlers, webhook verification
- `@solvapay/next`: Next.js helpers for checkout/customer/subscription routes
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

## Operation Templates

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

### Check Limits

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

### Create/Process Payment Intent (Embedded Only)

Use only when hosted checkout is not acceptable for the use case.

Docs topic hint: `payment intents create` and `payment intents process`.

## Minimal Install (typical web app)

```bash
npm install @solvapay/server@preview @solvapay/next@preview @solvapay/react@preview @solvapay/auth@preview @solvapay/react-supabase@preview @supabase/supabase-js
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
- Always keep pricing/product configuration in Solvapay backend, not hardcoded in UI.

## Retrieval Hints (Structure-Resilient)

When docs URLs change, resolve by topic via:

1. SolvaPay Docs MCP search by topic
2. `llms.txt` index lookup
3. Direct docs fetch
