# React Website Checkout — Integration Procedure

## Contents

- Procedure
- Minimal Express backend skeleton
- Verification checklist

React-only projects need a backend for SolvaPay secret operations.

## Procedure

1. Confirm a backend exists (Express, Next API, etc.). If none → hand off to `solvapay/app-integration`.
2. Implement backend routes (below).
3. Keep `SOLVAPAY_SECRET_KEY` server-only.
4. Frontend: send auth token to backend; redirect to hosted URLs; refresh access after return.

## Minimal Express backend skeleton

`createSolvaPay()` reads `SOLVAPAY_SECRET_KEY` from the environment. `createCheckoutSession` requires both `productRef` and `customerRef`. Access state is `{ customerRef, purchases[] }` from `checkPurchaseCore` — there is no `hasAccess` field.

```typescript
import express from 'express'
import {
  createSolvaPay,
  checkPurchaseCore,
  syncCustomerCore,
  isErrorResult,
} from '@solvapay/server'

const app = express()
app.use(express.json())
const solvaPay = createSolvaPay()

// The *Core helpers read `authorization` (and the optional
// `x-solvapay-customer-ref` cache hint) from a web-standard Request.
function toRequest(req: express.Request): Request {
  const url = new URL(req.originalUrl, `http://${req.headers.host ?? 'localhost'}`)
  const headers = new Headers()
  for (const name of ['authorization', 'x-solvapay-customer-ref']) {
    const value = req.get(name)
    if (value) headers.set(name, value)
  }
  return new Request(url, { method: req.method, headers })
}

app.post('/api/sync-customer', async (req, res) => {
  const result = await syncCustomerCore(toRequest(req), { solvaPay })
  if (isErrorResult(result)) {
    return res.status(result.status).json(result)
  }
  return res.json({ customerRef: result })
})

app.post('/api/create-checkout-session', async (req, res) => {
  const { customerRef, productRef, planRef, returnUrl } = req.body
  const session = await solvaPay.createCheckoutSession({
    customerRef,
    productRef,
    planRef,
    returnUrl,
  })
  res.json(session)
})

app.post('/api/create-customer-session', async (req, res) => {
  const { customerRef, productRef } = req.body
  const session = await solvaPay.createCustomerSession({ customerRef, productRef })
  res.json(session)
})

app.get('/api/check-purchase', async (req, res) => {
  const result = await checkPurchaseCore(toRequest(req), { solvaPay })
  if (isErrorResult(result)) {
    return res.status(result.status).json(result)
  }
  return res.json(result)
})
```

Adapt to your auth middleware. For full SDK patterns install `solvapay/app-integration`.

## Required routes

- `POST /api/create-checkout-session` → `{ sessionId, checkoutUrl }`
- `POST /api/create-customer-session` → `{ sessionId, customerUrl }`
- `GET /api/check-purchase` → `{ customerRef, purchases[] }`

## Verification checklist

- [ ] Hosted checkout redirect works
- [ ] Customer portal redirect works
- [ ] Premium UI updates after checkout return
- [ ] Backend denies unauthorized users
