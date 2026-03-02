# Express SDK Guide

Use Solvapay paywall wrappers around Express business handlers.

## Docs References (Topic-Based)

- Topics: `express guide`, `limits`, `usage`, `checkout sessions`, `error handling`, `testing`.
- Retrieval hint: resolve guide topic first; pull API operation topics only when needed.

## Recommended Flow

1. Initialize Solvapay server client.
2. Create `payable` handler with product/plan configuration.
3. Wrap routes with `payable.http(...)`.
4. Pass stable customer reference from auth/header.
5. Add usage tracking and failure-path responses.

## Route Protection Pattern

Use one payable handler per pricing boundary:

```typescript
const standard = solvaPay.payable({ product: 'prd_api', plan: 'pln_standard' })
app.post('/v1/generate', standard.http(generateHandler))
```

For mixed pricing, create multiple payable handlers with distinct plans.

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
