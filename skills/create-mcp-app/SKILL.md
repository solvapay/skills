---
name: create-mcp-app
description: >
  Use this skill when the user wants a greenfield paid MCP server — "create mcp app",
  "scaffold mcp", "openapi to mcp", "wrap my REST API as MCP", "monetize tools",
  "npm create solvapay", or "paid MCP worker" even without saying OpenAPI. Also use when
  they need audit + worker template for an existing MCP server. Do not use for SDK wiring
  only on an existing app or web/Lovable checkout — use solvapay/sdk-integration or checkout
  skills instead.
metadata:
  version: "1.0.0"
compatibility: >
  Designed for Cloudflare Workers. Requires Node.js >= 20 and npm. Alternative hosts
  (Supabase Edge, Deno, Bun, Node + Express) in references/hosting/alternatives.md.
---

# Create a Paid MCP App

SolvaPay-monetized MCP server on Cloudflare Workers. OpenAPI auto-generation or hand-written tools.

> **Human at a terminal?** `npm create solvapay@latest <name> -- --type mcp` (use `@latest`). **Agent?** `scripts/describe.mjs` + `scripts/scaffold.mjs` per [references/from-openapi/guide.md](references/from-openapi/guide.md).

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code, public env vars, or deploy-time plaintext.
- Never wrap SolvaPay intent tools (`upgrade`, `topup`, `manage_account`, etc.) with `payable.mcp()`.
- Never set `_meta.ui.resourceUri` on merchant payable tools.
- Never return custom iframe/UI on paywall gates — text-only narration naming the recovery intent tool.
- Always use `mode: 'json-stateless'` on stateless edge runtimes.
- **Never edit `src/worker.ts` on deploy-existing tasks** — leave it byte-for-byte unchanged; add deploy scaffolding only. This applies even if the call shape looks stale, uses an older API, or is missing options — do NOT patch it. If you notice API drift, note it in the handoff as a follow-up item but do not touch the file.

## Gotchas

- **Existing-project deploy = scaffolding only, never touch `worker.ts`.** When the task is "deploy my existing server," add only deploy scaffolding (`scripts/deploy.mjs`, `wrangler.jsonc` `[vars]`, `.env`). **Do not open or edit `src/worker.ts`** — not for import fixes, CORS, `Env` interfaces, the canonical template, or "stale API shape" patches. Run `npx wrangler whoami` as the first pre-flight command (not just `wrangler login`) to confirm auth and print the `*.workers.dev` subdomain. Worker wiring belongs in [references/existing-server.md](references/existing-server.md), not deploy.
- `@solvapay` is not a valid package — use subpaths (`@solvapay/mcp`, `@solvapay/mcp/fetch`, etc.).
- `ctx.registerPayable(name, config)` takes **exactly two arguments**.
- Paid handlers use `c.respond(data, { text })` — never raw `content` arrays.
- Run `describe.mjs` against **local spec files** — fetch URLs to `/tmp/` first.
- Petstore v3 relative `servers[0]` emits `serverProbeError` — fix in `selections.json`.
- `selections.json` must live **outside** the scaffold target dir.
- Don't scaffold into an unrelated app repo root without confirming location.
- Skill `scripts/*.mjs` are wrappers — see [scripts/README.md](scripts/README.md) for resolution order.

## Mandatory read order

Before writing tool code:

1. This SKILL.md — routing, input mode, host.
2. [references/tool-design.md](references/tool-design.md) — `registerPayable` shape, response contract.
3. One input-mode guide: [references/from-openapi/guide.md](references/from-openapi/guide.md) **or** [references/from-scratch/guide.md](references/from-scratch/guide.md) **or** [references/existing-server.md](references/existing-server.md).
4. **If intent-driven mode (OpenAPI):** also read [references/from-openapi/intent-driven.md](references/from-openapi/intent-driven.md) (defines G2/G3/G7 gate shapes and cluster patterns) **and** [references/from-openapi/scaffold.md](references/from-openapi/scaffold.md) (defines G6 gate and `selections.json` preview rules) before executing any gate.

Do not write `registerPayable(...)`, `additionalTools`, or `src/tools/*` until all required files are loaded.

## Routing procedure

### 1. Detect existing paid-MCP project

All of: `@solvapay/mcp` or `@solvapay/server` in `package.json`, `wrangler.jsonc`, `src/worker.ts` with `createSolvaPayMcpFetch` / `createSolvaPayMcpServer`.

If yes → [references/from-scratch/scaffold-and-extend.md](references/from-scratch/scaffold-and-extend.md); do not scaffold.

### 2. Greenfield — pick input mode

Ask once: *"OpenAPI/Swagger spec, or hand-written tools?"*

| Answer | Guide |
| --- | --- |
| Has spec (agent) | [references/from-openapi/guide.md](references/from-openapi/guide.md) |
| Hand-written / new | [references/from-scratch/guide.md](references/from-scratch/guide.md) |
| Existing MCP server | [references/existing-server.md](references/existing-server.md) |

Human CLI shortcut (terminal only): see human block at top of this file.

### 3. Confirm host

Default Cloudflare → [references/hosting/cloudflare/README.md](references/hosting/cloudflare/README.md). Other hosts → [references/hosting/alternatives.md](references/hosting/alternatives.md).

### 4. Credentials

After scaffold → [references/solvapay-init.md](references/solvapay-init.md) (`npx -y solvapay@latest init`).

## OpenAPI plan-validate-execute

1. **Describe:** `node scripts/describe.mjs <spec>` → `openapi-described.json`
2. **Plan:** Agent authors `selections.json` (intent clusters)
3. **Validate:** `node scripts/validate-selections.mjs selections.json` — fix errors, re-validate until pass
4. **Execute:** `node scripts/scaffold.mjs selections.json <target-dir>`
5. Author tools per [references/tool-design.md](references/tool-design.md)
6. **Verify:** upstream `verify.mjs` or mode-guide checklist → fix → repeat until pass
7. **Test** → **Deploy** per mode guide (G8/G9 gates)

## Multi-step map

| Mode | Guide | Validator |
| --- | --- | --- |
| OpenAPI | [references/from-openapi/guide.md](references/from-openapi/guide.md) | `validate-selections.mjs` → scaffold → verify |
| From scratch | [references/from-scratch/guide.md](references/from-scratch/guide.md) | wrangler dev smoke |
| Existing server | [references/existing-server.md](references/existing-server.md) | tool invocation smoke |
| Deploy | [references/hosting/cloudflare/deploy-verify.md](references/hosting/cloudflare/deploy-verify.md) | curl + MCP inspector |

G0–G9 gates: [references/hitl-conventions.md](references/hitl-conventions.md).

## Scripts

| Script | Action | Purpose |
| --- | --- | --- |
| `scripts/describe.mjs` | **Run** | Parse OpenAPI spec |
| `scripts/scaffold.mjs` | **Run** | Generate worker from selections |
| `scripts/validate-selections.mjs` | **Run** | Validate `selections.json` before scaffold |
| `scripts/README.md` | **See** | Resolution order, upstream `--help` |

## Verification loop

1. Run applicable validator (verify script, wrangler dev, or mode-guide checklist).
2. On failure → read troubleshooting in mode guide → fix → re-run until pass.
3. Only then complete handoff template.

## Handoff template

```markdown
## MCP app handoff
- **Input mode:** from-openapi / from-scratch / existing-server
- **Host:** Cloudflare / alternative
- **Worker URL:** [url]
- **Tools authored:** [list]
- **Gates cleared:** G0–G[n]
- **Sandbox:** [success path + gate path verified]
- **Known gaps:** [if any]
```

## Task progress

- [ ] Confirm scope (data-returning tools)
- [ ] Read [references/tool-design.md](references/tool-design.md)
- [ ] Run routing procedure (existing vs greenfield, input mode, host)
- [ ] Complete mode guide (OpenAPI: plan-validate-execute selections)
- [ ] Run [references/solvapay-init.md](references/solvapay-init.md)
- [ ] Run verification loop until pass
- [ ] Complete handoff template

## Pointers

- Tool contract: [references/tool-design.md](references/tool-design.md)
- OpenAPI: [references/from-openapi/guide.md](references/from-openapi/guide.md)
- From scratch: [references/from-scratch/guide.md](references/from-scratch/guide.md)
- Existing server: [references/existing-server.md](references/existing-server.md)
- Cloudflare host: [references/hosting/cloudflare/README.md](references/hosting/cloudflare/README.md)
- Custom MCP UI (optional): [references/mcp-apps-ui.md](references/mcp-apps-ui.md)
