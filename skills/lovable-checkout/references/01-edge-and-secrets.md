# Lovable Checkout — Edge Functions and Secrets

## Contents

- When to use
- Guardrails
- Architecture
- Prerequisites
- Step 1 — Install packages
- Step 2 — Create edge functions
- Step 3 — Secrets and deploy

Preview-only: `@preview` tag and `api-dev.solvapay.com`. Not for production.

## When to use

All three must be true:

- Lovable app (Vite + React + TypeScript + shadcn/ui + Supabase).
- Hosted checkout at `/checkout` route (not embedded iframe / Stripe Link redirect).
- OK with sandbox and api-dev during preview.

For Next.js production checkout → `solvapay/website-checkout`. For MCP App UI → `solvapay/sdk-integration` or `solvapay/create-mcp-app`.

## Guardrails

- **Never** put `SOLVAPAY_SECRET_KEY` in `.env`, `VITE_*`, or browser-reachable files — Supabase edge secrets only.
- **Never** browser `fetch` to SolvaPay API — edge functions only.
- **Always** install `@solvapay/react@preview`, `@solvapay/react-supabase@preview` — never pin exact preview versions.
- **Always** set `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` as edge secret.
- **Always** use `createSupabaseAuthAdapter` from `@solvapay/react-supabase`.
- **Always** pass absolute Supabase function URLs in `SolvaPayProvider.config.api.*`.

## Architecture

Browser → `SolvaPayProvider` → Supabase Edge Function → `@solvapay/server/fetch` → api-dev.

## Prerequisites

- SolvaPay sandbox product + plan; `sk_sandbox_...`; product ref `prd_...`; product **name** for `PurchaseGate`.
- Supabase CLI or dashboard; Lovable-scaffolded `VITE_SUPABASE_*` in `.env`.

## Step 1 — Install preview packages

```bash
npm install @solvapay/react@preview @solvapay/react-supabase@preview
```

Replace any pinned preview version with `"preview"` and reinstall.

## Step 2 — Create edge functions

```bash
supabase functions new list-plans
supabase functions new create-payment-intent
supabase functions new process-payment
supabase functions new check-purchase
```

One-liner handlers:

```ts
// supabase/functions/list-plans/index.ts
import { listPlans } from '@solvapay/server/fetch'
Deno.serve(listPlans)
```

(Same pattern for `createPaymentIntent`, `processPayment`, `checkPurchase`.)

`supabase/functions/deno.json`:

```json
{
  "imports": {
    "@solvapay/server": "npm:@solvapay/server@preview",
    "@solvapay/server/": "npm:/@solvapay/server@preview/",
    "@solvapay/auth": "npm:@solvapay/auth@preview",
    "@solvapay/core": "npm:@solvapay/core@preview"
  }
}
```

## Step 3 — Secrets and deploy

```bash
supabase secrets set SOLVAPAY_SECRET_KEY=sk_sandbox_...
supabase secrets set SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com
supabase functions deploy
```

Product ref comes from browser (`VITE_SOLVAPAY_PRODUCT_REF`), not edge secrets. Redeploy after secret changes.
