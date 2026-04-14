# Express SDK Guide

Use SolvaPay paywall wrappers around Express business handlers.

## Prerequisites

- Run `npx solvapay init` to authenticate, write `SOLVAPAY_SECRET_KEY` to
  `.env`, and install base SDK packages.
- Base packages from init are sufficient for this flow.

## Docs References (Topic-Based)

- Topics: `express guide`, `limits`, `usage`, `checkout sessions`, `error handling`, `testing`.
- Retrieval hint: resolve guide topic first; pull API operation topics only when needed.

## Recommended Flow

1. Initialize SolvaPay server client.
2. Create `payable` handler with product configuration.
3. Wrap routes with `payable.http(...)`.
4. Pass stable customer reference from auth/header.
5. Add usage tracking and failure-path responses.

## Route Protection Pattern

Use one payable handler per product:

```typescript
const payable = solvaPay.payable({ product: 'prd_api' })
app.post('/v1/generate', payable.http(generateHandler))
```

Plans are managed on the product in SolvaPay Console. The SDK resolves the correct plan from the customer's purchase automatically.

## Validation

- Ensure free-tier path works.
- Ensure request over limit returns payment-required response with checkout URL.
- Ensure per-customer isolation is preserved.
- Ensure protected logic is never executed when limits deny access.

## 402 Handling Guidance

- Return structured message with checkout/upgrade URL.
- Keep client retry logic idempotent and user-visible.
- Log product/plan/customer context for debugging.

## Guardrails

- Never hardcode temporary demo refs in production.
- Never skip customer identity extraction for protected endpoints.

## Troubleshooting

- 402 for every request -> wrong plan/product refs or missing customer identity.
- No paywall enforcement -> route not wrapped with `payable.http(...)`.
- Inconsistent limits -> customer reference unstable across requests.
