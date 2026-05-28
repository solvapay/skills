# Supabase Edge Functions Guide

Use `@solvapay/server/fetch` to deploy SolvaPay endpoints as Supabase Edge Functions with one-liner handlers. This subpath replaces the older standalone `@solvapay/supabase` / `@solvapay/fetch` packages — same handlers, same signatures, now co-located with the `*Core` helpers they wrap.

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

- Topics: `supabase edge functions`, `@solvapay/server/fetch`, `edge runtime`.
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
    "@solvapay/server": "npm:@solvapay/server",
    "@solvapay/server/": "npm:/@solvapay/server/",
    "@solvapay/auth": "npm:@solvapay/auth",
    "@solvapay/core": "npm:@solvapay/core"
  }
}
```

The `"@solvapay/server/"` trailing-slash entry is required for Deno to resolve the `/fetch` subpath.

## Handler Pattern

Every handler is two lines:

```typescript
import { checkPurchase } from '@solvapay/server/fetch'
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
| `activate-plan` | POST | `activatePlan` | Activate a free / usage-based / recurring plan |
| `list-plans` | GET | `listPlans` | List available plans |
| `track-usage` | POST | `trackUsage` | Track usage for metered billing |
| `create-checkout-session` | POST | `createCheckoutSession` | Create hosted checkout session |
| `create-customer-session` | POST | `createCustomerSession` | Create customer portal session |
| `get-merchant` | GET | `getMerchant` | Fetch merchant branding (`name`, `iconUrl`, `logoUrl`, `termsUrl`, `privacyUrl`) |
| `get-payment-method` | GET | `getPaymentMethod` | Mirrored card brand + last4 for a customer |
| `get-product` | GET | `getProduct` | Product + public plans |

All handlers are `(req: Request) => Promise<Response>` and run on any web-standards runtime (Supabase Edge, Deno, Cloudflare Workers, Bun, Next.js Edge).

## Webhook Handling

Webhooks use a factory pattern instead of a direct handler:

```typescript
import type { WebhookEvent } from '@solvapay/server'
import { solvapayWebhook } from '@solvapay/server/fetch'

Deno.serve(solvapayWebhook({
  onEvent: async (event: WebhookEvent) => {
    switch (event.type) {
      case 'purchase.created':
      case 'purchase.updated':
      case 'purchase.cancelled':
      case 'purchase.expired':
      case 'payment_intent.succeeded':
      case 'payment_intent.failed':
        break
    }
  },
}))
```

The factory handles HMAC signature verification automatically using `SOLVAPAY_WEBHOOK_SECRET` from the environment. On `payment_intent.succeeded`, SolvaPay mirrors the card brand + last4 onto the Customer — the `get-payment-method` handler reads that mirror with no Stripe round-trip.

## CORS Configuration

Default: `*` (permissive). For production, restrict origins:

```typescript
import { checkPurchase, configureCors } from '@solvapay/server/fetch'

configureCors({
  origins: ['https://myapp.com', 'http://localhost:5173'],
})

Deno.serve(checkPurchase)
```

Call `configureCors()` before any handler runs.

## Authentication Model

Every handler extracts the authenticated user from the `Authorization: Bearer <jwt>` header that the Supabase platform gateway forwards. Edge Functions run with `verify_jwt = true` by default, so the token is cryptographically validated at the gateway before the handler runs — inside the handler, the SDK decodes the payload to read `sub`, `email`, and `user_metadata.full_name` (used by `syncCustomer`).

Opt into strict mode (verify the token inside the function as well) by setting:

```bash
supabase secrets set SUPABASE_JWT_SECRET=<project jwt secret>
supabase secrets set SOLVAPAY_AUTH_STRICT=true   # optional: reject unverified tokens
```

`SOLVAPAY_JWT_SECRET` is an accepted provider-neutral alias for `SUPABASE_JWT_SECRET`. Asymmetric JWT signing keys (ES256/RS256, Supabase Auth GA 2025) are covered by the gateway-trust path and do not require this secret.

## Frontend Integration

Wire `SolvaPayProvider` to point at Edge Function URLs:

```tsx
import { supabase } from '@/integrations/supabase/client' // your existing client
import { createSupabaseAuthAdapter } from '@solvapay/react-supabase'

const SUPABASE_URL = 'https://<project-ref>.supabase.co/functions/v1'

<SolvaPayProvider
  config={{
    auth: { adapter: createSupabaseAuthAdapter({ client: supabase }) },
    api: {
      checkPurchase: `${SUPABASE_URL}/check-purchase`,
      createPayment: `${SUPABASE_URL}/create-payment-intent`,
      processPayment: `${SUPABASE_URL}/process-payment`,
      listPlans: `${SUPABASE_URL}/list-plans`,
      activatePlan: `${SUPABASE_URL}/activate-plan`,
      customerBalance: `${SUPABASE_URL}/customer-balance`,
      cancelRenewal: `${SUPABASE_URL}/cancel-renewal`,
      reactivateRenewal: `${SUPABASE_URL}/reactivate-renewal`,
      getMerchant: `${SUPABASE_URL}/get-merchant`,
      getPaymentMethod: `${SUPABASE_URL}/get-payment-method`,
      getProduct: `${SUPABASE_URL}/get-product`,
    },
  }}
>
```

Pass the host app's existing Supabase client via `{ client }` so only one `GoTrue` instance is live on the page. The legacy `{ supabaseUrl, supabaseAnonKey }` form still works (emits a one-time `console.warn`) but can miss the session when the app uses `@supabase/ssr` or a custom `auth.storageKey`.

The `sync-customer`, `create-checkout-session`, `create-customer-session`, and `solvapay-webhook` functions are server-side only and not wired through the React provider.

## Validation

- Deploy one function and curl it to verify Deno npm resolution works.
- Verify CORS preflight returns correct `Access-Control-Allow-Origin`.
- Test `check-purchase` with a valid auth token.
- Verify webhook with a test event from SolvaPay Console.

## Troubleshooting

- **Deno npm resolution fails**: ensure `deno.json` is at `supabase/functions/deno.json` (not inside a function subdirectory) and that the trailing-slash `"@solvapay/server/"` entry is present.
- **Subpath import fails (`Cannot find module '@solvapay/server/fetch'`)**: the `"@solvapay/server/": "npm:/@solvapay/server/"` import-map entry must be present — Deno needs the trailing-slash form to resolve subpath exports.
- **CORS preflight blocked**: `configureCors()` must be called before the handler. Check that `OPTIONS` requests return 204.
- **401 on all requests**: upgrade `@solvapay/server` to at least the version documented in `Setup` — earlier versions required a Next.js-style `x-user-id` header that Edge Functions never set. The current SDK reads the Bearer JWT directly. Optionally set `SUPABASE_JWT_SECRET` (and `SOLVAPAY_AUTH_STRICT=true`) for strict-mode verification inside the function.
- **Webhook signature failures**: verify `SOLVAPAY_WEBHOOK_SECRET` is set correctly via `supabase secrets list`.
- **Missing env var**: `SOLVAPAY_SECRET_KEY` must be set via `supabase secrets set`, not in a `.env` file.

## Guardrails

- Never hardcode `SOLVAPAY_SECRET_KEY` in Edge Function source code.
- Never skip CORS configuration for production deployments.
- Always set webhook secret as a Supabase secret, not a build-time env var.

## Handoff Output

When this domain completes, provide:

- Supabase project ref and function URLs
- Which of the 16 handlers + webhook are deployed
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
