# Create a Paid MCP App

Build a SolvaPay-monetized MCP server. Two input modes share the same destination (paywalled tools on Cloudflare Workers): **from-openapi** auto-generates the server from an OpenAPI / Swagger spec, **from-scratch** lets you hand-write tools.

## Scope

This skill covers **any MCP server whose tools return text or `structuredContent`** — data, intelligence and analytics, search and retrieval, integrations with external APIs, actions and workflows, computations, content generation. Domain-agnostic.

The only UI this skill ships is SolvaPay's built-in checkout / account / topup widget, which mounts only when the user deliberately invokes an intent tool (`upgrade` / `topup` / `manage_account`). If you also want custom graphical widgets for your own tools, use this skill for the server + paywall wiring and add the MCP Apps UI guidance at [../sdk-integration/mcp-server/guide.md](../sdk-integration/mcp-server/guide.md) and [../sdk-integration/react/guide.md](../sdk-integration/react/guide.md) — the two compose.

## Confirmation level (G0 — ask once, applies to the whole flow)

Before any other gate, ask the user how chatty you should be. This is **G0** in the gate reference. See [hitl-conventions.md](hitl-conventions.md) for the structured-question contract, level semantics, and the full gate index.

> "How chatty should I be? `standard` (default) confirms each big decision; `auto` only confirms irreversible steps (scaffold, deploy, go-live); `chatty` reviews every intent and file."

Once the user picks, remember it for the rest of the flow. Every downstream gate (`G1`–`G9`) decides whether to fire based on this level.

## First-decision routing (before any scaffold)

Run this gate before reading further. Picking the wrong branch is the most expensive mistake an agent can make in this skill — scaffolding into an existing project clobbers files; scaffolding into the wrong directory of a multi-package repo means later cleanup.

### Detect existing project

A "paid-MCP project" is a directory that has **all** of:

- `package.json` with `@solvapay/mcp` (or `@solvapay/server`) in `dependencies`.
- `wrangler.jsonc` or `wrangler.toml`.
- `src/worker.ts` (or similar entrypoint) that calls `createSolvaPayMcpFetch` / `createSolvaPayMcpServer`.

If those exist, **do not scaffold**. Skip ahead to:

1. Add new paid tools per [from-scratch/scaffold-and-extend.md](from-scratch/scaffold-and-extend.md).
2. Run `npm run dev` (widget watch + `wrangler dev` together) and verify with `node scripts/verify.mjs http://localhost:8787`.
3. Deploy with `npm run deploy` per [hosting/cloudflare.md](hosting/cloudflare.md).

### Greenfield routing

If no paid-MCP project is present:

| Situation | Path |
| --- | --- |
| Human at a terminal, no spec — wants a working server with one placeholder tool | `npm create solvapay@latest <name> -- --type mcp` (asks "spec? y/n", picks from-scratch on `n`). |
| Human at a terminal, has an OpenAPI / Swagger URL or file | `npm create solvapay@latest <name> -- --type mcp --openapi <url-or-path>` (one-to-one mode). |
| Agent, has a spec | **Always the agent path** — [from-openapi/guide.md](from-openapi/guide.md), using `scripts/describe.mjs` + `scripts/scaffold.mjs` with a hand-authored `selections.json`. The published CLI only emits one-to-one tools and cannot author intent-driven dispatchers (those require the LLM). One-to-one is still available via `"mode": "one-to-one"` in `selections.json` when clustering isn't worth it. |
| Agent, no spec, hand-writing tools | [from-scratch/guide.md](from-scratch/guide.md) — `npm create solvapay@latest <name> -- --type mcp --no-openapi` for the scaffold, then add tools by hand. |

### Inside an unrelated app repo

If the cwd is inside a repo that already has its own purpose (a Next.js app, a backend service, a monorepo) **and** there is no paid-MCP server in scope, **stop and ask the user where the MCP server should live** before scaffolding. The MCP server is its own deployable unit (its own `wrangler.jsonc`, its own dependencies) — it does not belong at the app's root by default.

Reasonable defaults to suggest:

- A sibling directory (`../my-app-mcp`) for repos that are a single deployable.
- A subdirectory under `apps/` or `packages/` for a monorepo.

Do not silently scaffold into `./mcp/` or `./solvapay-mcp/` without confirming.

## Pre-read (required)

Read [tool-design.md](tool-design.md) before writing any tool. It covers the three response modes (silent / nudge / gate), intent composition with the recovery tools, annotations, and the rule that payable tools return data for the host to render — not iframes. Both input modes route through this.

## Guardrails

Inherited by both input modes; `from-openapi/` and `from-scratch/` no longer repeat them.

- Never expose `SOLVAPAY_SECRET_KEY` to client code, public env vars, or deploy-time plaintext. Upload via `npx wrangler secret put` and keep it in a gitignored `.env` only for local dev.
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
| I am hand-writing tools — new project | [from-scratch/guide.md](from-scratch/guide.md) |
| I am adding SolvaPay to an MCP server that already exists | [existing-server/guide.md](existing-server/guide.md) |

If the user has a REST API but no spec yet, the OpenAPI flow can still help — `from-openapi/guide.md` opens with a "no spec yet" branch that walks the upstream API into one. Default to OpenAPI when in doubt; the spec-first path produces a typed server with less hand-coding.

### Human-driven shortcut: `npm create solvapay@latest -- --type mcp`

For users at a terminal (not inside an agent), point them at the published scaffolder before diving into the agent-only modules. The `@latest` suffix forces npm to re-resolve the registry every run, so the user always picks up the freshest scaffolder without manually clearing the npx cache:

```bash
npm create solvapay@latest my-mcp -- --type mcp                              # interactive: asks spec? y/n
npm create solvapay@latest my-mcp -- --type mcp --openapi <url-or-path>   # from-openapi (one-to-one mode)
npm create solvapay@latest my-mcp -- --type mcp --no-openapi              # from-scratch with placeholder tool
```

The CLI ships with both modes, runs the project-local `npm install`, and invokes `solvapay init` for browser auth + product picker in one pass. Use it when the user is invoking SolvaPay from a shell rather than from an LLM. Intent-driven mode (one MCP tool spanning multiple upstream operations) is intentionally only available via the agent path below — it needs an LLM to author the resulting `src/tools/*.ts` files.

## Hosting

Cloudflare Workers is the recommended default and the only host with inline templates in this skill. Confirm:

> "Deploy to Cloudflare Workers? It's the recommended path. If you need a different host (Supabase Edge, Deno, Bun, Node/Express), we'll point at the right SDK subpath and platform docs."

| Choice | Route to |
| --- | --- |
| Cloudflare Workers (default, recommended) | [hosting/cloudflare.md](hosting/cloudflare.md) |
| Anything else | [hosting/alternatives.md](hosting/alternatives.md) |

The OpenAPI flow targets Cloudflare end-to-end; the from-scratch flows reference [hosting/cloudflare.md](hosting/cloudflare.md) for templates and route to [hosting/alternatives.md](hosting/alternatives.md) only when the user explicitly wants a non-Cloudflare host.

## SolvaPay credentials

Both modes call [solvapay-init.md](solvapay-init.md) after scaffold to populate `SOLVAPAY_SECRET_KEY` (via `npx -y solvapay@latest init` browser auth) and `SOLVAPAY_PRODUCT_REF` (via interactive product picker). Read that file once you have a scaffolded project.

If the SolvaPay product doesn't exist yet, ask the user to create one in SolvaPay Console (https://app.solvapay.com) before init.

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
