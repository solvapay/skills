# MCP App Checkout — Reference

Pasteable snippets and troubleshooting for the preview SDK
(`1.0.8-preview.1`) against the dev backend. Read this when
[SKILL.md](SKILL.md) points you here.

## Environment variables

### Companion HTTP origin (server)

| Variable | Required | Value for preview |
| --- | --- | --- |
| `SOLVAPAY_SECRET_KEY` | Yes | `sp_sandbox_...` from the dev console |
| `SOLVAPAY_API_BASE_URL` | Yes | `https://api-dev.solvapay.com` |
| `SOLVAPAY_PRODUCT_REF` | Yes | `prd_...` from the dev console |

### MCP App UI (client)

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_API_ORIGIN` / `NEXT_PUBLIC_API_ORIGIN` | Yes | Absolute URL of the companion HTTP origin. Threaded into `config.api.*` on `SolvaPayProvider`. |

Never expose `SOLVAPAY_SECRET_KEY` to the UI bundle.

## Companion route handlers

Both snippets delegate to `@solvapay/server` helpers. Don't hand-roll HTTP
against `api-dev.solvapay.com`.

### Express

```ts
import express from 'express'
import { createSolvaPay, createSolvaPayClient } from '@solvapay/server'

const apiClient = createSolvaPayClient({
  apiKey: process.env.SOLVAPAY_SECRET_KEY!,
  apiBaseUrl: process.env.SOLVAPAY_API_BASE_URL,
})
const solvaPay = createSolvaPay({ apiClient })
const productRef = process.env.SOLVAPAY_PRODUCT_REF!

const app = express()
app.use(express.json())
app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  next()
})

app.get('/api/list-plans', async (req, res) => {
  const plans = await solvaPay.listPlans({ productRef: String(req.query.productRef) })
  res.json(plans)
})

app.post('/api/create-payment-intent', async (req, res) => {
  const { planRef, customerRef } = req.body
  const result = await solvaPay.createPaymentIntent({
    productRef,
    planRef,
    customerRef,
  })
  res.json(result)
})

app.post('/api/process-payment', async (req, res) => {
  const result = await solvaPay.processPayment(req.body)
  res.json(result)
})

app.get('/api/check-purchase', async (req, res) => {
  const purchases = await solvaPay.listPurchases({
    customerRef: String(req.query.customerRef),
    productRef,
  })
  res.json({ purchases })
})
```

### Hono (Cloudflare Workers / Node)

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createSolvaPay, createSolvaPayClient } from '@solvapay/server'

const apiClient = createSolvaPayClient({
  apiKey: process.env.SOLVAPAY_SECRET_KEY!,
  apiBaseUrl: process.env.SOLVAPAY_API_BASE_URL,
})
const solvaPay = createSolvaPay({ apiClient })
const productRef = process.env.SOLVAPAY_PRODUCT_REF!

export const app = new Hono()
app.use('/api/*', cors())

app.get('/api/list-plans', async c => {
  const plans = await solvaPay.listPlans({ productRef: c.req.query('productRef')! })
  return c.json(plans)
})

app.post('/api/create-payment-intent', async c => {
  const body = await c.req.json()
  const result = await solvaPay.createPaymentIntent({ productRef, ...body })
  return c.json(result)
})

app.post('/api/process-payment', async c => {
  const result = await solvaPay.processPayment(await c.req.json())
  return c.json(result)
})

app.get('/api/check-purchase', async c => {
  const purchases = await solvaPay.listPurchases({
    customerRef: c.req.query('customerRef')!,
    productRef,
  })
  return c.json({ purchases })
})
```

### Colocate with the MCP server

The simplest shape for the preview: the same HTTP server serves both `/mcp`
(MCP transport) and `/api/*` (SolvaPay companion routes). Single origin,
single deploy, CORS simplified. See
[`solvapay-sdk/examples/mcp-oauth-bridge`](https://github.com/solvapay/solvapay-sdk/tree/main/examples/mcp-oauth-bridge)
for a working Hono-based MCP server to bolt the routes onto.

## Bundler tips (MCP App UI)

MCP Apps ship as a single HTML file via `vite-plugin-singlefile`. Two things
to know about the SDK:

- `@solvapay/react` tree-shakes cleanly — importing `CheckoutLayout`
  pulls ~90 kB gzipped (Stripe Elements included). If you don't need
  activation flows, import from `@solvapay/react/primitives` and compose
  only what you use.
- `@solvapay/react/styles.css` inlines fine under `vite-plugin-singlefile`.
  Import it once in the entry module. It uses CSS custom properties
  (`--solvapay-accent`, `--solvapay-radius`, `--solvapay-surface`,
  `--solvapay-muted`, `--solvapay-font`) — override in a local `<style>` to
  match the host theme.
- Stripe.js loads at runtime from `https://js.stripe.com`. Do not try to
  pre-bundle it. The host CSP must allow `https://js.stripe.com` and
  `https://*.stripe.com` under `frame-src` / `script-src`.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `GET /api/list-plans` 404 on iframe load | `SolvaPayProvider` left on default relative paths | Set all four `config.api.*` to absolute URLs |
| `/api/create-payment-intent` returns 402 with no checkout URL | `SOLVAPAY_API_BASE_URL` missing on server; hitting prod with sandbox key | Set `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` and restart |
| "Missing provider" error at render | `CheckoutLayout` mounted outside `SolvaPayProvider` | Wrap the App root, not an inner component |
| Stripe Payment Element renders blank | Host CSP or Permissions-Policy blocks Stripe | Verify `payment=(self "https://*.stripe.com")` and `frame-src https://*.stripe.com` are set by the host |
| `useApp()` returns `undefined` throughout | Tool was registered without `_meta.ui.resourceUri` linking to the resource, or host is pre-Apps-SDK | Check the tool registration and host version |
| `onResult` never fires after successful test card | `returnUrl` set in `CheckoutLayoutProps` pointing outside the iframe | Leave `returnUrl` unset for preview; `CheckoutLayout` handles confirmation in-iframe by default |
| 401 from every companion route | Customer ref mismatch between UI and server | UI passes `customerRef` to `SolvaPayProvider`; server uses the same ref in `ensureCustomer({ externalRef })` |
| CORS preflight fails | Companion origin not returning `Access-Control-Allow-Origin` for the host iframe | During preview respond `*`; for stable, mirror the host-provided origin |

## Version bump note

If PR 9 surfaces regressions and we cut `1.0.8-preview.2`:

- Exact pins (`@solvapay/react@1.0.8-preview.1`) will **not** auto-upgrade.
  Either re-pin explicitly or swap to the floating `@preview` tag for the
  remainder of the trial.
- `npm update` with an exact pin is a no-op.
- Lockfile must be regenerated after re-pinning — `npm install` once with
  the new pin, commit `package-lock.json`.

## Links

- Primitives cheat-sheet: [`packages/react/README.md`](https://github.com/solvapay/solvapay-sdk/blob/main/packages/react/README.md)
  in the SDK repo.
- MCP server paywall pattern (for the OAuth-bridge auth option):
  [`../solvapay/sdk-integration/mcp-server/guide.md`](../solvapay/sdk-integration/mcp-server/guide.md).
- MCP Apps SDK scaffolding: the separate `create-mcp-app` skill.
- Stable SolvaPay skill for post-preview handoff: [`../solvapay/`](../solvapay/).
