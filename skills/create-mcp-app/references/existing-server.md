# Add SolvaPay to an existing MCP server

Add SolvaPay paywall + intent tools + OAuth bridge to an MCP server that already exists. Low-level wiring is in [mcp-server-wiring.md](mcp-server-wiring.md); this guide audits your server first.

## When to read this

- You have an MCP server you control (any runtime, any transport) and want to add a SolvaPay paywall.
- Your server was built directly on `@modelcontextprotocol/sdk` or an MCP-compatible framework — **not** via `npm create solvapay@latest`.
- If you want to scaffold a new paid MCP server from an OpenAPI spec, stop and route to [from-openapi/guide.md](from-openapi/guide.md).
- If you want to scaffold a new paid MCP server by hand (no spec), stop and route to [from-scratch/guide.md](from-scratch/guide.md).

## Contents

- Prerequisites
- Audit
- Pre-read
- Pick your entrypoint
- Wire the paywall
- Apply the intent-driven audit to existing tools
- Optional: embed the SolvaPay widget
- Verification
- Task progress

## Prerequisites

- A running MCP server you control, built on `@modelcontextprotocol/sdk` or an MCP-compatible framework.
- Ability to add a dependency (`@solvapay/mcp` + `@solvapay/server`) and edit the HTTP entrypoint.
- SolvaPay account with a secret key (`sk_...`) and a product ref (`prd_...`). If the product doesn't exist yet, pause and ask the user to create one in SolvaPay Console (https://app.solvapay.com).

## Audit

Answer these before writing code:

1. **Runtime** — Node, Cloudflare Workers, Deno, Supabase Edge Functions, Bun, something else?
2. **Transport** — stateless JSON (fetch-first), streaming HTTP (session-pinned), stdio, or a custom transport?
3. **Auth story** — does the server already authenticate users? If yes, how (OAuth, API keys, JWT)? If no, users will authenticate via SolvaPay's hosted OAuth.
4. **Tool count and shape** — how many tools, and how many of them are "paid" (metered / subscription-gated) vs unauthenticated?
5. **Paywall today** — is there any existing paywall / rate-limit / usage-metering logic? If yes, plan to retire it and let `registerPayable` own gating.
6. **Widget needs** — do you only need the SolvaPay checkout / account / topup widget (the default), or do you also want to ship custom graphical widgets for your own tools?

## Pre-read

Read [tool-design.md](tool-design.md) before wrapping any existing tool. It covers the three response modes, intent composition, the `_meta.ui.resourceUri` rule, and how `registerPayable` handles gate narration automatically — none of which you'll infer from your existing code.

## File layout convention

When you add or wrap a tool, put it in its own file under `src/tools/<intent>.ts`, exporting a `register<Intent>(ctx, env)` function — even if it's the first tool in the project. The aggregator at `src/tools/index.ts` only imports and calls those register functions; it should not contain handler bodies.

```ts
// src/tools/manage_pet.ts
import type { AdditionalToolsContext } from '@solvapay/mcp'
export function registerManagePet(ctx: AdditionalToolsContext, env: Env) {
  ctx.registerPayable('manage_pet', { title, description, schema, handler })
}
```

```ts
// src/tools/index.ts
import { registerManagePet } from './manage_pet'
export function registerTools(ctx: AdditionalToolsContext, env: Env) {
  registerManagePet(ctx, env)
}
```

**Why**: each intent owns its narration, schema, and handler — keeping them isolated makes it cheap to retire one, swap response shape, or grep for who calls upstream. Inlining the handler in `index.ts` blocks all of that and bloats the aggregator into a god-file the moment you add a second tool. The same convention is used by [from-openapi/intent-driven.md](from-openapi/intent-driven.md); existing-server flows should match.

## Pick your entrypoint

Match your runtime to the right `@solvapay/mcp` subpath:

| Runtime | Subpath | Factory |
| --- | --- | --- |
| Cloudflare Workers, Deno, Supabase Edge, Bun, any fetch-first | `@solvapay/mcp/fetch` | `createSolvaPayMcpFetch` |
| Framework-neutral / custom transport | `@solvapay/mcp` | `createSolvaPayMcpServer` |

See [hosting/alternatives.md](hosting/alternatives.md) for the full matrix with platform docs links.

## Cloudflare Workers: env bindings are per-request, not module-scope

On Cloudflare Workers, secrets and vars arrive as `env.*` bindings inside the `fetch()` handler — they are **not** available at module scope. Do **not** call `createSolvaPay(...)` or read `env.SOLVAPAY_SECRET_KEY` at the top level of your worker module; it will be `undefined`.

The correct pattern is the lazy-cached handler used in the scaffold template:

```ts
let cachedHandler: ((req: Request) => Promise<Response>) | undefined

function getHandler(env: Env) {
  if (cachedHandler) return cachedHandler
  cachedHandler = createSolvaPayMcpFetch({
    solvaPay: createSolvaPay({ apiKey: env.SOLVAPAY_SECRET_KEY }),
    // ...
  })
  return cachedHandler
}

export default { fetch: (req, env) => getHandler(env)(req) }
```

This initialises `createSolvaPay` once per isolate (not once per request), reading `env.*` safely. **This constraint is Cloudflare Workers-specific** — on Node, Bun, or Deno, reading `process.env` / `Deno.env` at module scope is fine.

## Wire the paywall

Follow [mcp-server-wiring.md](mcp-server-wiring.md) for:

- Installing `@solvapay/mcp` + `@solvapay/server`
- Initializing `createSolvaPay` with your secret key
- Calling the matching factory (`createSolvaPayMcpFetch` / `createSolvaPayMcpServer`)
- Mounting the OAuth bridge (`/oauth/*` + `/.well-known/*`)
- Wrapping handlers with `payable.mcp()` / `registerPayable(...)`
- Resolving customer identity from the bearer token

That reference is the source of truth for the low-level API; this guide adds the scenario-specific concerns below.

## Apply the intent-driven audit to existing tools

For each existing tool, decide:

- **Is it paid?** If yes, re-register via `registerPayable(...)` (inside `additionalTools`) or wrap with `solvaPay.payable({product}).mcp(handler)`. Remove any custom rate-limit / quota logic — `registerPayable` handles gating and usage tracking.
- **Is it read-only?** Default `{ readOnlyHint: true, openWorldHint: true }` is usually correct. Add `idempotentHint: true` for pure queries.
- **Is it state-mutating?** Set `readOnlyHint: false`, `destructiveHint: true`.
- **Is it UI-only?** Add it to `hideToolsByAudience: ['ui']` so text-only hosts don't see it.
- **Is it a replacement for SolvaPay's recovery flows?** If you have a custom `upgrade` / `topup` / `manage_account`, remove it — the SolvaPay factory ships these for free.

Apply the response-mode contract from [tool-design.md](tool-design.md): tools return `ctx.respond(payload, { text: narration })` on success, and `registerPayable` emits the text-only gate narration on exhaustion automatically. Do not hand-roll a paywall response.

## Optional: embed the SolvaPay widget

If you want the checkout / account / topup iframe to mount when users invoke intent tools (recommended on hosts with iframe support — Claude Desktop, ChatGPT Apps, MCP Inspector), ship the widget HTML alongside your server and pass `resourceUri` + `readHtml` to the factory.

The widget itself is runtime-agnostic. Use the inline templates from [hosting/cloudflare/](hosting/cloudflare/) for:

- `src/mcp-app.tsx` — the React entry
- `mcp-app.html` — the HTML shell
- `src/assets.d.ts` — the `*.html` module declaration
- `vite.config.ts` — the widget build pipeline

Adapt the asset-loading pattern (Wrangler Text module rule on Workers) to your runtime — on Node, import the HTML as a string at build time; on Supabase Edge, bundle the HTML and read it with `Deno.readTextFile`. The widget renders only when the user deliberately invokes an intent tool; it is not a gate surface.

If you don't want an embedded widget, skip this section entirely — the text-only paywall narration is fully functional on text-only hosts (CLI, terminal-based MCP clients).

## Verification

Use the checklist from [mcp-server-wiring.md](mcp-server-wiring.md), plus:

- Existing paid tools return data on success via `ctx.respond(payload, { text: narration })`.
- Existing paid tools return a text-only gate narration (no iframe) when the customer is out of balance.
- Intent tools (`upgrade`, `topup`, `manage_account`) mount the widget when deliberately invoked.
- Any pre-existing paywall / rate-limit / quota logic has been removed (`registerPayable` is the sole gating mechanism).
- `hideToolsByAudience: ['ui']` is set if any host in your traffic is text-only.

## Task progress

- [ ] Complete audit (runtime, transport, auth, tool count, paywall-today, widget needs)
- [ ] Read [tool-design.md](tool-design.md)
- [ ] Pick the right `@solvapay/mcp` subpath
- [ ] Install deps and follow [mcp-server-wiring.md](mcp-server-wiring.md)
- [ ] Re-register paid tools via `registerPayable` / `payable.mcp`; remove custom gating
- [ ] Wire `hideToolsByAudience: ['ui']`
- [ ] Optional: embed the widget for intent tools
- [ ] Verify success + gate paths in sandbox
