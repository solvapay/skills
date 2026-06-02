---
name: create-mcp-app
description: >
  Use when the user is building a brand-new paid MCP server from zero — no existing server in play.
  The two entry points: (1) the user has an OpenAPI or Swagger spec they want converted into
  monetized MCP tools, or (2) they want to write the tools by hand on a fresh SolvaPay-wired
  scaffold. Also use for the `npm create solvapay` CLI command with `--type mcp`. This skill covers
  the full greenfield journey: spec parsing, tool authoring, Cloudflare Workers deployment, and
  SolvaPay paywall setup on a new codebase. Skip when the user already has a running MCP server
  and wants to add a paywall without rebuilding — use the existing-server skill. Skip for web
  checkout pages, Lovable flows, and SDK-only integrations.
metadata:
  version: "1.0.0"
compatibility: >
  Designed for Cloudflare Workers. Requires Node.js >= 20 and npm. Alternative hosts
  (Supabase Edge, Deno, Bun, Node + Express) in references/hosting/alternatives.md.
---

# Create a Paid MCP App

SolvaPay-monetized MCP server on Cloudflare Workers. OpenAPI auto-generation or hand-written tools.

> **Human at a terminal?** `npm create solvapay@latest <name> -- --type mcp` (use `@latest`). Ships from-openapi (one-to-one) and from-scratch modes, runs install + `solvapay init` in one pass.
>
> **Agent?** `scripts/describe.mjs` + `scripts/scaffold.mjs` per [references/from-openapi/guide.md](references/from-openapi/guide.md). Intent-driven clustering and hand-tuned narration require an LLM — the CLI cannot author `src/tools/*.ts`. Internal dev runs use the same agent path with `--dev` and `create-solvapay@preview`.

## Scope

This skill covers **any MCP server whose tools return text or `structuredContent`** — data, intelligence and analytics, search and retrieval, integrations with external APIs, actions and workflows, computations, content generation. Domain-agnostic.

The only UI this skill ships is SolvaPay's built-in checkout / account / topup widget, which mounts only when the user deliberately invokes an intent tool (`upgrade` / `topup` / `manage_account`). For custom graphical widgets, keep this skill for server + paywall wiring and add [references/mcp-apps-ui.md](references/mcp-apps-ui.md).

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code, public env vars, or deploy-time plaintext. Upload via `npx wrangler secret put` and keep it in a gitignored `.env` only for local dev.
- Never wrap SolvaPay intent tools (`upgrade`, `topup`, `manage_account`, `activate_plan`, `check_purchase`) with `payable.mcp()` — they are the paywall recovery path, not paid business logic.
- Never set `_meta.ui.resourceUri` on merchant payable tools. Hosts MUST open the iframe on every advertised call (SEP-1865), which flashes an empty widget on silent successes.
- Never return custom iframe/UI on paywall gates — text-only narration naming the recovery intent tool.
- Always use `mode: 'json-stateless'` on stateless edge runtimes (Cloudflare Workers, Deno, Supabase Edge).
- Always hide UI-only virtual tools from text-only hosts with `hideToolsByAudience: ['ui']`.
- Always confirm the resolved `SOLVAPAY_PRODUCT_REF` after `solvapay init`; under `--yes` / non-TTY, never treat an auto-picked product as final until the user confirms it belongs to this MCP.
- If the requested business model is usage-based or metered, verify that the selected product has the intended usage-based plan before handoff. `selections.plans[]` is validated during scaffold but is not created by scaffold.
- **Deploy-existing = scaffolding only.** On "deploy my existing server" tasks, add only deploy scaffolding (`scripts/deploy.mjs`, `wrangler.jsonc` `[vars]`, `.env`) and never open or edit `src/worker.ts` — not for imports, CORS, `Env`, the canonical template, or "stale API shape" patches. Note any API drift in the handoff as a follow-up. **Exception:** paywall-wiring tasks ("add SolvaPay paywall to my existing MCP server") do edit `src/worker.ts` — see [references/existing-server.md](references/existing-server.md).

## Gotchas

- Deploy pre-flight: run `npx wrangler whoami` first (not just `wrangler login`) to confirm auth and print the `*.workers.dev` subdomain.
- `@solvapay` is not a valid package — use subpaths (`@solvapay/mcp`, `@solvapay/mcp/fetch`, etc.).
- `ctx.registerPayable(name, config)` takes **exactly two arguments** — not `(toolDef, paymentConfig, handler)`.
- Paid handlers return `c.respond(data, { text: narration })` — never raw `content` arrays from paid handlers.
- Run `node scripts/describe.mjs` against a **local spec file** — fetch URLs to `/tmp/spec-*.json` first; don't pass URLs directly.
- **Binary/multipart operations must be skipped.** After running `describe.mjs`, grep the original spec for `multipart/form-data`, `application/octet-stream`, `image/`, and `application/pdf` under `requestBody.content` and response `content`. For each matching operation (e.g. `uploadFile`, `uploadImage`), set `tier: "skip"` in `selections.json` — MCP tools return text, not file streams, so these can't be wrapped usefully.
- Empty or relative OpenAPI `servers` must be resolved before scaffold. Confirm the upstream base URL with the user, and watch for path-prefix outliers (e.g. `/apifhir/...` among `/api/fhir/...`) before generating tools.
- `selections.json` must live **outside** the scaffold target dir (e.g. `/tmp/selections-<uuid>.json`) — upstream API keys must not land in the project tree.
- Don't scaffold into an unrelated app repo root without confirming where the MCP worker should live — it's its own deployable unit.
- `scripts/describe.mjs` and `scripts/scaffold.mjs` in this skill are wrappers — see [scripts/README.md](scripts/README.md) for resolution order.

## Mandatory read order

Before writing tool code:

1. This SKILL.md — routing, input mode, host.
2. [references/tool-design.md](references/tool-design.md) — `registerPayable` shape, response contract.
3. One input-mode guide: [references/from-openapi/guide.md](references/from-openapi/guide.md) **or** [references/from-scratch/guide.md](references/from-scratch/guide.md) **or** [references/existing-server.md](references/existing-server.md).
4. **If intent-driven mode (OpenAPI):** also read [references/from-openapi/intent-driven.md](references/from-openapi/intent-driven.md) (G2/G3/G7 gate shapes) **and** [references/from-openapi/scaffold.md](references/from-openapi/scaffold.md) (G6 gate, `selections.json` preview) before executing any gate.

Do not write `registerPayable(...)`, `additionalTools`, or `src/tools/*` until all required files are loaded.

## Confirmation level (G0 — ask once)

Before any other gate, ask how chatty you should be. See [references/hitl-conventions.md](references/hitl-conventions.md).

> "How chatty should I be? `standard` (default) confirms each big decision; `auto` only confirms irreversible steps (scaffold, deploy, go-live); `chatty` reviews every intent and file."

## Routing

**1. Existing paid-MCP project?** All of: `@solvapay/mcp` or `@solvapay/server` in `package.json`, `wrangler.jsonc`, and `src/worker.ts` with `createSolvaPayMcpFetch` / `createSolvaPayMcpServer` → [references/from-scratch/scaffold-and-extend.md](references/from-scratch/scaffold-and-extend.md). Do not scaffold.

**2. Greenfield — ask once:** *"OpenAPI/Swagger spec, or hand-written tools?"*

| Answer | Guide | Validator |
| --- | --- | --- |
| Has spec (agent) | [references/from-openapi/guide.md](references/from-openapi/guide.md) | `validate-selections.mjs` → scaffold → verify |
| Hand-written / new | [references/from-scratch/guide.md](references/from-scratch/guide.md) | wrangler dev smoke |
| Existing MCP server (add paywall) | [references/existing-server.md](references/existing-server.md) | tool invocation smoke |

**Inside an unrelated app repo:** if cwd is a Next.js app, backend, or monorepo without a paid-MCP server in scope, **stop and ask where the MCP server should live** before scaffolding (sibling dir or `apps/` / `packages/` subdirectory).

> **Dev mode (internal testing only).** Use preview tooling and append `--dev` when testing against api-dev: `npm create solvapay@preview <name> -- --type mcp --dev`, `node scripts/describe.mjs --dev ...`, `node scripts/scaffold.mjs --dev ...`, and `npx -y solvapay@preview init --dev`. Never for end users.

**3. Host:** default Cloudflare → [references/hosting/cloudflare/README.md](references/hosting/cloudflare/README.md). Other hosts → [references/hosting/alternatives.md](references/hosting/alternatives.md). Optional custom MCP UI → [references/mcp-apps-ui.md](references/mcp-apps-ui.md).

**4. Credentials:** after scaffold → [references/solvapay-init.md](references/solvapay-init.md) (`npx -y solvapay@latest init`).

Human CLI shortcut (terminal only): see the human block at the top of this file.

## OpenAPI flow & gates

`describe.mjs` → author `selections.json` → `validate-selections.mjs` (loop until pass) → `scaffold.mjs <selections> <target-dir>` → author tools per [references/tool-design.md](references/tool-design.md) → `solvapay init` → confirm product/plan → verify → test → deploy. `SOLVAPAY_SECRET_KEY` is set by `solvapay init`, never in `selections.json`. Full G0–G9 HITL gates: [references/hitl-conventions.md](references/hitl-conventions.md).

## Scripts

| Script | Action | Purpose |
| --- | --- | --- |
| `scripts/describe.mjs` | **Run** | Parse OpenAPI spec |
| `scripts/validate-selections.mjs` | **Run** | Validate `selections.json` before scaffold |
| `scripts/scaffold.mjs` | **Run** | Generate worker from selections |
| `scripts/README.md` | **See** | Resolution order, upstream `--help` |

## Verification loop

1. Run the mode's validator (verify script, `wrangler dev`, or guide checklist).
2. On failure → mode-guide troubleshooting → fix → re-run until pass.
3. Only then complete the handoff template.

## Handoff template

```markdown
## MCP app handoff
- **Input mode:** from-openapi / from-scratch / existing-server
- **Host:** Cloudflare / alternative
- **Worker URL:** [url]
- **Tools authored:** [list]
- **Gates cleared:** G0–G[n]
- **Product ref:** [prd_... + how it was confirmed]
- **Plan / metering status:** [free default / usage-based plan verified / needs user action]
- **Sandbox:** [success path + gate path verified; note skipped checks explicitly]
- **Paid-path verification:** [paywallGate / merchantBootstrap / upstream smoke: passed, skipped, or not run]
- **Known gaps:** [if any]
```

## Task progress

- [ ] Read [references/tool-design.md](references/tool-design.md) + matching mode guide
- [ ] Route (existing vs greenfield, input mode, host)
- [ ] Complete mode guide (OpenAPI: describe → validate → scaffold → author)
- [ ] Run [references/solvapay-init.md](references/solvapay-init.md)
- [ ] Run verification loop until pass
- [ ] Complete handoff template
