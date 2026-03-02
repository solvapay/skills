# Webhooks

Use webhooks to keep local state in sync with Solvapay billing events.

## Docs References (Topic-Based)

- Topics: `webhooks`, `verify signature`, `purchase events`, `payment events`, `error handling`.
- Retrieval hint: fetch verification and event-handling sections first; avoid full-page dumps.

## Required Steps

1. Configure webhook endpoint in Solvapay dashboard.
2. Read raw request body.
3. Verify `x-solvapay-signature` with `SOLVAPAY_WEBHOOK_SECRET`.
4. Process event idempotently.
5. Update database and invalidate caches.
6. Return success quickly, move heavy side effects to async workers.

## Common Events

- `purchase.created`
- `purchase.updated`
- `purchase.cancelled`
- `payment.succeeded`
- `payment.failed`

## Next.js Pattern

```typescript
import { verifyWebhook } from '@solvapay/server'

const payload = await request.text()
const signature = request.headers.get('x-solvapay-signature')
const ok = signature
  ? verifyWebhook(payload, signature, { secret: process.env.SOLVAPAY_WEBHOOK_SECRET! })
  : false
if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
```

## Express Pattern

```typescript
import express from 'express'
import { verifyWebhook } from '@solvapay/server'

const app = express()
app.post('/api/webhooks/solvapay', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-solvapay-signature'] as string | undefined
  const payload = req.body.toString()
  if (!signature || !verifyWebhook(payload, signature, { secret: process.env.SOLVAPAY_WEBHOOK_SECRET! })) {
    return res.status(401).json({ error: 'Invalid signature' })
  }
  const event = JSON.parse(payload)
  await handleWebhookEvent(event)
  return res.json({ received: true })
})
```

## Event-to-Action Matrix

| Event | Typical action |
| --- | --- |
| `purchase.created` | grant access and initialize usage state |
| `purchase.updated` | update access tier/limits |
| `purchase.cancelled` | schedule downgrade or revoke at period end |
| `payment.succeeded` | record payment and clear payment retry flags |
| `payment.failed` | mark account at risk and notify customer |

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
