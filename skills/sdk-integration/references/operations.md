# SDK Operations

Procedure-oriented lookup for `@solvapay/*` API patterns. Read after stack guide, before authoring routes.

## Contents

- Package map
- Operation procedures
- Retrieval hints

## Package map

- `@solvapay/server` — server SDK, paywall handlers, webhook verification
- `@solvapay/server/fetch` — fetch-native handlers for Edge / Deno / Workers
- `@solvapay/next` — Next.js route wrappers (`Promise<NextResponse>` in SDK 1.1)
- `@solvapay/mcp` / `@solvapay/mcp/fetch` — MCP server adapter
- `@solvapay/react` — UI provider, hooks, checkout components
- `@solvapay/react-supabase` — Supabase auth adapter
- `@solvapay/auth` — auth utilities

## Operation procedures

### When user needs hosted checkout redirect

1. Ensure customer exists (sync/ensure step).
2. Call `createCheckoutSession` with `customerRef`, `productRef`, `planRef`, `returnUrl`.
3. Redirect browser to `checkoutUrl`.

Docs topic: `checkout sessions create`.

### When user needs billing portal

1. Call `createCustomerSession` with `customerRef`.
2. Redirect to `customerUrl`.

Docs topic: `customer session create`.

### When user needs paywall / limits check

1. Before expensive operation, check access/limits for `customerRef` + `productRef`.
2. On block, return 402 with upgrade/checkout guidance.

Docs topic: `limits check usage limits`.

### When user needs usage metering

1. After successful execution, record usage event for customer + product.

Docs topic: `usage record event`.

### When user cancels subscription

1. Call `cancelRenewal` / `cancelPurchaseCore` with `purchaseRef`.
2. Access continues until period end.

### When user reactivates subscription

1. Call `reactivateRenewal` while purchase active and before period end.

### When user activates plan without checkout

1. Call `activatePlan` with `productRef`, `planRef`.
2. Handle `status`: `activated`, `already_active`, `topup_required`, `payment_required`.

Free plans activate immediately; PAYG activates at zero balance; recurring may need checkout.

### When user updates customer

1. `PATCH /v1/sdk/customers/:reference` with optional `externalRef`, `name`, `email`.
2. On create with matching email, customer is linked (not 409).

### When user needs merchant branding

1. `GET /v1/sdk/merchant` for checkout/MCP chrome copy.

### When user needs Stripe publishable key

1. `GET /v1/sdk/platform-config` before mounting `<PaymentForm>`.

### When user shows saved payment method

1. `GET /v1/sdk/payment-method?customerRef=` or `usePaymentMethod()` hook.

### When user needs embedded payment (not hosted checkout)

1. Use payment intent flow only when hosted checkout is unacceptable.

Docs topic: `payment intents create`.

## Retrieval hints

Resolve topics via SolvaPay Docs MCP → `llms.txt` → direct page fetch.
