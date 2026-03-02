# React SDK Guide

Use this when the project is React-first and backend routes exist separately.

## Docs References (Topic-Based)

- Topics: `react guide`, `auth adapter`, `checkout sessions`, `customer sessions`, `limits`, `webhooks`.
- Retrieval hint: resolve React + API topics via MCP, fallback to `llms.txt`.

## Recommended Flow

1. Implement backend endpoints for checkout/subscription/customer operations.
2. Wrap app with `SolvaPayProvider`.
3. Connect auth adapter (for example Supabase) to send bearer tokens.
4. Use hooks/components for gating and upgrade UI.

## Backend Requirement

React client alone is not enough. The integration needs server endpoints that use `@solvapay/server` or `@solvapay/next`.

## Backend Contract (Required)

- `POST /api/create-checkout-session` -> `{ checkoutUrl }`
- `POST /api/create-customer-session` -> `{ customerUrl }`
- `GET /api/check-subscription` -> subscription/access payload for UI gating
- Optional: webhook endpoint to keep access state synchronized

## Frontend Integration Pattern

- Initialize `SolvaPayProvider` at app root.
- Ensure auth token is attached to backend API calls.
- Use purchase/subscription hooks to gate premium UI.
- Trigger redirects using returned hosted URLs.

## Verification Checklist

- [ ] Provider initializes without exposing secrets in client bundle
- [ ] Authenticated user can trigger checkout and billing portal
- [ ] Premium UI unlocks after successful purchase
- [ ] Unauthorized user receives proper error handling
- [ ] Failure path displays actionable upgrade/retry messaging

## Guardrails

- Never call Solvapay secret endpoints directly from browser code.
- Keep plan/product refs consistent with Solvapay dashboard configuration.

## Troubleshooting

- Purchase state never changes -> backend check-subscription route missing or stale.
- CORS/auth errors -> backend route not accepting token/session strategy.
- UI shows unlocked while API denies -> local state out of sync; re-fetch from backend truth.
