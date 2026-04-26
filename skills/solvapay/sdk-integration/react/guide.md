# React SDK Guide

Use this when the project is React-first and backend routes exist separately.

## Prerequisites

- Run `npx solvapay init` to authenticate, write `SOLVAPAY_SECRET_KEY` to
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
- `GET /api/check-access` -> purchase/access payload for UI gating
- Optional: webhook endpoint to keep access state synchronized

## Frontend Integration Pattern

- Initialize `SolvaPayProvider` at app root. Pass `config.transport` if you're running inside an MCP host sandbox (see [mcp-server/guide.md](../mcp-server/guide.md) and `createMcpAppAdapter` from `@solvapay/react/mcp`). Per-method transport props on the provider were removed in SDK 1.1 — `config.transport` is the only supported shape.
- Ensure auth token is attached to backend API calls.
- Use purchase/access hooks to gate premium UI (`usePurchase`, `PurchaseGate`).
- Trigger redirects using returned hosted URLs.

## Account management components

Drop these into any authenticated view to render a complete self-service billing UI:

- **`<CurrentPlanCard />`** — renders the active plan, next-billing line, mirrored card brand/last4, and inline **Update card** / **Cancel plan** actions. Returns `null` when there is no active purchase.
- **`<LaunchCustomerPortalButton />`** — opens the hosted customer portal in a new tab. Pre-fetches `createCustomerSession` on hover so the portal link is ready on click.
- **`usePaymentMethod()`** — `{ paymentMethod, loading, refetch }` where `paymentMethod` is `{ kind: 'card', brand, last4, expMonth, expYear } | { kind: 'none' }`. The card brand/last4 are mirrored onto the Customer by the `payment_intent.succeeded` webhook, so this hook is free to poll and needs no Stripe round-trip.
- **`useMerchant()`** — `{ merchant, loading }` where `merchant` is the result of `GET /v1/sdk/merchant` (`name`, `iconUrl`, `logoUrl`, `termsUrl`, `privacyUrl`). Use in checkout and mandate copy.

## Activation + PAYG semantics

When `activatePlan` is called on a usage-based (PAYG) plan, the server now activates eagerly at zero balance (`status: 'activated'`, `creditBalance: 0`) instead of returning `topup_required`. The user can start calling paid features immediately and pay per use; top-up becomes an optional follow-up flow via `createTopupPaymentIntent`. Free plans are unchanged (`activated`), and recurring/hybrid plans still return `topup_required` / `payment_required` when the customer has no credits and no card on file.

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
