# React Website Checkout — Integration Procedure

## Contents

- Procedure
- Minimal Express backend skeleton
- Verification checklist

React-only projects need a backend for SolvaPay secret operations.

## Procedure

1. Confirm a backend exists (Express, Next API, etc.). If none → hand off to `solvapay/sdk-integration`.
2. Implement backend routes (below).
3. Keep `SOLVAPAY_SECRET_KEY` server-only.
4. Frontend: send auth token to backend; redirect to hosted URLs; refresh access after return.

## Minimal Express backend skeleton

```typescript
import express from 'express'
import { createSolvaPayServer } from '@solvapay/server'

const app = express()
app.use(express.json())
const solvaPay = createSolvaPayServer({ secretKey: process.env.SOLVAPAY_SECRET_KEY! })

app.post('/api/create-checkout-session', async (req, res) => {
  const { customerRef, productRef, planRef, returnUrl } = req.body
  const session = await solvaPay.checkout.createSession({
    customerRef,
    productRef,
    planRef,
    returnUrl,
  })
  res.json({ checkoutUrl: session.checkoutUrl })
})

app.get('/api/check-access', async (req, res) => {
  // map auth user → customerRef; check purchase/access
  res.json({ hasAccess: true })
})
```

Adapt to your auth middleware. For full SDK patterns install `solvapay/sdk-integration`.

## Required routes

- `POST /api/create-checkout-session` → `{ checkoutUrl }`
- `POST /api/create-customer-session` → `{ customerUrl }`
- `GET /api/check-access` → access state

## Verification checklist

- [ ] Hosted checkout redirect works
- [ ] Customer portal redirect works
- [ ] Premium UI updates after checkout return
- [ ] Backend denies unauthorized users
