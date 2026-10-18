---
name: app-integration
description: >
  Load when SolvaPay functionality needs to be coded into an existing app, API, or website. Handles:
  hosted checkout (user clicks subscribe or upgrade → server creates a SolvaPay checkout session →
  browser redirects to SolvaPay's hosted payment page → returns with access unlocked) and the
  customer portal to manage, upgrade, or cancel a plan; billing UI (buttons, plan status, React
  components) in React dashboards and web apps; paywalls, access gates, or usage limits on routes
  or handlers; SolvaPay fetch handler or webhook setup; SDK integration across Next.js, React,
  Express, and Supabase edge functions. Skip for any MCP server work (new or existing — use
  `solvapay/create-mcp-app`).
metadata:
  version: "1.1.0"
compatibility: >
  Node.js >= 20 (@solvapay/server engine). Supports Next.js, React, Express,
  Supabase Edge Functions. Supabase CLI when using edge path. Network required for init
  and hosted checkout.
---

# App integration

Add SolvaPay hosted checkout, customer portal, paywalls, usage, webhooks and billing UI to an existing TypeScript / JavaScript app, API or website.

Two entry points, same skill:

- **Hosted checkout only** — server creates a checkout session, browser redirects to SolvaPay, return URL refreshes access from server truth. Start with the hosted-checkout guide for your stack and stop there.
- **Full SDK integration** — paywalls, limits, usage events, webhooks, billing UI. Start with the stack guide, then the operations reference.

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code or public env vars.
- Never build custom card collection if hosted checkout satisfies requirements.
- Always prefer official SolvaPay SDK helpers over ad-hoc raw HTTP calls.
- Always confirm product and plan references exist before wiring UI.
- Always keep checkout session creation and paywall checks server-side or tool-handler-side.
- Always verify access state from server truth after returning from checkout.
- Always emit a **runnable** sandbox verification artifact before handoff — a `curl` block or test script covering happy path (200) and failure path (402 with `checkoutUrl`, or 401 unauthenticated). Prose summaries alone do not satisfy this guardrail.
- Never treat UI unlock state as authoritative without server-side checks.

## Gotchas

- `@solvapay/next` route wrappers return `Promise<NextResponse>` — update call sites (details: [references/nextjs.md](references/nextjs.md)).
- Webhook signature verification needs the **raw request body**, not parsed JSON (details: [references/WEBHOOKS.md](references/WEBHOOKS.md)).
- Deno import maps need trailing slashes on `@solvapay/` entries (details: [references/supabase-edge.md](references/supabase-edge.md)).
- Customer must exist in SolvaPay before a checkout session — sync/ensure step first (details: [references/hosted-checkout-nextjs.md](references/hosted-checkout-nextjs.md)).
- Checkout succeeds but access unchanged → missing webhooks or stale client cache; refresh from server truth on the return URL. Durable access after redirect usually needs webhooks, not the return URL alone.
- React without a server framework still needs a backend for checkout sessions and secret operations (details: [references/hosted-checkout-react.md](references/hosted-checkout-react.md)).
- Billing UI components do not grant access — server truth only.
- Any MCP server (greenfield, existing, factory wrap) → `solvapay/create-mcp-app`. Billing UI inside an MCP host app also belongs there.

## Mandatory read order

1. Stack guide from [Stack detection](#stack-detection) (read end-to-end before coding). For hosted checkout only, the hosted-checkout guide for the stack is enough.
2. [references/operations.md](references/operations.md) before authoring API calls beyond checkout and portal sessions.
3. [references/WEBHOOKS.md](references/WEBHOOKS.md) when user mentions webhooks or post-checkout sync.
4. [references/env-and-init.md](references/env-and-init.md) for init and env setup.

## Stack detection

From `package.json` and project layout:

| Stack | Hosted checkout only | Full SDK integration |
| --- | --- | --- |
| `next` | [references/hosted-checkout-nextjs.md](references/hosted-checkout-nextjs.md) | [references/nextjs.md](references/nextjs.md) |
| `react` without `next` | [references/hosted-checkout-react.md](references/hosted-checkout-react.md) | [references/react.md](references/react.md) |
| `express` | [references/hosted-checkout-react.md](references/hosted-checkout-react.md) (backend skeleton) | [references/express.md](references/express.md) |
| `supabase/functions/` or Supabase without Next/Express (incl. Vite + Supabase) | [references/supabase-edge.md](references/supabase-edge.md) | [references/supabase-edge.md](references/supabase-edge.md) |
| `@modelcontextprotocol/*` or `@solvapay/mcp` present | stop, hand off to `solvapay/create-mcp-app` | |

If multiple match, ask which runtime is primary. If the request is only "add checkout / upgrade / subscribe" with no paywall, metering or webhook work, take the hosted-checkout column.

## Integration procedure

1. Detect stack from `package.json`.
2. Run `npx -y solvapay@latest init`.
3. Read the matching guide end-to-end.
4. Hosted checkout: implement the server checkout-session route, the customer-portal session route, the return-URL handler with access refresh, and gate premium views from server truth.
5. Full SDK: read [references/operations.md](references/operations.md) before API calls, then wire paywall / limits / usage per stack patterns.
6. If webhooks needed → read [references/WEBHOOKS.md](references/WEBHOOKS.md) first.
7. Run verification loop.

## Env plan-validate-execute

1. **Plan:** List required env vars (`SOLVAPAY_SECRET_KEY`, product refs, webhook secret).
2. **Validate:** Run `node scripts/check-env.mjs` — no secrets in `NEXT_PUBLIC_*` / `VITE_*`.
3. **Execute:** Implement routes.

## Verification loop

1. Run stack-specific dev flow.
2. Happy path: hosted checkout redirect → return URL → access granted, or purchased customer → 200 from a protected route.
3. Failure path: unauthenticated (401), declined payment, no purchase or over limit (402 with `checkoutUrl`).
4. Verify server-side access matches UI after return; verify logs + checkout URL / error message.
5. **Emit a runnable verification artifact** — copy-pasteable `curl` commands or a test script in `outputs/` (not a prose summary) covering the happy path and one failure path.
6. Fix and re-test until pass.

## Handoff template

```markdown
## Integration handoff
- **Stack:** [Next.js / Express / React + backend / Supabase Edge]
- **Mode:** [hosted checkout only / full SDK]
- **Auth model:** [Supabase JWT / session / …]
- **Routes wired:** [checkout session / portal session / access check / paywalled routes / webhook]
- **Return URL behavior:** [post-checkout refresh path, if hosted checkout]
- **Webhooks:** [yes/no + path]
- **Sandbox:** [happy path + one failure path outcome]
- **Verification commands:**

        # Failure path (no purchase → 402 + checkoutUrl, or unauthenticated → 401)
        curl -i http://localhost:3000/api/premium/data -H "Authorization: Bearer $TOKEN"
        # Happy path (after sandbox purchase → 200)
        curl -i http://localhost:3000/api/premium/data -H "Authorization: Bearer $TOKEN"
```

## When NOT to use this skill

- Any MCP server (new or existing, including a factory wrap) → `solvapay/create-mcp-app`
- Monetizing an MCP server without code (paste a server URL in the console) → Managed MCP; for the API bootstrap of an existing Managed MCP product see [references/mcp-product-console.md](references/mcp-product-console.md)

## Scripts

| Script | Action | Purpose |
| --- | --- | --- |
| `scripts/check-env.mjs` | **Run** | Detect secret leaks in client/public env |

## Task progress

- [ ] Detect stack from package.json and pick hosted-checkout-only or full SDK
- [ ] Run `npx -y solvapay@latest init`
- [ ] Read the matching guide end-to-end
- [ ] Hosted checkout: checkout session route, portal session route, return-URL refresh, server-truth gating
- [ ] Full SDK: read operations reference, then wire paywall / limits / usage routes
- [ ] If webhooks → read WEBHOOKS.md and implement handler
- [ ] Run verification loop (happy + failure path) and emit runnable curl/test artifact

## References

- Hosted checkout, Next.js: [references/hosted-checkout-nextjs.md](references/hosted-checkout-nextjs.md)
- Hosted checkout, React + backend: [references/hosted-checkout-react.md](references/hosted-checkout-react.md)
- Operations: [references/operations.md](references/operations.md)
- Env / init: [references/env-and-init.md](references/env-and-init.md)
- Managed MCP API (bootstrap / configure plans on an existing Managed MCP product): [references/mcp-product-console.md](references/mcp-product-console.md)
- Webhooks: [references/WEBHOOKS.md](references/WEBHOOKS.md)
