# Next.js SDK Guide

Use App Router patterns and `@solvapay/next` helpers.

## Prerequisites

- Run `npx solvapay init` to authenticate, write `SOLVAPAY_SECRET_KEY` to
  `.env`, and install base SDK packages.
- Install additional packages for this flow:

```bash
npm install @solvapay/next @solvapay/react @solvapay/react-supabase
```

## Docs References (Topic-Based)

- Topics: `nextjs guide`, `webhooks`, `testing`, `error handling`, `checkout sessions`, `customer sessions`.
- Retrieval hint: resolve via MCP first; fallback to `llms.txt` topic lookup.

## Recommended Flow

1. Add middleware/proxy auth extraction for `/api/*`.
2. Create API routes for checkout session, customer session, and access checks.
3. Wrap app in `SolvaPayProvider` and connect auth adapter.
4. Gate premium views based on purchase/access state.
5. Add webhook endpoint to synchronize purchase/payment events.

## Hosted vs Embedded Decision

- Default to hosted checkout for faster integration and lower PCI burden.
- Use embedded payment intents only when product requirements need custom payment UI.
- If unclear, ask one clarifying question and continue with hosted checkout unless the user explicitly needs embedded UI.

## Implementation Checklist

- [ ] Auth middleware/proxy extracts stable user identity
- [ ] `/api/create-checkout-session` implemented
- [ ] `/api/create-customer-session` implemented
- [ ] `/api/check-access` or equivalent implemented
- [ ] UI redirects to hosted checkout/customer URLs
- [ ] Webhook route verifies signatures and updates local state
- [ ] `/api/cancel-renewal` implemented (if subscription management needed)
- [ ] `/api/reactivate-renewal` implemented (if subscription management needed)
- [ ] `/api/activate-plan` implemented (if free plans, credit activation, or plan switching needed)
- [ ] `/api/list-plans` implemented (if plan selection UI needed)

## Verification

1. Unauthenticated call to protected route returns 401.
2. Authenticated customer can open checkout.
3. Successful purchase unlocks premium route/component.
4. Customer session redirects to portal successfully.
5. At least one webhook event is received and processed.
6. Cancel and reactivate renewal round-trips correctly (if implemented).
7. Plan activation and switching works as expected (if implemented).

## Guardrails

- Prefer hosted checkout unless user explicitly needs embedded card UX.
- Keep all SolvaPay secret usage in route handlers only.
- Always return clear 401/402 responses from protected API routes.

## Troubleshooting

- Redirect loop on auth routes -> middleware matcher too broad.
- Checkout URL missing -> server route not returning SDK response shape.
- Access not updated after purchase -> webhook not configured or stale cache.
- Signature verification failures -> body parser/edge runtime mismatch or wrong secret.
