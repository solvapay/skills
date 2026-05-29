# Next.js Hosted Checkout

## Contents

- Step 1 — Setup
- Step 2 — Authentication
- Step 3 — Checkout and portal routes
- Verification flow

Add SolvaPay hosted checkout and customer portal to Next.js App Router.

## What you build

- Authenticated user identity flow
- API route to create checkout session URL
- API route to create customer portal URL
- Frontend redirects to hosted pages
- Purchase / access-aware UI states

## Docs References (Topic-Based)

- Topics: `installation`, `nextjs guide`, `core concepts`, `checkout sessions`, `customer sessions`, `webhooks`, `test in sandbox`.
- Retrieval hint: resolve topics via MCP first, fallback to `llms.txt`.

## Step 1 — Setup

### Required packages

```bash
npx -y solvapay@latest init
npm install @solvapay/next @solvapay/react @solvapay/react-supabase @supabase/supabase-js
```

### Environment variables

`npx -y solvapay@latest init` writes `SOLVAPAY_SECRET_KEY` to `.env`. Add the remaining variables:

```env
NEXT_PUBLIC_PRODUCT_REF=prd_...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_JWT_SECRET=...
```

| Variable | Purpose |
| --- | --- |
| `SOLVAPAY_SECRET_KEY` | server-only auth to SolvaPay API |
| `SOLVAPAY_API_BASE_URL` | optional API host override |
| `NEXT_PUBLIC_PRODUCT_REF` | default product used for hosted checkout |
| Supabase vars | auth and token verification |

### Verify

- [ ] App Router project is present
- [ ] Server env vars exist
- [ ] No secret values in `NEXT_PUBLIC_*`
- [ ] Product reference exists in SolvaPay Console

### Troubleshooting

- Missing env errors → ensure `.env.local` exists and restart dev server.
- 401 on all API routes → verify JWT secret and auth middleware setup in Step 2.

## Step 2 — Authentication

Use Supabase JWT auth so server routes can map requests to one customer identity.

### Recommended pattern

- Use SolvaPay Next auth middleware helper to extract user id for `/api/*`.
- Keep auth token handling server-side for all checkout / customer session routes.
- Use `SolvaPayProvider` + Supabase adapter in client UI layer.

### Implementation notes

- Middleware should set a stable user identifier for downstream API handlers.
- Customer sync should run before first checkout for new users.
- Keep an access check route (for example `/api/check-access`) available for UI refresh after checkout return.

### Verify

- [ ] Unauthenticated requests to protected routes return 401
- [ ] Authenticated requests include stable user identity
- [ ] Customer sync endpoint can create/update customer mapping

### Troubleshooting

- Intermittent auth failures → token not forwarded from client to API route.
- Customer session creation fails → customer sync not executed or wrong customer ref.

## Step 3 — Checkout and Portal Routes

Create server routes that return hosted URLs, then redirect on the client.

### API routes

- `POST /api/create-checkout-session` → `createCheckoutSession(...)` → `{ checkoutUrl }`
- `POST /api/create-customer-session` → `createCustomerSession(...)` → `{ customerUrl }`
- `POST /api/cancel-renewal` → `cancelRenewal(request, { purchaseRef, reason? })` → purchase with `cancelledAt`
- `POST /api/reactivate-renewal` → `reactivateRenewal(request, { purchaseRef })` → purchase with `cancelledAt` cleared
- `POST /api/activate-plan` → `activatePlan(request, { productRef, planRef })` → `{ status, purchaseRef?, checkoutUrl? }` (free plans, credit activation, plan switching)

### Route skeleton (hosted checkout)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutSession } from '@solvapay/next'

export async function POST(request: NextRequest) {
  const { productRef, planRef } = await request.json()
  const result = await createCheckoutSession(request, { productRef, planRef })
  return result instanceof NextResponse ? result : NextResponse.json(result)
}
```

### Client flow

1. Call checkout route from authenticated client.
2. Redirect user to returned `checkoutUrl`.
3. On return to app, re-check purchase/access state and unlock premium features.
4. Provide "Manage billing" action using `customerUrl`.

### Redirect pattern

```typescript
const res = await fetch('/api/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ productRef, planRef }),
})
const { checkoutUrl } = await res.json()
window.location.href = checkoutUrl
```

### Post-checkout refresh

- On return route/page load, call the access check endpoint and refresh UI state.
- Keep server-side access checks authoritative for premium routes.

### Verify

- [ ] Checkout redirect works
- [ ] Successful purchase updates access state
- [ ] Customer portal redirect works
- [ ] Declined flow keeps premium features locked

### Troubleshooting

- Redirect URL missing → server route not returning expected shape.
- Returned from checkout but still no access → no access refresh or failed webhook sync.
- Portal opens wrong account → customer reference mismatch.

## Verification Flow

1. Unauthenticated user is blocked from checkout endpoints.
2. Authenticated user receives checkout URL.
3. User returns from hosted checkout.
4. App refreshes purchase / access state and unlocks features.
5. Customer portal redirect works.

Before handoff, emit a runnable verification artifact (curl block or test script) — not a prose summary:

```bash
# Happy path — after sandbox checkout, access refresh returns granted
curl -i -X POST http://localhost:3000/api/check-access \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productRef":"'"$NEXT_PUBLIC_PRODUCT_REF"'"}'
# Expect: { "hasAccess": true } (or equivalent granted payload)

# Failure path — unauthenticated checkout blocked
curl -i -X POST http://localhost:3000/api/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"productRef":"'"$NEXT_PUBLIC_PRODUCT_REF"'","planRef":"pln_..."}'
# Expect: HTTP/1.1 401
```

## Note

For usage metering, Express/MCP paths, or webhook-heavy flows, hand off to `solvapay/sdk-integration` (install separately).
