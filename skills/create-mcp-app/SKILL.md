---
name: create-mcp-app
description: >
  Create or scaffold a SolvaPay-monetized MCP server on Cloudflare Workers — from
  OpenAPI / Swagger or from scratch. Use when the user says "create mcp app",
  "scaffold mcp", "new mcp server", "openapi to mcp", "wrap rest api as mcp",
  "npm create solvapay", or wants a greenfield paid MCP worker. For humans at
  a terminal, point to `npm create solvapay@latest my-mcp -- --type mcp`. For agents,
  use describe.mjs + scaffold.mjs (intent-driven clustering requires an LLM).
metadata:
  version: "1.0.0"
compatibility: >
  Designed for Cloudflare Workers. Requires Node.js >= 20 and npm. Alternative hosts
  (Supabase Edge, Deno, Bun, Node + Express) covered in references/hosting/alternatives.md.
---

# Create a Paid MCP App

A SolvaPay-monetized MCP server on Cloudflare Workers. Two input modes share the same destination: OpenAPI auto-generation, or hand-written tools.

> **Human at a terminal?** Fastest path: `npm create solvapay@latest <name> -- --type mcp` (or `pnpm`/`yarn create solvapay@latest`). The `@latest` suffix forces npm to re-resolve the registry every run so you always get the freshest scaffolder. Ships from-openapi (one-to-one) and from-scratch modes, runs install + `solvapay init` in one pass.
>
> **Agent (Claude / Cursor / etc.)?** Use the agent path: `scripts/describe.mjs` + `scripts/scaffold.mjs` per [references/from-openapi/guide.md](references/from-openapi/guide.md). It owns intent-driven clustering, per-operation curation, and hand-tuned narration — none of which the CLI exposes. The CLI cannot author `src/tools/*.ts` because that authoring step requires an LLM.

## Scope

This skill covers **any MCP server whose tools return text or `structuredContent`** — data, intelligence and analytics, search and retrieval, integrations with external APIs, actions and workflows, computations, content generation. Domain-agnostic.

The only UI this skill ships is SolvaPay's built-in checkout / account / topup widget, which mounts only when the user deliberately invokes an intent tool (`upgrade` / `topup` / `manage_account`). If you also want custom graphical widgets for your own tools, use this skill for the server + paywall wiring and add the MCP Apps UI guidance from the [`sdk-integration`](../sdk-integration/SKILL.md) skill (MCP Server + React references) — the two compose.

## Mandatory read order

Before writing any tool code, load these files in order:

1. This SKILL.md — routing decision (existing project vs greenfield, input mode, host).
2. [references/tool-design.md](references/tool-design.md) — the response-mode contract, gate rules, `registerPayable` shape.
3. Exactly one input-mode guide: [references/from-openapi/guide.md](references/from-openapi/guide.md) **or** [references/from-scratch/guide.md](references/from-scratch/guide.md) **or** [references/existing-server.md](references/existing-server.md).
4. **If intent-driven mode (OpenAPI):** also read [references/from-openapi/intent-driven.md](references/from-openapi/intent-driven.md) (defines G2/G3/G7 gate shapes and cluster patterns) **and** [references/from-openapi/scaffold.md](references/from-openapi/scaffold.md) (defines G6 gate and `selections.json` preview rules) before executing any gate.

Do not write `registerPayable(...)`, `additionalTools`, or new files under `src/tools/` until all required files are loaded.

**`tool-design.md` is non-negotiable**, including when you think you've seen the patterns before. It is the only file that pins down the `registerPayable(name, config)` two-argument shape, the `c.respond(data, { text })` response-mode contract, and the rule that paid handlers never return raw `content` arrays. Routing past it and authoring tools "from memory" is the single most common failure mode in this skill — the input-mode guides build on it and do not duplicate its contract. If you find yourself about to call `registerPayable` and you cannot recall those rules verbatim, you have not read `tool-design.md`; stop and read it.

## Confirmation level (G0 — ask once, applies to the whole flow)

Before any other gate, ask the user how chatty you should be. This is **G0** in the gate reference. See [references/hitl-conventions.md](references/hitl-conventions.md) for the structured-question contract, level semantics, and the full gate index.

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

1. Add new paid tools per [references/from-scratch/scaffold-and-extend.md](references/from-scratch/scaffold-and-extend.md).
2. Run `npm run dev` (widget watch + `wrangler dev` together) and verify with `node scripts/verify.mjs http://localhost:8787`.
3. Deploy with `npm run deploy` per [references/hosting/cloudflare/](references/hosting/cloudflare/).

### Greenfield routing

If no paid-MCP project is present:

| Situation | Path |
| --- | --- |
| Human at a terminal, no spec — wants a working server with one placeholder tool | `npm create solvapay@latest <name> -- --type mcp` (asks "spec? y/n", picks from-scratch on `n`). |
| Human at a terminal, has an OpenAPI / Swagger URL or file | `npm create solvapay@latest <name> -- --type mcp --openapi <url-or-path>` (one-to-one mode). |
| Agent, has a spec | **Always the agent path** — [references/from-openapi/guide.md](references/from-openapi/guide.md), using `scripts/describe.mjs` + `scripts/scaffold.mjs` with a hand-authored `selections.json`. The published CLI only emits one-to-one tools and cannot author intent-driven dispatchers (those require the LLM). One-to-one is still available via `"mode": "one-to-one"` in `selections.json` when clustering isn't worth it. |
| Agent, no spec, hand-writing tools | [references/from-scratch/guide.md](references/from-scratch/guide.md) — `npm create solvapay@latest <name> -- --type mcp --no-openapi` for the scaffold, then add tools by hand. |

### Inside an unrelated app repo

If the cwd is inside a repo that already has its own purpose (a Next.js app, a backend service, a monorepo) **and** there is no paid-MCP server in scope, **stop and ask the user where the MCP server should live** before scaffolding. The MCP server is its own deployable unit (its own `wrangler.jsonc`, its own dependencies) — it does not belong at the app's root by default.

Reasonable defaults to suggest:

- A sibling directory (`../my-app-mcp`) for repos that are a single deployable.
- A subdirectory under `apps/` or `packages/` for a monorepo.

Do not silently scaffold into `./mcp/` or `./solvapay-mcp/` without confirming.

> **Dev mode (skill author / internal testing only).** If the user explicitly says they're testing against the SolvaPay dev backend, append `--dev` to every published-CLI invocation: `npm create solvapay@latest <name> -- --type mcp --dev` and `npx -y solvapay@latest init --dev`. The flag seeds `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` into `.env` and routes browser-auth, `wrangler dev`, deploy preflight, and the deployed worker to api-dev in one pass. Never enable `--dev` for end users — production keys are rejected by api-dev.

## Pick an input mode

Ask once:

> "Do you have an OpenAPI / Swagger document for the API you want to expose as MCP tools, or are you hand-writing the tools?"

| Answer | Route to |
| --- | --- |
| I have an OpenAPI / Swagger spec | [references/from-openapi/guide.md](references/from-openapi/guide.md) |
| I am hand-writing tools — new project | [references/from-scratch/guide.md](references/from-scratch/guide.md) |
| I am adding SolvaPay to an MCP server that already exists | [references/existing-server.md](references/existing-server.md) |

If the user has a REST API but no spec yet, the OpenAPI flow can still help — `from-openapi/guide.md` opens with a "no spec yet" branch that walks the upstream API into one. Default to OpenAPI when in doubt; the spec-first path produces a typed server with less hand-coding.

### Human-driven shortcut: `npm create solvapay@latest -- --type mcp`

For users at a terminal (not inside an agent), point them at the published scaffolder before diving into the agent-only modules. The `@latest` suffix forces npm to re-resolve the registry every run, so the user always picks up the freshest scaffolder without manually clearing the npx cache:

```bash
npm create solvapay@latest my-mcp -- --type mcp                              # interactive: asks spec? y/n
npm create solvapay@latest my-mcp -- --type mcp --openapi <url-or-path>   # from-openapi (one-to-one mode)
npm create solvapay@latest my-mcp -- --type mcp --no-openapi              # from-scratch with placeholder tool
```

The CLI ships with both modes, runs the project-local `npm install`, and invokes `solvapay init` for browser auth + product picker in one pass. Use it when the user is invoking SolvaPay from a shell rather than from an LLM. Intent-driven mode (one MCP tool spanning multiple upstream operations) is intentionally only available via the agent path above — it needs an LLM to author the resulting `src/tools/*.ts` files.

## Hosting

Cloudflare Workers is the recommended default and the only host with inline templates in this skill. Confirm:

> "Deploy to Cloudflare Workers? It's the recommended path. If you need a different host (Supabase Edge, Deno, Bun, Node/Express), we'll point at the right SDK subpath and platform docs."

| Choice | Route to |
| --- | --- |
| Cloudflare Workers (default, recommended) | [references/hosting/cloudflare/](references/hosting/cloudflare/) |
| Anything else | [references/hosting/alternatives.md](references/hosting/alternatives.md) |

The OpenAPI flow targets Cloudflare end-to-end; the from-scratch flows reference the Cloudflare templates and route to alternatives only when the user explicitly wants a non-Cloudflare host.

## SolvaPay credentials

Both modes call [references/solvapay-init.md](references/solvapay-init.md) after scaffold to populate `SOLVAPAY_SECRET_KEY` (via `npx -y solvapay@latest init` browser auth) and `SOLVAPAY_PRODUCT_REF` (via interactive product picker). Read that file once you have a scaffolded project.

If the SolvaPay product doesn't exist yet, ask the user to create one in SolvaPay Console (https://app.solvapay.com) before init.

## Guardrails

Inherited by both input modes; `from-openapi/` and `from-scratch/` no longer repeat them.

- Never expose `SOLVAPAY_SECRET_KEY` to client code, public env vars, or deploy-time plaintext. Upload via `npx wrangler secret put` and keep it in a gitignored `.env` only for local dev.
- Never wrap SolvaPay intent tools (`upgrade`, `topup`, `manage_account`, `activate_plan`, `check_purchase`) with `payable.mcp()` — they are the paywall recovery path, not paid business logic.
- Never set `_meta.ui.resourceUri` on merchant payable tools. Hosts MUST open the iframe on every advertised call (SEP-1865), which flashes an empty widget on silent successes. `registerPayable` enforces this; do not work around it.
- Never return a custom iframe or structured UI payload on a paywall gate. Gates are **text-only** in `content[0].text` naming the recovery intent tool; the widget only mounts on deliberate intent-tool calls.
- Always use `mode: 'json-stateless'` on stateless edge runtimes (Cloudflare Workers, Deno, Supabase Edge). Isolates don't pin across requests, so in-memory sessions break.
- Always hide UI-only virtual tools from text-only hosts with `hideToolsByAudience: ['ui']`.
- **Never edit `src/worker.ts` on deploy-existing tasks** — leave it byte-for-byte unchanged; add deploy scaffolding only. This applies even if the call shape looks stale, uses an older API, or is missing options — do NOT patch it. If you notice API drift, note it in the handoff as a follow-up item but do not touch the file.

## Gotchas

- **Existing-project deploy = scaffolding only, never touch `worker.ts`.** When the task is "deploy my existing server," add only deploy scaffolding (`scripts/deploy.mjs`, `wrangler.jsonc` `[vars]`, `.env`). **Do not open or edit `src/worker.ts`** — not for import fixes, CORS, `Env` interfaces, the canonical template, or "stale API shape" patches. Run `npx wrangler whoami` as the first pre-flight command (not just `wrangler login`) to confirm auth and print the `*.workers.dev` subdomain. Worker wiring belongs in [references/existing-server.md](references/existing-server.md), not deploy. **Exception:** paywall-wiring tasks (e.g. "add SolvaPay paywall to my existing MCP server") explicitly require editing `src/worker.ts` — the deploy guardrail does not apply to those tasks.
- `@solvapay` is not a valid package — use subpaths (`@solvapay/mcp`, `@solvapay/mcp/fetch`, etc.).
- `ctx.registerPayable(name, config)` takes **exactly two arguments** — not `(toolDef, paymentConfig, handler)`.
- Paid handlers return `c.respond(data, { text: narration })` — never raw `content` arrays from paid handlers.
- Run `node scripts/describe.mjs` against a **local spec file** — fetch URLs to `/tmp/spec-*.json` first; don't pass URLs directly.
- Petstore v3's `servers[0]` is relative (`/api/v3`) — `describe.mjs` emits a `serverProbeError` advisory; fix in `selections.json` or surface to the user.
- `selections.json` must live **outside** the scaffold target dir (e.g. `/tmp/selections-<uuid>.json`) — upstream API keys must not land in the project tree.
- Don't scaffold into an unrelated app repo root without confirming where the MCP worker should live — it's its own deployable unit.
- `scripts/describe.mjs` and `scripts/scaffold.mjs` in this skill are wrappers — they resolve `create-solvapay/scripts/mcp` via `SCAFFOLDER_SCRIPTS_DIR`, a local `create-solvapay` install, or a sibling `solvapay-sdk` checkout (see [scripts/README.md](scripts/README.md)).

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

## Pointers

- Shared tool-design contract: [references/tool-design.md](references/tool-design.md)
- HITL conventions and gate reference: [references/hitl-conventions.md](references/hitl-conventions.md)
- Credential bootstrap: [references/solvapay-init.md](references/solvapay-init.md)
- OpenAPI mode: [references/from-openapi/](references/from-openapi/)
- Hand-written mode: [references/from-scratch/](references/from-scratch/)
- Existing-server integration: [references/existing-server.md](references/existing-server.md)
- Host details: [references/hosting/](references/hosting/)
- Scaffolder scripts (`describe.mjs` / `scaffold.mjs` / `validate-selections.mjs`): [scripts/README.md](scripts/README.md)

## Task progress

- [ ] Confirm scope (data-returning tools, not custom UI)
- [ ] Read [references/tool-design.md](references/tool-design.md)
- [ ] Pick input mode: OpenAPI spec vs hand-written
- [ ] Confirm host: Cloudflare (default) or alternatives
- [ ] Complete the chosen mode guide
- [ ] Run [references/solvapay-init.md](references/solvapay-init.md) to populate credentials
- [ ] Verify success + gate paths in sandbox
