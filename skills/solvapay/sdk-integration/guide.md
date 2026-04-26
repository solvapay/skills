# SDK Integration Guide

Implement SolvaPay SDK integration with stack-specific guides and shared references.

## Contents

- Stack detection and selection
- Clarifying questions
- Implementation order
- Stack-specific guides
- Shared references
- Verification and troubleshooting
- Guardrails
- Handoff output

## Stack Detection Rules

Detect stack from `package.json`:

- `next` dependency present -> follow [nextjs/guide.md](nextjs/guide.md)
- `react` present and `next` absent -> follow [react/guide.md](react/guide.md) plus backend contract
- `express` present -> follow [express/guide.md](express/guide.md)
- `@modelcontextprotocol/*` present -> follow [mcp-server/guide.md](mcp-server/guide.md)
- `supabase/functions/` directory exists OR `@supabase/supabase-js` present without `next`/`express` -> follow [supabase-edge/guide.md](supabase-edge/guide.md)
- Deno project without Node framework -> follow [supabase-edge/guide.md](supabase-edge/guide.md)
- If multiple match, ask which runtime is primary for paid operations.
- If React + Supabase but unsure about backend: "Does the project already have a Next.js backend, or is the backend entirely on Supabase Edge Functions?"

## When To Ask Clarifying Questions

Ask one question if any of these are missing:

- hosted checkout vs embedded payment intent preference
- auth system (Supabase, custom JWT, session auth)
- monetization model (purchase gate vs usage limits vs both)
- target runtime for protected operations (edge vs node)

## Implementation Order

1. Run `npx solvapay init` to authenticate and install base SDK packages.
2. Confirm product exists with required plans in SolvaPay Console.
3. Implement customer identity mapping from your auth layer.
4. Add paywall/checkout flow.
5. Add webhook handling for source-of-truth updates.
6. Validate in sandbox before go-live.

## Stage 1: Setup

- Run `npx solvapay init` to authenticate, set `SOLVAPAY_SECRET_KEY` in `.env`,
  add `.env` to `.gitignore`, and install base packages:
  `@solvapay/server`, `@solvapay/core`, `@solvapay/auth`.
- Install additional stack-specific packages not covered by init (for example
  `@solvapay/next`, `@solvapay/react`, `@solvapay/react-supabase`).
- Use manual package installation only as a fallback when CLI setup cannot run
  (for example CI images or restricted build environments).
- Confirm server-side secret handling (`SOLVAPAY_SECRET_KEY` only on server).
- Ensure product and plan references are available before coding UI gates.

### Docs Discovery Hints

- Topics: `typescript sdk intro`, `installation`, `quick start`, `core concepts`.
- Retrieval hint: resolve these topics via MCP search first, fallback to `llms.txt` index scan.

## Stage 2: Auth and Customer Mapping

- Map authenticated user identity to stable SolvaPay customer reference.
- For JWT/session auth, ensure customer identity is extracted in server middleware/handler.
- Add customer sync/ensure step before checkout or limits checks.

### Docs Discovery Hints

- Topics: `custom auth`, `nextjs auth middleware`, `customer`.
- Retrieval hint: search guides first, then API customer endpoints if implementation details are needed.

## Stage 3: Paywall and Checkout

- Choose hosted checkout by default.
- Use limits checks for metered flows and checkout session for upgrade path.
- Return actionable errors (401/402) with upgrade guidance or checkout URL.
- For free or credit-based plans, use `activatePlan` as an alternative to checkout.
- For post-purchase lifecycle management, use `cancelRenewal` and `reactivateRenewal`.
- For plan switching, call `activatePlan` with a different plan — the old purchase is automatically expired.

### Docs Discovery Hints

- Topics: `checkout sessions`, `customer sessions`, `limits`, `usage`, `purchase management`, `activate plan`.
- Retrieval hint: resolve API reference pages for exact request/response shapes.

## Stage 4: Webhooks and Sync

- Add webhook endpoint with signature verification.
- Process purchase/payment events idempotently.
- Keep local access state and billing state in sync.
- See [webhooks.md](webhooks.md) for implementation patterns.

### Docs Discovery Hints

- Topics: `webhooks`, `verify signature`, `purchase events`, `payment events`.

## Stage 5: Sandbox Verification

- Validate one successful paid path.
- Validate one failure path (unauthorized, limit exceeded, or declined payment).
- Capture runbook notes for go-live (keys, endpoints, verification status).

### Docs Discovery Hints

- Topics: `test in sandbox`, `go live`, `testing`, `error handling`.

## Stack Guides

- **Next.js**: [nextjs/guide.md](nextjs/guide.md)
- **React**: [react/guide.md](react/guide.md)
- **Express**: [express/guide.md](express/guide.md)
- **MCP Server**: [mcp-server/guide.md](mcp-server/guide.md)
- **Supabase Edge Functions**: [supabase-edge/guide.md](supabase-edge/guide.md)

## Shared References

- [reference.md](reference.md) -- package map, common API operations, payload templates
- [webhooks.md](webhooks.md) -- signature verification, event handling, idempotency

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code or public env vars.
- Never build custom card collection if hosted checkout satisfies requirements.
- Always prefer official SolvaPay SDK helpers over ad-hoc raw HTTP calls.
- Always confirm product and plan references exist before wiring UI.
- Always keep paywall checks server-side or tool-handler-side (never browser-only).
- Always include a failure-path test in sandbox before calling implementation complete.
- Never rely on SDK repo examples as required source material.
- Never treat UI unlock state as authoritative without server-side checks.

## Verification Loop

1. Run stack-specific dev flow.
2. Execute one happy-path purchase/paywall request.
3. Trigger one failure path (exceeded limit or unauthorized request).
4. Verify logs + returned checkout URL/message.
5. Fix and re-test before adding more features.

## Troubleshooting Triggers

- 401 everywhere -> auth extraction/middleware likely broken.
- 402 never appears -> limits/product/plan mapping likely incorrect.
- Checkout succeeds but access unchanged -> missing webhook or stale access cache.
- Signature failures in webhook endpoint -> wrong secret or raw body parsing issue.

## Handoff Output

When this domain completes, provide:

- selected stack and runtime
- implemented operations (checkout, customer portal, limits, usage, webhooks)
- environment variables used
- verified test outcomes (happy path and failure path)

## Task Progress

- [ ] Detect stack and runtime
- [ ] Wire SDK packages and env vars
- [ ] Implement checkout/paywall flow
- [ ] Add auth-aware customer mapping
- [ ] Add webhook handling if needed
- [ ] Verify with sandbox tests
