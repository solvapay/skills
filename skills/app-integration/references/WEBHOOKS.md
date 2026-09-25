# Webhooks

Use webhooks to keep local state in sync with SolvaPay billing events.

## Docs References (Topic-Based)

- Topics: `webhooks`, `verify signature`, `purchase events`, `payment events`, `error handling`.
- Retrieval hint: fetch verification and event-handling sections first; avoid full-page dumps.

## Required Steps

1. Configure webhook endpoint in SolvaPay Console.
2. Read raw request body.
3. Verify the `sv-signature` header with `SOLVAPAY_WEBHOOK_SECRET` via `verifyWebhook`.
4. Process event idempotently.
5. Update database and invalidate caches.
6. Return success quickly, move heavy side effects to async workers.

`verifyWebhook({ body, signature, secret })` takes a **single object**, returns a typed `WebhookEvent`, and **throws** `SolvaPayError` on a missing, malformed, expired, or invalid signature. It is Node-only (`node:crypto`) — not exported from `@solvapay/server/edge`. On Edge / Deno / Workers use the `solvapayWebhook` factory from `@solvapay/server/fetch`.

## Common Events

Purchase lifecycle:

- `purchase.created`
- `purchase.activated`
- `purchase.updated`
- `purchase.cancellation_scheduled`
- `purchase.cancelled`
- `purchase.reactivated`
- `purchase.expired`
- `purchase.plan_changed`

Payments and checkout:

- `payment.succeeded`
- `payment.failed`
- `checkout_session.completed`

Credits and usage (when those flows are live):

- `customer.credit.topped_up`
- `customer.credit.exhausted`

There is no `payment_intent.succeeded` / `payment_intent.failed` event type. The union is larger than this list — log unknown types and return 200.

## Next.js Pattern

```typescript
import { NextResponse } from 'next/server'
import { verifyWebhook } from '@solvapay/server'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('sv-signature') ?? ''
  try {
    const event = verifyWebhook({
      body,
      signature,
      secret: process.env.SOLVAPAY_WEBHOOK_SECRET!,
    })
    await handleWebhookEvent(event)
    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
}
```

## Express Pattern

```typescript
import express from 'express'
import { verifyWebhook } from '@solvapay/server'

const app = express()
app.post(
  '/api/webhooks/solvapay',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = String(req.headers['sv-signature'] ?? '')
    const body = req.body.toString()
    try {
      const event = verifyWebhook({
        body,
        signature,
        secret: process.env.SOLVAPAY_WEBHOOK_SECRET!,
      })
      await handleWebhookEvent(event)
      return res.json({ received: true })
    } catch {
      return res.status(401).json({ error: 'Invalid signature' })
    }
  },
)
```

## Event-to-Action Matrix

| Event | Typical action |
| --- | --- |
| `purchase.created` | grant access and initialize usage state |
| `purchase.activated` | purchase moved to `active` (paid); grant access |
| `purchase.updated` | refresh access tier/limits |
| `purchase.cancellation_scheduled` | recurring cancel-at-period-end; show pending-cancel state, access continues until `endDate` |
| `purchase.cancelled` | immediate cancel (status `cancelled`); revoke access |
| `purchase.reactivated` | clear pending cancel; restore `autoRenew` |
| `purchase.expired` | revoke access |
| `purchase.plan_changed` | move the customer onto the new plan; drop the old purchase |
| `payment.succeeded` | record payment and clear payment retry flags |
| `payment.failed` | mark account at risk and notify customer |
| `checkout_session.completed` | refresh access after hosted checkout |

## Reactivation and Plan Switching Events

**Reactivation**: `reactivateRenewal` emits `purchase.reactivated` (not `purchase.updated`). The purchase has `cancelledAt: null` and `autoRenew: true`.

**Plan switching**: `activatePlan` onto a different plan emits `purchase.expired` for the superseded purchase and `purchase.plan_changed` for the new one (the new purchase also emits `purchase.created`). Key handlers off `purchase.plan_changed` so you do not double-apply a switch.

## Idempotency Strategy

- Store processed webhook event IDs (or stable dedupe keys).
- Ignore repeats safely and return success.
- Wrap state mutations in transactions where possible.

## Failure and Retry Guidance

- Return `401` for invalid signatures.
- Return `5xx` only when retry is safe and needed.
- Log unknown event types and return `200` unless blocking.
- Keep a dead-letter queue/work item list for repeated failures.

## Verification Checklist

- [ ] Signature validation rejects invalid requests
- [ ] Duplicate delivery does not double-write records
- [ ] Unknown events are logged but do not fail endpoint
- [ ] Purchase state updates are reflected in app access checks
- [ ] Failed payment flow triggers expected user/account response
