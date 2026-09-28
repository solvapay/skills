# React SDK Guide

Use this when the project is React-first and backend routes exist separately.

## Prerequisites

- Run `npx -y solvapay@latest init` to authenticate, write `SOLVAPAY_SECRET_KEY` to
  `.env`, and install base SDK packages.
- Install additional packages for this flow:

```bash
npm install @solvapay/react
```

## Docs References (Topic-Based)

- Topics: `react guide`, `auth adapter`, `checkout sessions`, `customer sessions`, `limits`, `webhooks`.
- Retrieval hint: resolve React + API topics via MCP, fallback to `llms.txt`.

## Recommended Flow

1. Implement backend endpoints for checkout/access/customer operations.
2. Wrap app with `SolvaPayProvider`.
3. Connect auth adapter (for example Supabase) to send bearer tokens.
4. Use hooks/components for gating and upgrade UI.

## Backend Requirement

React client alone is not enough. The integration needs server endpoints that use `@solvapay/server` or `@solvapay/next`.

## Backend Contract (Required)

- `POST /api/create-checkout-session` -> `{ checkoutUrl }`
- `POST /api/create-customer-session` -> `{ customerUrl }`
- `GET /api/check-purchase` -> `{ customerRef, purchases[] }` for UI gating
- Optional: webhook endpoint to keep access state synchronized

## Frontend Integration Pattern

- Initialize `SolvaPayProvider` at app root. MCP host iframe UI belongs to `solvapay/create-mcp-app`.
- Ensure auth token is attached to backend API calls.
- Use purchase/access hooks to gate premium UI (`usePurchase`, `PurchaseGate`).
- Trigger redirects using returned hosted URLs.

## Account management components

Drop these into any authenticated view to render a complete self-service billing UI:

- **`<CurrentPlanCard />`** — renders the active plan, next-billing line, mirrored card brand/last4, and inline **Update card** / **Cancel plan** actions. Returns `null` when there is no active purchase.
- **`<LaunchCustomerPortalButton />`** — opens the hosted customer portal in a new tab. Pre-fetches `createCustomerSession` on hover so the portal link is ready on click.
- **`usePaymentMethod()`** — `{ paymentMethod, loading, refetch }` where `paymentMethod` is `{ kind: 'card', brand, last4, expMonth, expYear, reusable } | { kind: 'none' }`. The card brand/last4 are mirrored onto the Customer by the `payment.succeeded` webhook, so this hook is free to poll and needs no Stripe round-trip. `reusable` distinguishes a chargeable saved card from a card that is only on file — check it before offering an off-session action such as auto-recharge.
- **`useMerchant()`** — `{ merchant, loading }` where `merchant` is the result of `GET /v1/sdk/merchant` (`name`, `iconUrl`, `logoUrl`, `termsUrl`, `privacyUrl`). Use in checkout and mandate copy.

## Activation + PAYG semantics

When `activatePlan` is called on a usage-based (PAYG) plan, the server activates at zero balance (`status: 'activated'`, `creditBalance: 0`). The user can start calling paid features immediately and pay per use from prepaid credits; top-up is an optional follow-up via `createTopupPaymentIntent`. Free plans return `activated`. Paid recurring and hybrid plans return `payment_required` at activation — the upfront charge must be collected first. Usage on a recurring plan is paid from prepaid credits, and a zero balance shows up as `topup_required` when usage is attempted, not at activation. `createTopupPaymentIntent` is the recovery path.

## Verification Checklist

- [ ] Provider initializes without exposing secrets in client bundle
- [ ] Authenticated user can trigger checkout and billing portal
- [ ] Premium UI unlocks after successful purchase
- [ ] Unauthorized user receives proper error handling
- [ ] Failure path displays actionable upgrade/retry messaging

## Guardrails

- Never call SolvaPay secret endpoints directly from browser code.
- Keep plan/product refs consistent with SolvaPay Console configuration.

## Troubleshooting

- Purchase state never changes -> backend check-access route missing or stale.
- CORS/auth errors -> backend route not accepting token/session strategy.
- UI shows unlocked while API denies -> local state out of sync; re-fetch from backend truth.
