# Create a Paid MCP App

Build a SolvaPay-monetized MCP server. Two input modes share the same destination (paywalled tools on Cloudflare Workers): **from-openapi** auto-generates the server from an OpenAPI / Swagger spec, **from-scratch** lets you hand-write tools.

## Scope

This skill covers **any MCP server whose tools return text or `structuredContent`** — data, intelligence and analytics, search and retrieval, integrations with external APIs, actions and workflows, computations, content generation. Domain-agnostic.

The only UI this skill ships is SolvaPay's built-in checkout / account / topup widget, which mounts only when the user deliberately invokes an intent tool (`upgrade` / `topup` / `manage_account`). If you also want custom graphical widgets for your own tools, use this skill for the server + paywall wiring and add the MCP Apps UI guidance at [../sdk-integration/mcp-server/guide.md](../sdk-integration/mcp-server/guide.md) and [../sdk-integration/react/guide.md](../sdk-integration/react/guide.md) — the two compose.

## Pre-read (required)

Read [tool-design.md](tool-design.md) before writing any tool. It covers the three response modes (silent / nudge / gate), intent composition with the recovery tools, annotations, and the rule that payable tools return data for the host to render — not iframes. Both input modes route through this.

## Guardrails

Inherited by both input modes; `from-openapi/` and `from-scratch/` no longer repeat them.

- Never expose `SOLVAPAY_SECRET_KEY` to client code, public env vars, or deploy-time plaintext. Upload via `wrangler secret put` and keep it in a gitignored `.env` only for local dev.
- Never wrap SolvaPay intent tools (`upgrade`, `topup`, `manage_account`, `activate_plan`, `check_purchase`) with `payable.mcp()` — they are the paywall recovery path, not paid business logic.
- Never set `_meta.ui.resourceUri` on merchant payable tools. Hosts MUST open the iframe on every advertised call (SEP-1865), which flashes an empty widget on silent successes. `registerPayable` enforces this; do not work around it.
- Never return a custom iframe or structured UI payload on a paywall gate. Gates are **text-only** in `content[0].text` naming the recovery intent tool; the widget only mounts on deliberate intent-tool calls.
- Always use `mode: 'json-stateless'` on stateless edge runtimes (Cloudflare Workers, Deno, Supabase Edge). Isolates don't pin across requests, so in-memory sessions break.
- Always hide UI-only virtual tools from text-only hosts with `hideToolsByAudience: ['ui']`.

## Pick an input mode

Ask once:

> "Do you have an OpenAPI / Swagger document for the API you want to expose as MCP tools, or are you hand-writing the tools?"

| Answer | Route to |
| --- | --- |
| I have an OpenAPI / Swagger spec | [from-openapi/guide.md](from-openapi/guide.md) |
| I am hand-writing tools — new project | [from-scratch/new.md](from-scratch/new.md) |
| I am hand-writing tools — adding SolvaPay to an existing MCP server | [from-scratch/existing.md](from-scratch/existing.md) |

If the user has a REST API but no spec yet, the OpenAPI flow can still help — `from-openapi/guide.md` opens with a "no spec yet" branch that walks the upstream API into one. Default to OpenAPI when in doubt; the spec-first path produces a typed server with less hand-coding.

## Hosting

Cloudflare Workers is the recommended default and the only host with inline templates in this skill. Confirm:

> "Deploy to Cloudflare Workers? It's the recommended path. If you need a different host (Supabase Edge, Deno, Bun, Node/Express), we'll point at the right SDK subpath and platform docs."

| Choice | Route to |
| --- | --- |
| Cloudflare Workers (default, recommended) | [hosting/cloudflare.md](hosting/cloudflare.md) |
| Anything else | [hosting/alternatives.md](hosting/alternatives.md) |

The OpenAPI flow targets Cloudflare end-to-end; the from-scratch flows reference [hosting/cloudflare.md](hosting/cloudflare.md) for templates and route to [hosting/alternatives.md](hosting/alternatives.md) only when the user explicitly wants a non-Cloudflare host.

## SolvaPay credentials

Both modes call [solvapay-init.md](solvapay-init.md) after scaffold to populate `SOLVAPAY_SECRET_KEY` (via `npx solvapay init` browser auth) and `SOLVAPAY_PRODUCT_REF` (via interactive product picker). Read that file once you have a scaffolded project.

If the SolvaPay product doesn't exist yet, route to [../provider-onboarding/guide.md](../provider-onboarding/guide.md) before init.

## Documentation Sources

Use this preference order:

1. SolvaPay Docs MCP server: https://docs.solvapay.com/mcp
2. Docs index fallback: https://docs.solvapay.com/llms.txt
3. Direct fetch on https://docs.solvapay.com

## Handoff

When the chosen mode + host guide completes, confirm:

- Input mode (from-openapi / from-scratch) and scenario (new vs existing)
- Host (Cloudflare default, or alternative)
- `SOLVAPAY_SECRET_KEY` / `SOLVAPAY_PRODUCT_REF` / `MCP_PUBLIC_BASE_URL` set correctly
- Server responds on `/` with MCP discovery
- `/.well-known/oauth-protected-resource` + `/.well-known/oauth-authorization-server` return the expected JSON
- At least one paid tool verified in sandbox with a success path and a gate path (text-only narration, no iframe)
- Intent tool (`upgrade` or `topup`) mounts the widget when deliberately invoked

## Task progress

- [ ] Confirm scope (data-returning tools, not custom UI)
- [ ] Read [tool-design.md](tool-design.md)
- [ ] Pick input mode: OpenAPI spec vs hand-written
- [ ] Confirm host: Cloudflare (default) or alternatives
- [ ] Complete the chosen mode guide
- [ ] Run [solvapay-init.md](solvapay-init.md) to populate credentials
- [ ] Verify success + gate paths in sandbox
