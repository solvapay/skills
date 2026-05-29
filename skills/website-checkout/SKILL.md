---
name: website-checkout
description: >
  Use this skill when the user wants hosted checkout on a production web app — "add checkout
  to website", "hosted checkout", "sell access on my site", "subscription page", "payment
  redirect", or "customer portal" for Next.js/React even without saying SolvaPay. Do not use
  for Lovable/Vite preview, full SDK metering, or greenfield MCP — use sibling skills instead.
metadata:
  version: "1.0.0"
compatibility: >
  Node.js >= 18.17 for npx solvapay init. Next.js fully supported; React (no Next.js) partial.
  Network required for init and hosted checkout.
---

# Website Checkout

Hosted checkout + customer portal for web apps. Server creates checkout session; browser redirects to SolvaPay; return URL refreshes access from server truth.

## Guardrails

- Never build custom card forms when hosted checkout is acceptable.
- Never expose `SOLVAPAY_SECRET_KEY` in client code.
- Always keep checkout session creation on the server.
- Always verify access state from server truth after returning from checkout.
- Always use SolvaPay naming in user-facing text.

## Gotchas

- Checkout succeeds but access unchanged → missing webhooks or stale client cache; refresh from server truth on return URL.
- React-only apps need a backend for checkout sessions — partial guidance here; full wiring → `solvapay/sdk-integration`.
- Lovable / Vite + Supabase Edge → `solvapay/lovable-checkout`, not this skill.
- Customer must exist in SolvaPay before checkout session — sync/ensure step first (details: [references/nextjs.md](references/nextjs.md)).
- JWT/session must reach server routes that create sessions (details: [references/nextjs.md](references/nextjs.md)).
- Durable access after redirect often needs webhooks, not return URL alone (details: [references/nextjs.md](references/nextjs.md)).

## Mandatory read order

- **Next.js detected** → read [references/nextjs.md](references/nextjs.md) end-to-end before generating routes.
- **React-only** → read [references/react.md](references/react.md); if no backend exists, stop and hand off to `solvapay/sdk-integration`.
- Out-of-scope flows → [references/out-of-scope.md](references/out-of-scope.md).

## Checkout procedure

1. Run `npx -y solvapay@latest init`.
2. Detect framework → load stack guide.
3. Implement server checkout-session route.
4. Implement return-URL handler + access refresh.
5. Gate premium views from server truth.
6. Run verification loop.

## Verification loop

1. Run stack-specific dev flow.
2. Happy-path hosted checkout (redirect → return URL → access granted).
3. Failure path (declined payment or unauthorized access check).
4. Verify server-side access matches UI after return.
5. **Emit a runnable verification artifact** — copy-pasteable `curl` commands or a test script in `outputs/` (not a prose summary). Include:
   - **Happy path:** return from sandbox checkout → access check returns granted state.
   - **Failure path:** unauthenticated or declined → access remains blocked.
6. Fix and re-test until pass.

## Handoff template

```markdown
## Website checkout handoff
- **Framework:** [Next.js / React + backend]
- **Auth model:** [session / JWT / …]
- **Routes:** [checkout session / portal / access check]
- **Return URL behavior:** [post-checkout refresh path]
- **Sandbox:** [success + failure case outcomes]
- **Verification commands:**

        # Happy path — after sandbox checkout, access refresh returns granted
        curl -i -X POST http://localhost:3000/api/check-access \
          -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
          -d '{"productRef":"prd_..."}'
        # Failure path — unauthenticated checkout blocked
        curl -i -X POST http://localhost:3000/api/create-checkout-session \
          -H "Content-Type: application/json" -d '{"productRef":"prd_..."}'
```

## Task progress

- [ ] Run `npx -y solvapay@latest init`
- [ ] Detect framework and read stack guide
- [ ] Implement server checkout session route
- [ ] Implement customer portal session route
- [ ] Implement return-URL handler + access refresh
- [ ] Gate premium views from server truth
- [ ] Run verification loop until pass and emit runnable curl/test artifact

## Stack support

- **Next.js:** [references/nextjs.md](references/nextjs.md)
- **React (no Next.js):** [references/react.md](references/react.md)
