# Express SDK Guide

## Contents

- Implementation checklist
- Route protection pattern
- Validation
- Troubleshooting

Paywall wrappers around Express business handlers.

## Implementation checklist

- [ ] Run `npx -y solvapay@latest init`
- [ ] Initialize SolvaPay server client
- [ ] Create `payable` handler with product configuration
- [ ] Wrap routes with `payable.http(...)`
- [ ] Pass stable customer reference from auth/header
- [ ] Verify free-tier path works
- [ ] Verify over-limit returns 402 with checkout URL
- [ ] Verify protected logic skipped when limits deny access

## Route protection pattern

```typescript
const payable = solvaPay.payable({ product: 'prd_api' })
app.post('/v1/generate', payable.http(generateHandler))
```

Plans live in SolvaPay Console — SDK resolves plan from customer purchase.

## Validation

- Free-tier path works.
- Over-limit returns payment-required with checkout URL.
- Per-customer isolation preserved.
- Protected logic not executed when limits deny.

## 402 handling

- Structured message with checkout/upgrade URL.
- Idempotent client retry logic.
- Log product/plan/customer context.

## Troubleshooting

- 402 every request → wrong plan/product refs or missing customer identity.
- No enforcement → route not wrapped with `payable.http(...)`.
- Inconsistent limits → unstable customer reference.
