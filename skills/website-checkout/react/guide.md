# React Website Checkout Guide

React-only projects need a backend that owns SolvaPay secret operations.

## Docs References (Topic-Based)

- Topics: `react guide`, `checkout sessions`, `customer sessions`, `auth`.
- Retrieval hint: resolve via MCP first; fallback to `llms.txt`.

## Required Backend Contract

1. Build backend routes (Node/Express/Next API) for checkout/customer sessions.
2. Keep `SOLVAPAY_SECRET_KEY` only on backend.
3. Use frontend redirects to hosted checkout/customer URLs returned by backend.

### Minimum Routes

- `POST /api/create-checkout-session` -> `{ checkoutUrl }`
- `POST /api/create-customer-session` -> `{ customerUrl }`
- `GET /api/check-access` (or equivalent) -> current access state

## Frontend Responsibilities

- Send auth token/session to backend routes.
- Redirect to hosted URLs from backend response.
- Refresh access state after return from checkout.

## Verification Checklist

- [ ] Hosted checkout redirect works from React app
- [ ] Customer portal redirect works
- [ ] Premium UI updates after successful checkout return
- [ ] Backend denies unauthorized users correctly

## Limitations

- React-only client cannot securely call SolvaPay secret endpoints directly.
- Webhook handling remains backend responsibility.

For full stack-specific implementation details, see [../../sdk-integration/react/guide.md](../../sdk-integration/react/guide.md).
