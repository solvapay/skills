---
name: app-integration
description: >
  Load when SolvaPay functionality needs to be coded into an existing app or API. Handles: billing UI
  (buttons, plan status, React components) in React dashboards and web apps; paywalls, access gates,
  or usage limits on routes or handlers; SolvaPay fetch handler or webhook setup; SDK integration
  across Next.js, React, Express, and Supabase edge functions. Skip for any MCP server work (new or
  existing — use `solvapay/create-mcp-app`), Lovable checkout, or redirect-only checkout with no SDK code.
metadata:
  version: "1.0.0"
compatibility: >
  Node.js >= 18 for npx solvapay init. Supports Next.js, React, Express,
  Supabase Edge Functions. Supabase CLI when using edge path. Network required for init.
---

# App integration

Add SolvaPay paywalls, usage, webhooks and billing UI to an existing TypeScript / JavaScript app or API.

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code or public env vars.
- Never build custom card collection if hosted checkout satisfies requirements.
- Always prefer official SolvaPay SDK helpers over ad-hoc raw HTTP calls.
- Always confirm product and plan references exist before wiring UI.
- Always keep paywall checks server-side or tool-handler-side.
- Always emit a **runnable** sandbox verification artifact before handoff — a `curl` block or test script covering happy path (200) and failure path (402 with `checkoutUrl`). Prose summaries alone do not satisfy this guardrail.
- Never treat UI unlock state as authoritative without server-side checks.

## Gotchas

- `@solvapay/next` route wrappers return `Promise<NextResponse>` — update call sites (details: [references/nextjs.md](references/nextjs.md)).
- Webhook signature verification needs the **raw request body**, not parsed JSON (details: [references/WEBHOOKS.md](references/WEBHOOKS.md)).
- Deno import maps need trailing slashes on `@solvapay/` entries (details: [references/supabase-edge.md](references/supabase-edge.md)).
- Billing UI components do not grant access — server truth only.
- Any MCP server (greenfield, existing, factory wrap) → `solvapay/create-mcp-app`.

## Mandatory read order

1. Stack guide from [Stack detection](#stack-detection) (read end-to-end before coding).
2. [references/operations.md](references/operations.md) before authoring API calls.
3. [references/WEBHOOKS.md](references/WEBHOOKS.md) when user mentions webhooks or post-checkout sync.
4. [references/env-and-init.md](references/env-and-init.md) for init and env setup.

## Stack detection

From `package.json` and project layout:

- `next` → [references/nextjs.md](references/nextjs.md)
- `react` without `next` → [references/react.md](references/react.md)
- `express` → [references/express.md](references/express.md)
- `@modelcontextprotocol/*` or `@solvapay/mcp` present → stop, hand off to `solvapay/create-mcp-app`
- `supabase/functions/` or Supabase without Next/Express → [references/supabase-edge.md](references/supabase-edge.md)

If multiple match, ask which runtime is primary.

## Integration procedure

1. Detect stack from `package.json`.
2. Run `npx -y solvapay@latest init`.
3. Read matching stack guide end-to-end.
4. Read [references/operations.md](references/operations.md) before API calls.
5. Wire paywall / checkout / usage per stack patterns.
6. If webhooks needed → read [references/WEBHOOKS.md](references/WEBHOOKS.md) first.
7. Run verification loop.

## Env plan-validate-execute

1. **Plan:** List required env vars (`SOLVAPAY_SECRET_KEY`, product refs, webhook secret).
2. **Validate:** Run `node scripts/check-env.mjs` — no secrets in `NEXT_PUBLIC_*` / `VITE_*`.
3. **Execute:** Implement routes.

## Verification loop

1. Run stack-specific dev flow.
2. Happy-path purchase / paywall request.
3. Failure path (limit exceeded or unauthorized).
4. Verify logs + checkout URL / error message.
5. **Emit a runnable verification artifact** — copy-pasteable `curl` commands or a test script in `outputs/` (not a prose summary). Include both:
   - **Happy path:** authenticated + purchased → 200 from protected route.
   - **Failure path:** no purchase or over limit → 402 with `checkoutUrl`.
6. Fix and re-test until pass.

## Handoff template

```markdown
## Integration handoff
- **Stack:** [Next.js / Express / …]
- **Auth model:** [Supabase JWT / session / …]
- **Routes wired:** [list]
- **Webhooks:** [yes/no + path]
- **Sandbox:** [happy path + one failure path outcome]
- **Verification commands:**

        # Failure path (no purchase → 402 + checkoutUrl)
        curl -i http://localhost:3000/api/premium/data -H "Authorization: Bearer $TOKEN"
        # Happy path (after sandbox purchase → 200)
        curl -i http://localhost:3000/api/premium/data -H "Authorization: Bearer $TOKEN"
```

## When NOT to use this skill

- Any MCP server (new or existing, including a factory wrap) → `solvapay/create-mcp-app`
- Lovable paste-in checkout → `solvapay/lovable-checkout`
- Minimal hosted checkout only on new web app → `solvapay/website-checkout`

## Scripts

| Script | Action | Purpose |
| --- | --- | --- |
| `scripts/check-env.mjs` | **Run** | Detect secret leaks in client/public env |

## Task progress

- [ ] Detect stack from package.json
- [ ] Run `npx -y solvapay@latest init`
- [ ] Read stack guide end-to-end
- [ ] Read operations reference before API calls
- [ ] Wire paywall / checkout / usage routes
- [ ] If webhooks → read WEBHOOKS.md and implement handler
- [ ] Run verification loop (happy + failure path) and emit runnable curl/test artifact

## References

- Operations: [references/operations.md](references/operations.md)
- Env / init: [references/env-and-init.md](references/env-and-init.md)
- Managed MCP API (bootstrap / configure plans on an existing Managed MCP product): [references/mcp-product-console.md](references/mcp-product-console.md)
- Webhooks: [references/WEBHOOKS.md](references/WEBHOOKS.md)
