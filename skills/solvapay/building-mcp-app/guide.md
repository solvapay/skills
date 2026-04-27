# Building an MCP App with SolvaPay

Route between "scaffold a new MCP server from scratch" and "integrate SolvaPay into an existing MCP server", with Cloudflare Workers as the default host.

## Scope

This skill covers **any MCP server whose tools return text or `structuredContent`** — data, intelligence and analytics, search and retrieval, integrations with external APIs, actions and workflows, computations, content generation, utilities, or any other domain where the output is information the host LLM (Claude, ChatGPT, Cursor, MCP Inspector, …) renders natively (chat text, artifacts, code blocks, cards). Domain-agnostic: if your tools return data, this skill applies.

The only UI this skill covers is SolvaPay's built-in checkout / account / topup widget, which mounts only when the user deliberately invokes an intent tool (`upgrade` / `topup` / `manage_account`). If you also want to ship custom graphical widgets for your own tools, use this skill for the server + paywall wiring and add the MCP Apps UI guidance at [../sdk-integration/mcp-server/guide.md](../sdk-integration/mcp-server/guide.md) and [../sdk-integration/react/guide.md](../sdk-integration/react/guide.md) for the UI surface — the two compose.

## Contents

- Guardrails
- Required pre-read
- Scenarios
- Hosting
- Handoff
- Task progress

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code, public env vars, or deploy-time plaintext. Upload it via `wrangler secret put` (or the platform equivalent) and keep it in a gitignored `.env` only for local dev.
- Never wrap SolvaPay virtual/intent tools (`upgrade`, `topup`, `manage_account`, `activate_plan`, `check_purchase`) with `payable.mcp()` — they are part of the paywall recovery path, not paid business logic.
- Never set `_meta.ui.resourceUri` on merchant payable tools. Hosts MUST open the iframe on every call when advertised (SEP-1865), which flashes an empty widget on silent successes. `registerPayable` enforces this; don't work around it.
- Never return a custom iframe or structured UI payload on a paywall gate. Gates are **text-only** in `content[0].text` naming the recovery intent tool; the widget only mounts on deliberate intent-tool calls.
- Always use `mode: 'json-stateless'` on stateless edge runtimes (Cloudflare Workers, Deno, Supabase Edge). Isolates don't pin across requests, so in-memory sessions break.
- Always hide UI-only virtual tools from text-only hosts with `hideToolsByAudience: ['ui']`.

## Required pre-read

Before writing any tool or deploying anything, read [tool-design.md](tool-design.md). It covers the three response modes (silent / nudge / gate), intent composition with the recovery tools, annotations, and the rule that payable tools return data for the host to render — not iframes.

## Scenarios

Pick one. If the user's intent is ambiguous, ask:

> "Are you starting a new MCP server from scratch, or integrating SolvaPay into an existing MCP server?"

| Scenario | Route to |
| --- | --- |
| Scaffold a new MCP server with SolvaPay baked in | [new-mcp/guide.md](new-mcp/guide.md) |
| Add SolvaPay (paywall + intent tools + OAuth bridge) to an MCP server that already exists | [existing-mcp/guide.md](existing-mcp/guide.md) |

## Hosting

Cloudflare Workers is the recommended default. Confirm before committing:

> "Deploy to Cloudflare Workers? It's the recommended path and this skill has a step-by-step with inline templates. If you need a different host (Supabase Edge, Deno, Bun, Node/Express, …) we'll point at the right SDK subpath and platform docs."

| Choice | Route to |
| --- | --- |
| Cloudflare Workers (default, recommended) | [hosting/cloudflare.md](hosting/cloudflare.md) |
| Anything else | [hosting/alternatives.md](hosting/alternatives.md) |

## Documentation Sources

Use this preference order:

1. SolvaPay Docs MCP server: https://docs.solvapay.com/mcp
2. Docs index fallback: https://docs.solvapay.com/llms.txt
3. Direct fetch on https://docs.solvapay.com

## Handoff

When the chosen scenario + host guide completes, confirm:

- Scenario (new vs existing) and host
- `SOLVAPAY_SECRET_KEY` / `SOLVAPAY_PRODUCT_REF` / `MCP_PUBLIC_BASE_URL` set correctly
- Server responds on `/` with MCP discovery
- `/.well-known/oauth-protected-resource` + `/.well-known/oauth-authorization-server` return the expected JSON
- At least one paid tool verified in sandbox with a success path and a gate path (text-only narration, no iframe)
- Intent tool (`upgrade` or `topup`) mounts the widget when deliberately invoked

## Task progress

- [ ] Confirm scope (data-returning tools, not custom UI)
- [ ] Read [tool-design.md](tool-design.md)
- [ ] Pick scenario: new vs existing MCP
- [ ] Confirm host: Cloudflare (default) or alternatives
- [ ] Complete the chosen scenario + host guide
- [ ] Verify success + gate paths in sandbox
