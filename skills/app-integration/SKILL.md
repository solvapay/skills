---
name: app-integration
description: >
  Load when SolvaPay functionality needs to be coded into an existing app, API, or website. Handles:
  hosted checkout (user clicks subscribe or upgrade → server creates a SolvaPay checkout session →
  browser redirects to SolvaPay's hosted payment page → returns with access unlocked) and the
  customer portal to manage, upgrade, or cancel a plan; billing UI (buttons, plan status, React
  components) in React dashboards and web apps; paywalls, access gates, or usage limits on routes
  or handlers; SolvaPay fetch handler or webhook setup; selling API calls to agents; SDK
  integration across Next.js, React, Express, Supabase edge functions, Python (FastAPI, Starlette,
  `pyproject.toml`) and Go (`net/http`, `go.mod`) backends. Skip for any MCP server work (new or
  existing — use `solvapay/create-mcp-app`).
metadata:
  version: "1.3.0"
compatibility: >
  Node.js >= 22 (the SolvaPay CLI, in every language). Supports
  Next.js, React, Express, Supabase Edge Functions, Python >= 3.10 (Starlette, FastAPI) and
  Go >= 1.26 (net/http). Supabase CLI when using edge path. Network required for init and
  hosted checkout.
---

# App integration

Add SolvaPay hosted checkout, customer portal, paywalls, usage, webhooks and billing UI to an existing app, API or website. Backends in TypeScript / JavaScript, Python (Starlette, FastAPI) or Go (`net/http`); billing UI in React, which can call a backend in any of the three.

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
- Always run `npx -y solvapay@latest doctor` before handoff, and before reporting a SolvaPay bug. It checks the SDK in every language it finds (`@solvapay/*` packages, the `solvapay` pin in `uv.lock` / `poetry.lock` / `requirements.txt`, `github.com/solvapay/solvapay-sdk/go` in `go.mod`). When the check fails, run the upgrade command it prints (exact pins), then re-run the project's tests. An app keeps whatever SDK it was set up with; a stale one ships bugs that are already fixed, and `^0.x` ranges never reach the next minor.
- Always take the customer from your app's verified auth (session, token, framework dependency). Never from a request body, query string or `x-user-id` header.

## Gotchas

- `@solvapay/next` route wrappers return `Promise<NextResponse>` — update call sites (details: [references/nextjs.md](references/nextjs.md)).
- Webhook signature verification needs the **raw request body**, not parsed JSON (details: [references/WEBHOOKS.md](references/WEBHOOKS.md); Python and Go in their stack guides).
- FastAPI dependencies don't run for the mounted `solvapay.web.routes()` app: call the function behind `Depends(...)` from `get_user` (details: [references/python.md](references/python.md)).
- Deno import maps need trailing slashes on `@solvapay/` entries (details: [references/supabase-edge.md](references/supabase-edge.md)).
- Customer must exist in SolvaPay before a checkout session — sync/ensure step first (details: [references/hosted-checkout-nextjs.md](references/hosted-checkout-nextjs.md)).
- Checkout succeeds but access unchanged → missing webhooks or stale client cache; refresh from server truth on the return URL. Durable access after redirect usually needs webhooks, not the return URL alone.
- React without a server framework still needs a backend for checkout sessions and secret operations (details: [references/hosted-checkout-react.md](references/hosted-checkout-react.md)).
- Billing UI components do not grant access — server truth only.
- Any MCP server (greenfield, existing, factory wrap) → `solvapay/create-mcp-app`. Billing UI inside an MCP host app also belongs there.

## Docs source

Facts (signatures, plan fields, endpoints) come from the docs, not from memory: SolvaPay Docs MCP (`https://docs.solvapay.com/mcp`, HTTP transport, no auth) → https://docs.solvapay.com/llms.txt → direct page fetch.

## Mandatory read order

1. Stack guide from [Stack detection](#stack-detection) (read end-to-end before coding). For hosted checkout only, the hosted-checkout guide for the stack is enough.
2. [references/operations.md](references/operations.md) before authoring API calls beyond checkout and portal sessions.
3. [references/WEBHOOKS.md](references/WEBHOOKS.md) when user mentions webhooks or post-checkout sync.
4. [references/env-and-init.md](references/env-and-init.md) for init and env setup.

## Stack detection

From the project's manifest and layout. Markers match the SolvaPay CLI: `go.mod` → Go; `uv.lock`, `poetry.lock`, `pyproject.toml` or `requirements.txt` → Python; `package.json` → TypeScript / JavaScript. A repo with a React frontend and a Python or Go backend matches two rows: use both (React guide for the UI, the backend's guide for the server).

| Stack | Hosted checkout only | Full SDK integration |
| --- | --- | --- |
| `next` | [references/hosted-checkout-nextjs.md](references/hosted-checkout-nextjs.md) | [references/nextjs.md](references/nextjs.md) |
| `react` without `next` | [references/hosted-checkout-react.md](references/hosted-checkout-react.md) | [references/react.md](references/react.md) |
| `express` | [references/hosted-checkout-react.md](references/hosted-checkout-react.md) (backend skeleton) | [references/express.md](references/express.md) |
| `supabase/functions/` or Supabase without Next/Express (incl. Vite + Supabase) | [references/supabase-edge.md](references/supabase-edge.md) | [references/supabase-edge.md](references/supabase-edge.md) |
| `pyproject.toml` / `requirements.txt` with `fastapi` or `starlette` | [references/python.md](references/python.md) (Hosted checkout section) | [references/python.md](references/python.md) |
| `go.mod` with a `net/http` server (or a router that takes an `http.Handler`) | [references/go.md](references/go.md) (Hosted checkout section) | [references/go.md](references/go.md) |
| Python on Django or Flask, Go on a framework without `http.Handler` | say these guides cover Starlette / FastAPI and `net/http` only; ask before adapting | |
| `@modelcontextprotocol/*`, `@solvapay/mcp`, `mcp` (Python), `github.com/modelcontextprotocol/go-sdk`, or an MCP server in scope | stop, hand off to `solvapay/create-mcp-app` | |

Selling API calls to AI agents that pay per call (preview, any language): [references/agent-payments.md](references/agent-payments.md).

If multiple match, ask which runtime is primary. If the request is only "add checkout / upgrade / subscribe" with no paywall, metering or webhook work, take the hosted-checkout column.

## Integration procedure

1. Detect the stack from the manifest ([Stack detection](#stack-detection)).
2. Run `npx -y solvapay@latest init` with the language: `--language ts|python|go` (always pass it for Python and Go, and when two languages share the folder). Python with plain pip: init only prints the `pip install` line; run it yourself.
3. Read the matching guide end-to-end.
4. Hosted checkout: implement the server checkout-session route, the customer-portal session route, the return-URL handler with access refresh, and gate premium views from server truth.
5. Full SDK: read [references/operations.md](references/operations.md) before API calls, then wire paywall / limits / usage per stack patterns.
6. If webhooks needed → read [references/WEBHOOKS.md](references/WEBHOOKS.md) first.
7. Run verification loop.

## Env plan-validate-execute

1. **Plan:** List required env vars (`SOLVAPAY_SECRET_KEY`, product refs, webhook secret).
2. **Validate:** Run `node scripts/check-env.mjs` — no secrets in `NEXT_PUBLIC_*` / `VITE_*`. In a Python or Go project with no `package.json` it skips the Next/Vite config scan, checks only the env files and says so in `note`.
3. **Execute:** Implement routes.

## Verification loop

1. Run `npx -y solvapay@latest doctor`. Every check must pass, including `@solvapay/*` versions.
2. Run stack-specific dev flow.
3. Happy path: hosted checkout redirect → return URL → access granted, or purchased customer → 200 from a protected route.
4. Failure path: unauthenticated (401), declined payment, no purchase or over limit (402 with `checkoutUrl`).
5. Verify server-side access matches UI after return; verify logs + checkout URL / error message.
6. **Emit a runnable verification artifact** — copy-pasteable `curl` commands or a test script in `outputs/` (not a prose summary) covering the happy path and one failure path.
7. Fix and re-test until pass.

## Handoff template

```markdown
## Integration handoff
- **Stack:** [Next.js / Express / React + backend (TS / Python / Go) / Supabase Edge / FastAPI / Starlette / Go net/http]
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

- [ ] Detect the stack from the manifest and pick hosted-checkout-only or full SDK
- [ ] Run `npx -y solvapay@latest init --language <ts|python|go>`
- [ ] Read the matching guide end-to-end
- [ ] Hosted checkout: checkout session route, portal session route, return-URL refresh, server-truth gating
- [ ] Full SDK: read operations reference, then wire paywall / limits / usage routes
- [ ] If webhooks → read WEBHOOKS.md and implement handler
- [ ] Run verification loop (happy + failure path) and emit runnable curl/test artifact

## References

- Hosted checkout, Next.js: [references/hosted-checkout-nextjs.md](references/hosted-checkout-nextjs.md)
- Hosted checkout, React + backend: [references/hosted-checkout-react.md](references/hosted-checkout-react.md)
- Python (Starlette, FastAPI): [references/python.md](references/python.md)
- Go (`net/http`): [references/go.md](references/go.md)
- Selling API calls to agents (preview): [references/agent-payments.md](references/agent-payments.md)
- Operations: [references/operations.md](references/operations.md)
- Env / init: [references/env-and-init.md](references/env-and-init.md)
- Managed MCP API (bootstrap / configure plans on an existing Managed MCP product): [references/mcp-product-console.md](references/mcp-product-console.md)
- Webhooks: [references/WEBHOOKS.md](references/WEBHOOKS.md)
