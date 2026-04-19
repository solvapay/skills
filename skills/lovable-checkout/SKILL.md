---
name: lovable-checkout
description: >
  Add a SolvaPay hosted checkout to a Lovable project (Vite + React + TypeScript
  + shadcn/ui + Supabase) using the preview SDK (`@solvapay/react@preview`) and
  Supabase Edge Functions as the backend. Use this skill when the user mentions
  "Lovable", "Vite checkout", "shadcn checkout", "Supabase Edge checkout",
  "SolvaPay in Lovable", "paste this into Lovable", or "SolvaPay preview Lovable".
  Paste this entire file into the Lovable chat to bias the agent toward a working
  integration on the first turn. Preview-only against `api-dev.solvapay.com`;
  retires once `1.0.8` stable ships.
---

# Lovable Checkout (preview)

Self-contained guide for wiring SolvaPay hosted checkout into a Lovable-generated
app. Assumes the Lovable default stack: Vite 5, React 18, TypeScript, Tailwind v3,
shadcn/ui, Supabase. The backend is Supabase Edge Functions — there is no Node
server to add. Pinned to the floating `@preview` tag and the dev backend
(`https://api-dev.solvapay.com`). Not for production.

## When to use this skill

Use when all three are true:

- The project is a Lovable app (Vite + React + TypeScript + shadcn/ui + Supabase).
- The goal is a hosted-style checkout UI at a `/checkout` route, not an
  embedded-iframe or Stripe-Link redirect flow.
- OK running against SolvaPay sandbox and `api-dev.solvapay.com` during the
  preview window.

For a Next.js App Router checkout, use the `solvapay` skill with
`sdk-integration/react/guide.md`. For an MCP App UI (iframe inside Claude Desktop
or ChatGPT), use `mcp-app-checkout` instead — the auth/iframe wiring is different.

## Guardrails

Explicit Never / Always for the Lovable agent to internalise before writing code:

- **Never** put `SOLVAPAY_SECRET_KEY` in `.env`, `VITE_*`, `import.meta.env`, or
  any file the browser can reach. The secret lives **only** as a Supabase edge
  function secret (`supabase secrets set`).
- **Never** hand-roll `fetch` against `https://api-dev.solvapay.com` from the
  browser. All SolvaPay backend calls go through Supabase edge functions.
- **Always** install with the `@preview` tag:
  `@solvapay/react@preview`, `@solvapay/react-supabase@preview`. Never pin an
  exact preview version — the floating tag tracks the current build and is
  what every snippet in this skill targets.
- **Always** set `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` as a
  Supabase secret. Production rejects sandbox keys.
- **Always** use `createSupabaseAuthAdapter` from `@solvapay/react-supabase`.
  Do not hand-roll auth wiring — the Lovable stack already has Supabase auth.
- **Always** pass absolute Supabase function URLs via
  `SolvaPayProvider.config.api.*`. Relative paths (`/api/...`) don't resolve
  in a Vite SPA.
- **Never** publish a Lovable project pinned to `@preview` — it tracks a moving
  build. Swap to a stable tag before going live (see Handoff).

## Architecture

```mermaid
flowchart LR
  browser[Browser<br/>React Router /checkout]
  provider[SolvaPayProvider<br/>CheckoutLayout<br/>SupabaseAuthAdapter]
  fn[Supabase Edge Function<br/>Deno.serve handler]
  api[api-dev.solvapay.com]

  browser --> provider
  provider -->|absolute URL| fn
  fn -->|@solvapay/supabase| api
```

No custom Node server. Each SolvaPay API route is a one-line Deno handler from
`@solvapay/supabase` that re-exports the matching `@solvapay/server` route.

## Prerequisites

- SolvaPay dev console access with a sandbox product and at least one plan.
- A sandbox secret key: `sk_sandbox_...`.
- The product ref: `prd_...`.
- The product **name** exactly as it appears in the SolvaPay Console (needed by `PurchaseGate` — see Step 6).
- Supabase CLI installed locally (`npm install -g supabase`) **or** willingness
  to create functions through the Supabase dashboard.
- A Supabase project already wired into the Lovable app (Lovable scaffolds this
  by default — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist in
  `.env`).

## Step 1 — Install the preview packages

```bash
npm install @solvapay/react@preview @solvapay/react-supabase@preview
```

If `package.json` already has either package pinned to an exact preview version,
replace both version strings with `"preview"` and run `npm install` again so
the next build tracks the current preview tag.

## Step 2 — Create the Supabase edge functions

SolvaPay ships `@solvapay/supabase`, a tiny wrapper that exports ready-to-serve
Deno handlers. Each function is a single line.

Run once per function from the project root:

```bash
supabase functions new list-plans
supabase functions new create-payment-intent
supabase functions new process-payment
supabase functions new check-purchase
```

Then replace each `index.ts` with the matching one-liner:

```ts
// supabase/functions/list-plans/index.ts
import { listPlans } from '@solvapay/supabase'
Deno.serve(listPlans)
```

```ts
// supabase/functions/create-payment-intent/index.ts
import { createPaymentIntent } from '@solvapay/supabase'
Deno.serve(createPaymentIntent)
```

```ts
// supabase/functions/process-payment/index.ts
import { processPayment } from '@solvapay/supabase'
Deno.serve(processPayment)
```

```ts
// supabase/functions/check-purchase/index.ts
import { checkPurchase } from '@solvapay/supabase'
Deno.serve(checkPurchase)
```

Finally, create `supabase/functions/deno.json` with the preview import map:

```json
{
  "imports": {
    "@solvapay/supabase": "npm:@solvapay/supabase@preview",
    "@solvapay/server": "npm:@solvapay/server@preview",
    "@solvapay/auth": "npm:@solvapay/auth@preview",
    "@solvapay/core": "npm:@solvapay/core@preview"
  }
}
```

## Step 3 — Set Supabase secrets and deploy

```bash
supabase secrets set SOLVAPAY_SECRET_KEY=sk_sandbox_...
supabase secrets set SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com
supabase functions deploy
```

The product ref is sent by the browser (via `VITE_SOLVAPAY_PRODUCT_REF` → query
string), not read from a Supabase secret — the edge functions don't need it.

Redeploy after changing any secret — secrets are baked into the function
runtime at deploy time.

## Step 4 — Wire `SolvaPayProvider` in `src/main.tsx`

Mount the provider **around** `RouterProvider` so the checkout route inherits
auth and API config. Edit `src/main.tsx` (or wherever Lovable mounts React
Router):

```tsx
import { SolvaPayProvider } from '@solvapay/react'
import { createSupabaseAuthAdapter } from '@solvapay/react-supabase'
import { supabase } from '@/integrations/supabase/client' // the singleton Lovable scaffolds
import '@solvapay/react/styles.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const FN = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`

const adapter = createSupabaseAuthAdapter({ client: supabase })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SolvaPayProvider
    config={{
      auth: { adapter },
      api: {
        listPlans: FN('list-plans'),
        createPayment: FN('create-payment-intent'),
        processPayment: FN('process-payment'),
        checkPurchase: FN('check-purchase'),
      },
    }}
  >
    <RouterProvider router={router} />
  </SolvaPayProvider>,
)
```

Pass the **existing** Supabase client (the one Lovable created in
`src/integrations/supabase/client.ts`, or wherever your app calls
`createClient`). Spawning a second client via the URL/key form works in most
setups but silently drops the session when the app uses `@supabase/ssr`, a
custom `auth.storageKey`, `persistSession: false`, or iframe-isolated
storage — the second `GoTrue` instance then has no session to read.

Two things that break silently if you skip them:

- All four `config.api.*` entries must be **absolute** URLs. Relative paths
  won't resolve in a Vite SPA.
- `import '@solvapay/react/styles.css'` **must come after** Tailwind's entry
  (typically `import './index.css'` that contains `@tailwind utilities`). If
  Tailwind loads last, its preflight will flatten primitive buttons and
  inputs. Swap the order and the issue disappears.

<details>
<summary>Legacy: URL/key form (deprecated)</summary>

If the app genuinely has no Supabase client to reuse, the adapter can still
create its own:

```tsx
const adapter = createSupabaseAuthAdapter({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
})
```

This logs a one-time `console.warn`. Prefer the `{ client }` form in any new
project — it removes the "Multiple GoTrueClient" class of bugs entirely.

</details>

## Step 5 — The `/checkout` route

Create `src/routes/Checkout.tsx`:

```tsx
import { CheckoutLayout } from '@solvapay/react'
import { useNavigate } from 'react-router-dom'

export function CheckoutPage() {
  const navigate = useNavigate()
  return (
    <CheckoutLayout
      productRef={import.meta.env.VITE_SOLVAPAY_PRODUCT_REF as string}
      requireTermsAcceptance
      onResult={result => {
        if (result.kind === 'paid' || result.kind === 'activated') {
          navigate('/dashboard')
        }
      }}
    />
  )
}
```

Register it in the router (add to the existing `createBrowserRouter` array):

```tsx
{ path: '/checkout', element: <CheckoutPage /> }
```

`CheckoutLayout` renders plan picker → payment form → confirmation as a single
component. It reads `productRef` to fetch plans via `/list-plans` and uses the
Supabase session from `createSupabaseAuthAdapter` to identify the customer — no
extra props needed.

## Step 6 — Gate protected routes with `<PurchaseGate>`

`PurchaseGate` is a slot-based compound — you render one branch per state
(`Loading`, `Allowed`, `Blocked`, `Error`) inside `PurchaseGate.Root`. Wrap any
route that requires a paid plan:

```tsx
import { PurchaseGate } from '@solvapay/react'
import { Navigate } from 'react-router-dom'

const PRODUCT_NAME = 'Widget API' // exact name from SolvaPay Console

export function DashboardPage() {
  return (
    <PurchaseGate.Root requireProduct={PRODUCT_NAME}>
      <PurchaseGate.Loading>
        <div>Loading…</div>
      </PurchaseGate.Loading>
      <PurchaseGate.Allowed asChild>
        <Dashboard />
      </PurchaseGate.Allowed>
      <PurchaseGate.Blocked asChild>
        <Navigate to="/checkout" replace />
      </PurchaseGate.Blocked>
    </PurchaseGate.Root>
  )
}
```

Each slot is a `div` by default; pass `asChild` to forward props onto the
immediate child (so `<Navigate />` mounts at the right point in the tree
without a wrapping element). `PurchaseGate.Root` hits `/check-purchase` via
the provider and renders `Allowed` when the customer has an active purchase
whose `productName` matches `requireProduct` case-insensitively. Omit
`requireProduct` to allow access as long as the customer has **any** active
purchase. For ad-hoc checks outside the gate, call `hasProduct(name)` from
`usePurchase()`:

```tsx
const { hasProduct, hasPaidPurchase } = usePurchase()
if (hasProduct(PRODUCT_NAME)) { /* ... */ }
```

## shadcn/ui composition (optional)

Every primitive supports Radix's `asChild` pattern so you can skin them with
shadcn components without re-implementing anything. Two imports matter:

- **`@solvapay/react`** — high-level components (`CheckoutLayout`,
  `PurchaseGate`, `PaymentForm`) plus a simple convenience `PlanSelector`.
- **`@solvapay/react/primitives`** — compound slot primitives including the
  `PlanSelector.Root / .Card / .Heading / .Grid` tree. Import from here when
  you want to skin individual plan cards.

```tsx
import { PaymentForm } from '@solvapay/react'
import { PlanSelector } from '@solvapay/react/primitives'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

<PlanSelector.Root productRef={PRODUCT_REF} className="space-y-6">
  <PlanSelector.Grid className="grid gap-3">
    <PlanSelector.Card asChild>
      <Card className="data-[state=selected]:ring-2 data-[state=selected]:ring-primary p-4">
        <PlanSelector.CardName className="text-base font-medium" />
        <PlanSelector.CardPrice className="text-2xl font-bold" />
        <PlanSelector.CardInterval className="text-sm text-muted-foreground" />
      </Card>
    </PlanSelector.Card>
  </PlanSelector.Grid>
</PlanSelector.Root>

<PaymentForm.SubmitButton asChild>
  <Button className="w-full" />
</PaymentForm.SubmitButton>
```

The `data-[state=*]:` variants are core Tailwind (v3.3+ and v4) — no plugin
required. Compose primitives directly only when `CheckoutLayout` isn't flexible
enough; the layout component is the happy path.

## Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` (client) | Already set by Lovable. |
| `VITE_SUPABASE_ANON_KEY` | `.env` (client) | Already set by Lovable. |
| `VITE_SOLVAPAY_PRODUCT_REF` | `.env` (client) | `prd_...` — safe to expose. |
| `SOLVAPAY_SECRET_KEY` | Supabase secret | `sk_sandbox_...` (or `sk_live_...`). **Never** in `.env` or client code. |
| `SOLVAPAY_API_BASE_URL` | Supabase secret | `https://api-dev.solvapay.com` during preview. |

## Sandbox verification

1. `supabase functions deploy` completes cleanly (no import-map errors).
2. Run the app (`npm run dev`), sign in via the existing Supabase auth flow.
3. Navigate to `/checkout`. Plans appear in the selector.
4. Pick a plan. Stripe Payment Element mounts.
5. Use test card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
6. `onResult({ kind: 'paid' })` fires, navigation to `/dashboard` happens.
7. Verify the purchase appears in the SolvaPay dev console under the product.
8. Decline path: repeat with `4000 0000 0000 0002`, confirm the UI surfaces the
   decline and does not crash.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `CheckoutLayout` missing from `@solvapay/react` exports | Pinned to an old exact preview version | Replace the version with `"preview"` in `package.json`, `npm install` again |
| `/list-plans` returns `[]` | `VITE_SOLVAPAY_PRODUCT_REF` points at the wrong product, or no active plans exist on that product | Verify the ref matches a product in the current sandbox and that it has at least one plan |
| `PurchaseGate` always renders `Blocked` after a successful checkout | `requireProduct` doesn't match the product's display name exactly (case-insensitive match, but whitespace matters) | Copy the product **name** from SolvaPay Console and pass it verbatim |
| 402 with no checkout URL | Hitting prod with sandbox key | Set `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` as a Supabase secret, redeploy |
| CORS / 500 from `/functions/v1/*` | Secrets changed but functions not redeployed | Rerun `supabase functions deploy` (CORS is permissive by default in the wrappers) |
| Primitive buttons and inputs look unstyled, padding flattened | Tailwind entry imported after `@solvapay/react/styles.css` | Move `import '@solvapay/react/styles.css'` to come **after** `import './index.css'` |
| `useApp is not exported` / `@modelcontextprotocol/ext-apps` errors | Wrong skill — that's the MCP App one | Use `mcp-app-checkout` for MCP App UIs; this skill is web-only |
| Deno resolves wrong versions on deploy | Missing or stale `supabase/functions/deno.json` import map | Recreate `deno.json` per Step 2, redeploy |

## Handoff — going stable

When `1.0.8` (or the next stable minor) promotes to `@latest`:

1. Replace `"preview"` with the stable version in `package.json`
   (e.g. `"@solvapay/react": "^1.0.8"`), run `npm install`.
2. Rewrite `supabase/functions/deno.json` to drop `@preview`:
   `"npm:@solvapay/supabase"`, etc.
3. Rotate the Supabase secret `SOLVAPAY_API_BASE_URL` to
   `https://api.solvapay.com`.
4. Rotate `SOLVAPAY_SECRET_KEY` to a `sk_live_...` prod key.
5. Retire this skill in favour of `solvapay/sdk-integration/react/guide.md`
   once the Supabase Edge content lands on the stable skill.
