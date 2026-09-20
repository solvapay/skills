# Lovable Checkout — Reference

Secondary file for developers browsing this guide on GitHub. The primary
delivery channel is pasting the numbered files from [GUIDE.md](GUIDE.md) into
the Lovable chat; this reference covers the bits that would bloat those files
without helping a paste-in agent turn zero.

## Canonical reference projects

There is no `examples/spa-checkout`. Pair these two SDK examples:

- Backend: [`solvapay-sdk/examples/supabase-edge`](https://github.com/solvapay/solvapay-sdk/tree/main/examples/supabase-edge)
- Frontend: [`solvapay-sdk/examples/shadcn-checkout`](https://github.com/solvapay/solvapay-sdk/tree/main/examples/shadcn-checkout) (Vite + React + TypeScript + Tailwind v4 + shadcn/ui)

The only difference from a Lovable app is dependency resolution: the examples
use `workspace:*` so they track the local SDK build. In a Lovable project,
those become `"preview"` (the floating npm tag).

To run the backend reference locally:

```bash
git clone https://github.com/solvapay/solvapay-sdk
cd solvapay-sdk/examples/supabase-edge
# follow the README there
```

Use it to sanity-check any snippet before shipping. If the reference works and
your Lovable project doesn't, the diff is almost always in
[02-provider-and-routes.md](02-provider-and-routes.md) (`SolvaPayProvider`
config) or [01-edge-and-secrets.md](01-edge-and-secrets.md)
(`supabase/functions/deno.json`).

## Extended edge function catalogue

[01-edge-and-secrets.md](01-edge-and-secrets.md) lists the four edge functions
required by `CheckoutLayout` and `PurchaseGate`. `@solvapay/server/fetch`
exports additional handlers for flows beyond the happy path. Only add these
when the corresponding UI needs them — every extra function is one more deploy
target.

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
| `get-merchant` | `getMerchant` | Branding (logo, icon, terms, privacy) in checkout and account UI |
| `get-payment-method` | `getPaymentMethod` | `CurrentPlanCard`, `usePaymentMethod` hook |
| `get-product` | `getProduct` | Product details + public plans |
| `create-checkout-session` | `createCheckoutSession` | Hosted checkout redirect (not this skill's path) |
| `create-customer-session` | `createCustomerSession` | Hosted customer portal |
| `sync-customer` | `syncCustomer` | Server-side customer create/link |
| `get-history` | `getHistory` | Purchase / payment history |
| `track-usage` | `trackUsage` | Metered usage |
| `solvapay-webhook` | `solvapayWebhook` | Receiving SolvaPay webhooks server-side |

All handlers except `solvapayWebhook` follow the same one-liner shape:

```ts
import { activatePlan } from '@solvapay/server/fetch'
Deno.serve(activatePlan)
```

`solvapayWebhook` is a factory — call it with the signing secret:

```ts
import { solvapayWebhook } from '@solvapay/server/fetch'

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

Check the browser console for Stripe errors. The common culprit in a Vite +
React SPA is a Content Security Policy that blocks `https://js.stripe.com` or
`https://*.stripe.com`. `@stripe/stripe-js` is already a dependency of
`@solvapay/react` — do not add it as a direct dependency (duplicate Stripe
instances). Lovable projects don't ship a CSP by default, but any custom
`<meta http-equiv="Content-Security-Policy">` needs `script-src` and
`frame-src` entries for Stripe.

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

### Tailwind preflight vs primitive styles

Order of imports matters. Primitive styling comes from
`@solvapay/react/styles.css` via `data-solvapay-*` attribute selectors — not
Tailwind utility classes. Import the SDK stylesheet **first** so app Tailwind
utilities can still override:

```ts
import '@solvapay/react/styles.css'
import './index.css'
```

Do not add `@solvapay/react` to a Tailwind `content` glob — there is nothing
for JIT to purge. Component API lives in
[`packages/react/README.md`](https://github.com/solvapay/solvapay-sdk/blob/main/packages/react/README.md).

## Primitives cheat-sheet

`CheckoutLayout` is the drop-in. When the design requires something custom,
compose from primitives (`@solvapay/react/primitives`):

- `PlanSelector.Root`, `PlanSelector.Card`, `PlanSelector.CardName`,
  `PlanSelector.CardPrice`, `PlanSelector.CardInterval`
- `PaymentForm.Root`, `PaymentForm.PaymentElement`, `PaymentForm.SubmitButton`,
  `PaymentForm.Error`
- `PurchaseGate.Root`, `PurchaseGate.Allowed`, `PurchaseGate.Blocked`,
  `PurchaseGate.Loading`, `PurchaseGate.Error` — compound, not a render-prop.
  Pass `requireProduct` (product **name**, case-insensitive) on `Root`.

Full API reference:
[`packages/react/README.md`](https://github.com/solvapay/solvapay-sdk/blob/main/packages/react/README.md).
