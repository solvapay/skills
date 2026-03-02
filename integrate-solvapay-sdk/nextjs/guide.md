# Next.js SDK Guide

Use App Router patterns and `@solvapay/next` helpers.

## Docs References (Topic-Based)

- Topics: `nextjs guide`, `webhooks`, `testing`, `error handling`, `checkout sessions`, `customer sessions`.
- Retrieval hint: resolve via MCP first; fallback to `llms.txt` topic lookup.

## Recommended Flow

1. Add middleware/proxy auth extraction for `/api/*`.
2. Create API routes for checkout session, customer session, subscription checks.
3. Wrap app in `SolvaPayProvider` and connect auth adapter.
4. Gate premium views based on subscription state.
5. Add webhook endpoint to synchronize purchase/payment events.

## Hosted vs Embedded Decision

- Default to hosted checkout for faster integration and lower PCI burden.
- Use embedded payment intents only when product requirements need custom payment UI.
- If unclear, ask one question and default to hosted.

## Implementation Checklist

- [ ] Auth middleware/proxy extracts stable user identity
- [ ] `/api/create-checkout-session` implemented
- [ ] `/api/create-customer-session` implemented
- [ ] `/api/check-subscription` or equivalent implemented
- [ ] UI redirects to hosted checkout/customer URLs
- [ ] Webhook route verifies signatures and updates local state

## Verification

1. Unauthenticated call to protected route returns 401.
2. Authenticated customer can open checkout.
3. Successful purchase unlocks premium route/component.
4. Customer session redirects to portal successfully.
5. At least one webhook event is received and processed.

## Guardrails

- Prefer hosted checkout unless user explicitly needs embedded card UX.
- Keep all Solvapay secret usage in route handlers only.
- Always return clear 401/402 responses from protected API routes.

## Troubleshooting

- Redirect loop on auth routes -> middleware matcher too broad.
- Checkout URL missing -> server route not returning SDK response shape.
- Access not updated after purchase -> webhook not configured or stale cache.
- Signature verification failures -> body parser/edge runtime mismatch or wrong secret.
