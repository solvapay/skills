# Lovable Checkout — Reference

Secondary file for developers browsing the skill on GitHub. The primary
delivery channel is pasting [SKILL.md](SKILL.md) into the Lovable chat; this
reference covers the bits that would bloat `SKILL.md` without helping a
paste-in agent turn zero.

## Canonical reference project

[`solvapay-sdk/examples/spa-checkout`](https://github.com/solvapay/solvapay-sdk/tree/main/examples/spa-checkout)
is this exact stack (Vite + React + TypeScript + Tailwind v3 + shadcn/ui +
Supabase + React Router) wired end-to-end against the preview SDK. Every
snippet in `SKILL.md` is lifted from there.

The only difference from a Lovable app is dependency resolution: the example
uses `workspace:*` so it tracks the local SDK build. In a Lovable project,
those become `"preview"` (the floating npm tag) — everything else is
identical.

To run the reference locally:

```bash
git clone https://github.com/solvapay/solvapay-sdk
cd solvapay-sdk/examples/spa-checkout
# follow the README there
```

Use it to sanity-check any snippet before shipping. If the reference works and
your Lovable project doesn't, the diff is almost always in Step 4
(`SolvaPayProvider` config) or Step 2 (`supabase/functions/deno.json`).

## Extended edge function catalogue

`SKILL.md` lists the four edge functions required by `CheckoutLayout` and
`PurchaseGate`. `@solvapay/supabase` exports additional handlers for flows
beyond the happy path. Only add these when the corresponding UI needs them —
every extra function is one more deploy target.

| Function | Handler | Used by |
| --- | --- | --- |
| `list-plans` | `listPlans` | `CheckoutLayout`, `PlanSelector` |
| `create-payment-intent` | `createPaymentIntent` | `CheckoutLayout`, `PaymentForm` |
| `process-payment` | `processPayment` | `CheckoutLayout`, `PaymentForm` |
| `check-purchase` | `checkPurchase` | `CheckoutLayout`, `PurchaseGate` |
| `activate-plan` | `activatePlan` | Free plan activation without Stripe |
| `cancel-renewal` | `cancelRenewal` | Account / billing management UI |
| `reactivate-renewal` | `reactivateRenewal` | Account / billing management UI |
| `customer-balance` | `customerBalance` | Top-up / balance display |
| `create-topup-payment-intent` | `createTopupPaymentIntent` | Top-up flow |
| `solvapay-webhook` | `solvapayWebhook` | Receiving SolvaPay webhooks server-side |

All handlers except `solvapayWebhook` follow the same one-liner shape:

```ts
import { activatePlan } from '@solvapay/supabase'
Deno.serve(activatePlan)
```

`solvapayWebhook` is a factory — call it with the signing secret:

```ts
import { solvapayWebhook } from '@solvapay/supabase'

Deno.serve(
  solvapayWebhook({
    secret: Deno.env.get('SOLVAPAY_WEBHOOK_SECRET')!,
    onEvent: async event => {
      // handle purchase.created / updated / expired / cancelled etc.
    },
  }),
)
```

The full list lives in
[`solvapay-sdk/examples/supabase-edge/README.md`](https://github.com/solvapay/solvapay-sdk/tree/main/examples/supabase-edge).

## Extended troubleshooting

### Stripe Payment Element never mounts

Check the browser console for Stripe errors. The two common culprits in a
Vite + React 18 SPA are:

- `@stripe/stripe-js` missing from direct dependencies — `@solvapay/react`
  declares it as a peer, so `npm install @stripe/stripe-js` if it isn't
  already present.
- A Content Security Policy that blocks `https://js.stripe.com` or
  `https://*.stripe.com`. Lovable projects don't ship a CSP by default, but
  any custom `<meta http-equiv="Content-Security-Policy">` the user adds will
  need `script-src` and `frame-src` entries for Stripe.

### React Router v6 nested routes swallow the Checkout page

If the checkout route is nested under a layout route that guards on auth,
confirm the guard renders `<Outlet />` rather than unmounting children.
`CheckoutLayout` holds state across plan-picker → payment-form transitions;
remounting it resets that state and can loop the UI.

### Supabase session drops mid-checkout

`createSupabaseAuthAdapter` subscribes to the Supabase auth state. If the user
signs out in another tab, the adapter surfaces the change and
`SolvaPayProvider` re-renders the checkout as anonymous. Wrap the `/checkout`
route with a `ProtectedRoute` component (Lovable scaffolds this for you)
that redirects unauthenticated users to `/login` so the drop is explicit
rather than silent.

### Tailwind v3 preflight overrides primitive padding

Order of imports matters. The correct order in `src/main.tsx`:

```ts
import './index.css'              // Tailwind base + components + utilities
import '@solvapay/react/styles.css'  // SolvaPay primitive defaults (wins)
```

If it still doesn't stick, add `@solvapay/react` to `tailwind.config.js`
`content` so purge keeps the primitive classes — otherwise Tailwind's JIT can
tree-shake them out in production builds:

```js
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/@solvapay/react/**/*.{js,mjs}',
  ],
  // ...
}
```

Full Tailwind v3 and v4 setup snippets live in the SDK repo at
[`packages/react/README.md`](https://github.com/solvapay/solvapay-sdk/blob/main/packages/react/README.md#tailwind-setup).

## Primitives cheat-sheet

`CheckoutLayout` is the drop-in. When the design requires something custom,
compose from primitives:

- `PlanSelector.Root`, `PlanSelector.Card`, `PlanSelector.Name`,
  `PlanSelector.Price`, `PlanSelector.Features`
- `PaymentForm.Root`, `PaymentForm.Element`, `PaymentForm.SubmitButton`,
  `PaymentForm.Error`
- `PurchaseGate` render-prop surfaces `{ status, purchase, plan }`

Full API reference:
[`packages/react/README.md`](https://github.com/solvapay/solvapay-sdk/blob/main/packages/react/README.md).
