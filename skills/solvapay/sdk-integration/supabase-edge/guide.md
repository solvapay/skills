# Supabase Edge Functions Guide

Use `@solvapay/supabase` to deploy SolvaPay endpoints as Supabase Edge Functions with one-liner handlers.

## When To Use

- Project uses Supabase as backend (React/Vite + Supabase, Lovable, Bolt)
- `supabase/functions/` directory exists or will be created
- No Node.js backend (Next.js, Express) is available for API routes
- Deno/Edge runtime is the deployment target

If the project already has a Next.js backend, prefer [nextjs/guide.md](../nextjs/guide.md) instead.

## Prerequisites

- Supabase CLI installed
- `SOLVAPAY_SECRET_KEY` set as a Supabase secret
- `SOLVAPAY_WEBHOOK_SECRET` set as a Supabase secret (if using webhooks)
- Product and plan references from SolvaPay Console

## Docs References (Topic-Based)

- Topics: `supabase edge functions`, `@solvapay/supabase`, `edge runtime`.
- Retrieval hint: resolve guide topic first; pull API operation topics only when needed.

## Setup

1. Set secrets:

```bash
supabase secrets set SOLVAPAY_SECRET_KEY=sk_sandbox_...
supabase secrets set SOLVAPAY_WEBHOOK_SECRET=whsec_...
```

2. Create `supabase/functions/deno.json` import map:

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

## Handler Pattern

Every handler is two lines:

```typescript
import { checkPurchase } from '@solvapay/supabase'
Deno.serve(checkPurchase)
```

## Available Handlers

| Function | Method | Handler | Description |
| --- | --- | --- | --- |
| `check-purchase` | GET | `checkPurchase` | Check user's purchase status |
| `sync-customer` | POST | `syncCustomer` | Sync/create customer in SolvaPay |
| `create-payment-intent` | POST | `createPaymentIntent` | Create payment intent for a plan |
| `process-payment` | POST | `processPayment` | Process confirmed payment |
| `create-topup-payment-intent` | POST | `createTopupPaymentIntent` | Create credit top-up intent |
| `customer-balance` | GET | `customerBalance` | Get customer credit balance |
| `cancel-renewal` | POST | `cancelRenewal` | Cancel subscription renewal |
| `reactivate-renewal` | POST | `reactivateRenewal` | Reactivate cancelled subscription |
| `activate-plan` | POST | `activatePlan` | Activate a free/usage plan |
| `list-plans` | GET | `listPlans` | List available plans |
| `track-usage` | POST | `trackUsage` | Track usage for metered billing |
| `create-checkout-session` | POST | `createCheckoutSession` | Create hosted checkout session |
| `create-customer-session` | POST | `createCustomerSession` | Create customer portal session |

## Webhook Handling

Webhooks use a factory pattern instead of a direct handler:

```typescript
import { solvapayWebhook } from '@solvapay/supabase'

Deno.serve(solvapayWebhook({
  onEvent: async event => {
    switch (event.type) {
      case 'purchase.created':
      case 'purchase.updated':
      case 'purchase.cancelled':
      case 'purchase.expired':
      case 'payment.succeeded':
      case 'payment.failed':
        break
    }
  },
}))
```

The factory handles HMAC signature verification automatically using `SOLVAPAY_WEBHOOK_SECRET` from the environment.

## CORS Configuration

Default: `*` (permissive). For production, restrict origins:

```typescript
import { checkPurchase, configureCors } from '@solvapay/supabase'

configureCors({
  origins: ['https://myapp.com', 'http://localhost:5173'],
})

Deno.serve(checkPurchase)
```

Call `configureCors()` before any handler runs.

## Frontend Integration

Wire `SolvaPayProvider` to point at Edge Function URLs:

```tsx
const SUPABASE_URL = 'https://<project-ref>.supabase.co/functions/v1'

<SolvaPayProvider
  config={{
    auth: { adapter: createSupabaseAuthAdapter(supabase) },
    api: {
      checkPurchase: `${SUPABASE_URL}/check-purchase`,
      createPayment: `${SUPABASE_URL}/create-payment-intent`,
      processPayment: `${SUPABASE_URL}/process-payment`,
      listPlans: `${SUPABASE_URL}/list-plans`,
      activatePlan: `${SUPABASE_URL}/activate-plan`,
      customerBalance: `${SUPABASE_URL}/customer-balance`,
      cancelRenewal: `${SUPABASE_URL}/cancel-renewal`,
      reactivateRenewal: `${SUPABASE_URL}/reactivate-renewal`,
    },
  }}
>
```

The `sync-customer`, `create-checkout-session`, `create-customer-session`, and `solvapay-webhook` functions are server-side only and not wired through the React provider.

## Validation

- Deploy one function and curl it to verify Deno npm resolution works.
- Verify CORS preflight returns correct `Access-Control-Allow-Origin`.
- Test `check-purchase` with a valid auth token.
- Verify webhook with a test event from SolvaPay Console.

## Troubleshooting

- **Deno npm resolution fails**: ensure `deno.json` is at `supabase/functions/deno.json` (not inside a function subdirectory).
- **CORS preflight blocked**: `configureCors()` must be called before the handler. Check that `OPTIONS` requests return 204.
- **401 on all requests**: auth token not being forwarded. Supabase Edge Functions receive the `Authorization` header automatically for authenticated requests.
- **Webhook signature failures**: verify `SOLVAPAY_WEBHOOK_SECRET` is set correctly via `supabase secrets list`.
- **Missing env var**: `SOLVAPAY_SECRET_KEY` must be set via `supabase secrets set`, not in a `.env` file.

## Guardrails

- Never hardcode `SOLVAPAY_SECRET_KEY` in Edge Function source code.
- Never skip CORS configuration for production deployments.
- Always set webhook secret as a Supabase secret, not a build-time env var.

## Handoff Output

When this domain completes, provide:

- Supabase project ref and function URLs
- Which of the 13 handlers + webhook are deployed
- Frontend `SolvaPayProvider` config with custom API routes
- Verified test outcomes (happy path and failure path)

## Task Progress

- [ ] Create `deno.json` import map
- [ ] Set secrets via `supabase secrets set`
- [ ] Create handler Edge Functions
- [ ] Add webhook function if needed
- [ ] Configure CORS for production
- [ ] Wire frontend `SolvaPayProvider`
- [ ] Deploy and test in sandbox
