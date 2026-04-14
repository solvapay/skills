# Step 3: Checkout and Portal

Create server routes that return hosted URLs, then redirect on the client.

## Docs References (Topic-Based)

- Topics: `checkout sessions`, `customer sessions`, `check access`, `return URL`.
- Retrieval hint: resolve API topics via MCP first; fallback to `llms.txt`.

## API Routes

- `POST /api/create-checkout-session`
  - calls `createCheckoutSession(...)`
  - returns `{ checkoutUrl }`
- `POST /api/create-customer-session`
  - calls `createCustomerSession(...)`
  - returns `{ customerUrl }`
- `POST /api/cancel-renewal`
  - calls `cancelRenewal(request, { purchaseRef, reason? })`
  - returns purchase object with `cancelledAt` set
- `POST /api/reactivate-renewal`
  - calls `reactivateRenewal(request, { purchaseRef })`
  - returns purchase object with `cancelledAt` cleared
- `POST /api/activate-plan`
  - calls `activatePlan(request, { productRef, planRef })`
  - returns `{ status, purchaseRef?, checkoutUrl? }` — use for free plans, credit activation, or plan switching

### Route Skeleton (Hosted Checkout)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutSession } from '@solvapay/next'

export async function POST(request: NextRequest) {
  const { productRef, planRef } = await request.json()
  const result = await createCheckoutSession(request, { productRef, planRef })
  return result instanceof NextResponse ? result : NextResponse.json(result)
}
```

## Client Flow

1. Call checkout route from authenticated client.
2. Redirect user to returned `checkoutUrl`.
3. On return to app, re-check purchase/access state and unlock premium features.
4. Provide "Manage billing" action using `customerUrl`.

### Redirect Pattern

```typescript
const res = await fetch('/api/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ productRef, planRef }),
})
const { checkoutUrl } = await res.json()
window.location.href = checkoutUrl
```

## Post-Checkout Refresh

- On return route/page load, call the access check endpoint and refresh UI state.
- Keep server-side access checks authoritative for premium routes.

## Verify

- [ ] Checkout redirect works
- [ ] Successful purchase updates access state
- [ ] Customer portal redirect works
- [ ] Declined flow keeps premium features locked

## Troubleshooting

- Redirect URL missing -> server route not returning expected shape.
- Returned from checkout but still no access -> no access refresh or failed webhook sync.
- Portal opens wrong account -> customer reference mismatch.
