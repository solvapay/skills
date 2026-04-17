---
name: mcp-app-checkout
description: >
  Embed a SolvaPay checkout inside an MCP App UI using the preview SDK release
  (`@solvapay/react@1.0.8-preview.1`) running against the SolvaPay dev backend
  (`https://api-dev.solvapay.com`). Use this skill when the user mentions
  "MCP App checkout", "preview SDK", "iframe checkout", "Claude Desktop checkout",
  "1.0.8-preview", "checkout inside MCP Apps SDK", or anything that pairs the
  MCP Apps SDK (tool + HTML resource) with SolvaPay payments. This skill is
  preview-only; once `1.0.8` stable ships, fall back to the `solvapay` skill.
---

# MCP App Checkout (preview)

Ad hoc guide for integrating the **preview** SolvaPay React SDK into an MCP App
(interactive UI served by an MCP server via `registerAppTool` + `registerAppResource`).
Pinned to `1.0.8-preview.1` and the dev backend. Not for production.

## When to use this skill

Use when all three are true:

- The host is an MCP App UI (iframe rendered inside Claude Desktop, ChatGPT, or
  another MCP Apps SDK host). For a plain MCP server with no UI, use
  [`solvapay/sdk-integration/mcp-server/guide.md`](../solvapay/sdk-integration/mcp-server/guide.md) instead.
- The dev team is running against `1.0.8-preview.1` (published under the npm
  `preview` dist-tag). The `latest` tag is still `1.0.7`, which lacks the
  `CheckoutLayout` primitive used here.
- The target backend is `https://api-dev.solvapay.com` with sandbox keys.

For MCP App scaffolding itself (tool + resource wiring, bundling with
`vite-plugin-singlefile`, `useApp` lifecycle), follow the separate
`create-mcp-app` skill first, then come back here for the checkout bit.

## Guardrails

- **Never** publish an app pinned to `@preview` — sandbox / dev only.
- **Never** ship `SOLVAPAY_SECRET_KEY` in the MCP App UI bundle — the HTML
  resource is visible to the host and, via view-source, to end users. The
  secret belongs on the companion HTTP origin, never in the iframe.
- **Always** pin the exact version `1.0.8-preview.1` in `package.json` for the
  trial, not the floating `@preview` tag. We may republish as `-preview.2` if
  PR 9 surfaces regressions; exact pins keep the dev team on a known build.
- **Always** point every SolvaPay call at `https://api-dev.solvapay.com`. Prod
  (`https://api.solvapay.com`) rejects sandbox keys and has no preview fixtures.
- **Never** rely on relative API paths (`/api/...`) inside the MCP App UI.
  Iframes served from `blob:` or `mcp://` origins won't resolve them — always
  configure absolute URLs on `SolvaPayProvider`.

## Architecture

```mermaid
flowchart LR
  host[MCP Host\n"Claude Desktop / ChatGPT"]
  server[MCP Server\n"tool + HTML resource"]
  ui["MCP App UI (iframe)\n@solvapay/react@preview\nCheckoutLayout"]
  api[Companion HTTP origin\n"@solvapay/server routes"]
  backend[api-dev.solvapay.com]

  host -->|tools/call| server
  server -->|resource HTML| host
  host -->|renders| ui
  ui -->|fetch absolute URLs| api
  api -->|SDK calls| backend
```

The MCP App UI cannot host API routes of its own, so the companion HTTP origin
is **required**. The simplest option is to piggyback on the same HTTP server
that serves the MCP tool/resource (add `/api/*` routes alongside `/mcp`), which
keeps a single origin and a single deploy.

## Prerequisites

- SolvaPay dev console access with a sandbox product + at least one plan.
- `sp_sandbox_...` secret key scoped to that product.
- An MCP App scaffold already building (tool + resource registered, iframe
  rendering a "hello world"). If not, scaffold it first via `create-mcp-app`.
- Node 20+ on the companion HTTP origin.

## Step 1 — Install the preview SDK

Pin exact versions in the MCP App UI package:

```bash
npm install \
  @solvapay/react@1.0.8-preview.1 \
  @solvapay/core@1.0.8-preview.1 \
  @solvapay/auth@1.0.8-preview.1
```

And on the companion HTTP origin:

```bash
npm install \
  @solvapay/server@1.0.8-preview.1 \
  @solvapay/core@1.0.8-preview.1 \
  @solvapay/auth@1.0.8-preview.1
```

`@solvapay/react@preview` works as a shortcut while iterating locally, but pin
the exact version before sharing the build with the dev team.

## Step 2 — Point the SDK at the dev backend

On the companion HTTP origin:

```
SOLVAPAY_SECRET_KEY=sp_sandbox_...
SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com
SOLVAPAY_PRODUCT_REF=prd_...
```

`SOLVAPAY_API_BASE_URL` is required — the SDK defaults to prod, which rejects
sandbox keys.

In the MCP App UI entry, import the golden-path stylesheet once (skip if the
team composes their own styles via `@solvapay/react/primitives`):

```ts
import '@solvapay/react/styles.css'
```

## Step 3 — Companion HTTP origin

The UI calls four routes through `SolvaPayProvider`. All four are thin
wrappers around `@solvapay/server` helpers — do **not** hand-roll HTTP to
`api-dev.solvapay.com`. Full Express and Hono handlers are in
[reference.md](reference.md).

Minimum route set:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/list-plans?productRef=...` | Feeds `CheckoutLayout`'s plan picker |
| `POST` | `/api/create-payment-intent` | Creates the Stripe PaymentIntent |
| `POST` | `/api/process-payment` | Finalizes purchase after Stripe confirms |
| `GET` | `/api/check-purchase?customerRef=...` | Reads current purchase state for gating |

CORS: the iframe origin is set by the host and is opaque from the server's
perspective. Allow the host's iframe origin (Claude Desktop uses an
`mcp-app://` scheme; ChatGPT serves from a CDN) or respond with
`Access-Control-Allow-Origin: *` for the preview phase. Never do `*` in prod.

## Step 4 — Embed `<CheckoutLayout>` in the UI

The `CheckoutLayout` primitive is the drop-in: plan picker → payment →
activation, ~20 lines.

```tsx
import { SolvaPayProvider, CheckoutLayout } from '@solvapay/react'
import '@solvapay/react/styles.css'
import { useApp } from '@modelcontextprotocol/ext-apps/react'

const API_ORIGIN = 'https://your-mcp-server.example.com'

export function App() {
  const { toolInput, hostContext } = useApp()
  const customerRef = hostContext?.user?.id ?? 'anonymous'
  const productRef = toolInput?.productRef as string | undefined

  return (
    <SolvaPayProvider
      customerRef={customerRef}
      config={{
        api: {
          listPlans: `${API_ORIGIN}/api/list-plans`,
          createPayment: `${API_ORIGIN}/api/create-payment-intent`,
          processPayment: `${API_ORIGIN}/api/process-payment`,
          checkPurchase: `${API_ORIGIN}/api/check-purchase`,
        },
      }}
    >
      <CheckoutLayout
        productRef={productRef}
        prefillCustomer={{
          email: hostContext?.user?.email,
          name: hostContext?.user?.name,
        }}
        requireTermsAcceptance
        onResult={result => {
          // result.kind === 'paid' | 'activated'
          // Call updateModelContext / sendMessage to hand control back to the LLM.
        }}
      />
    </SolvaPayProvider>
  )
}
```

All four `config.api.*` overrides must be absolute URLs. Leaving any as a
default relative path will break inside the iframe.

## Step 5 — Customer identity

Two supported shapes:

1. **Host-provided**: `useApp().hostContext.user.id` — simplest, works in
   Claude Desktop and any host that forwards user identity. Pass the id as
   `customerRef` to `SolvaPayProvider`. On the companion origin, use
   `@solvapay/server`'s `ensureCustomer({ externalRef: req.body.customerRef })`
   to upsert.
2. **OAuth bridge** (when the host also terminates OAuth against SolvaPay):
   inject `_auth.customer_ref` in the MCP HTTP layer as described in
   [`solvapay/sdk-integration/mcp-server/guide.md`](../solvapay/sdk-integration/mcp-server/guide.md),
   then surface the same ref to the UI via a dedicated tool result field.
   Prefer (1) during the preview unless the team is already running the OAuth
   bridge.

## Step 6 — Stripe Elements in a nested iframe

`CheckoutLayout` mounts `@stripe/react-stripe-js` Payment Element inside the
host's iframe, so Stripe ends up in a nested iframe. Two things the host
must allow:

- `Permissions-Policy: payment=(self "https://*.stripe.com")` — otherwise the
  Payment Element silently fails to mount.
- CSP `frame-src https://*.stripe.com https://*.js.stripe.com`.

Claude Desktop's current host bridge permits both by default. For custom
hosts, confirm these before filing a bug against the SDK.

## Sandbox verification

1. Open the MCP App in the host, trigger the tool, confirm the UI mounts.
2. Plan list renders (`/api/list-plans` returns at least one plan).
3. Select a plan, enter test card `4242 4242 4242 4242`, any future expiry, any CVC.
4. `onResult({ kind: 'paid' })` fires.
5. Confirm the purchase shows in the SolvaPay dev console under the right
   product/customer.
6. Failure path: repeat with `4000 0000 0000 0002`, confirm the UI surfaces
   the decline without crashing.

## What's NOT in this preview

- **Visual regression baselines** — land in PR 9 after smoke test. Expect
  minor visual churn on `1.0.8-preview.2` if we have to publish a fix.
- **Hosted shadcn registry** — `shadcn add` from `solvapay.com/r/*` is not
  wired yet. For now, compose primitives directly or use `CheckoutLayout`
  as the drop-in.
- **Mintlify docs for primitives** — the full primitives cheat-sheet lives
  in [`packages/react/README.md`](https://github.com/solvapay/solvapay-sdk/blob/main/packages/react/README.md)
  in the SDK repo. Point the dev team there for anything beyond
  `CheckoutLayout`.
- **Stable npm tag** — `@latest` stays on `1.0.7`. Anyone installing without
  a tag gets the old API and will not find `CheckoutLayout`.
- **Production backend support** — the preview is wired to
  `api-dev.solvapay.com`; prod promotion follows the stable `1.0.8` cut.

## Handoff

When the preview window closes and `1.0.8` promotes to `@latest`:

1. Bump dependencies to `@solvapay/react@1.0.8` (drop the `-preview.1` suffix).
2. Switch `SOLVAPAY_API_BASE_URL` to `https://api.solvapay.com` and rotate to
   prod keys.
3. Retire this skill in favour of [`solvapay/`](../solvapay/), which will
   carry the same content under its stable intent matrix.

See [reference.md](reference.md) for pasteable companion route handlers, env
var table, bundler tips, and troubleshooting.
