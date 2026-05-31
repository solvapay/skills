# Lovable Checkout — Provider and Routes

## Contents

- Step 4 — SolvaPayProvider
- Step 5 — Checkout route
- Step 6 — PurchaseGate
- shadcn composition (optional)
- Environment variables

## Step 4 — Wire SolvaPayProvider

Mount around `RouterProvider` in `src/main.tsx`:

```tsx
import { SolvaPayProvider } from '@solvapay/react'
import { createSupabaseAuthAdapter } from '@solvapay/react-supabase'
import { supabase } from '@/integrations/supabase/client'
import '@solvapay/react/styles.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const FN = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`

const adapter = createSupabaseAuthAdapter({ client: supabase })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SolvaPayProvider
    config={{
      auth: { adapter },
      api: {
        listPlans: FN('list-plans'),
        createPayment: FN('create-payment-intent'),
        processPayment: FN('process-payment'),
        checkPurchase: FN('check-purchase'),
      },
    }}
  >
    <RouterProvider router={router} />
  </SolvaPayProvider>,
)
```

Use the **existing** Supabase singleton — second `GoTrueClient` drops sessions.

- All `config.api.*` URLs must be **absolute**.
- Import `@solvapay/react/styles.css` **after** `./index.css` (Tailwind).

## Step 5 — Checkout route

```tsx
import { CheckoutLayout } from '@solvapay/react'
import { useNavigate } from 'react-router-dom'

export function CheckoutPage() {
  const navigate = useNavigate()
  return (
    <CheckoutLayout
      productRef={import.meta.env.VITE_SOLVAPAY_PRODUCT_REF as string}
      requireTermsAcceptance
      onResult={result => {
        if (result.kind === 'paid' || result.kind === 'activated') {
          navigate('/dashboard')
        }
      }}
    />
  )
}
```

Register `{ path: '/checkout', element: <CheckoutPage /> }`.

## Step 6 — PurchaseGate

```tsx
import { PurchaseGate } from '@solvapay/react'
import { Navigate } from 'react-router-dom'

const PRODUCT_NAME = 'Widget API' // exact Console name

export function DashboardPage() {
  return (
    <PurchaseGate.Root requireProduct={PRODUCT_NAME}>
      <PurchaseGate.Loading><div>Loading…</div></PurchaseGate.Loading>
      <PurchaseGate.Allowed asChild><Dashboard /></PurchaseGate.Allowed>
      <PurchaseGate.Blocked asChild><Navigate to="/checkout" replace /></PurchaseGate.Blocked>
    </PurchaseGate.Root>
  )
}
```

## shadcn composition (optional)

Use `@solvapay/react/primitives` with shadcn `Card`/`Button` when `CheckoutLayout` is not flexible enough.

## Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` | Lovable default |
| `VITE_SUPABASE_ANON_KEY` | `.env` | Lovable default |
| `VITE_SOLVAPAY_PRODUCT_REF` | `.env` | `prd_...` — safe client-side |
| `SOLVAPAY_SECRET_KEY` | Supabase secret | Never client |
| `SOLVAPAY_API_BASE_URL` | Supabase secret | api-dev during preview |
