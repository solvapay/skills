---
name: create-mcp-app
description: >
  Use when any MCP server is monetized in code, in TypeScript, Python or Go — new (OpenAPI or
  hand-written tools) or existing (add a paywall, or wrap with the SolvaPay factory). Also use for
  `npm create solvapay` with `--type mcp`. Covers tool authoring, the paywall, Cloudflare Workers
  deploys for TypeScript, container deploys for Python (uvicorn, Starlette, `pyproject.toml`) and
  Go (`net/http`, `go.mod`), and selling tools to agents. For an existing server, follow
  references/existing-server.md and do not rescaffold. Skip for web checkout pages and web/API
  paywalls with no MCP server (`solvapay/app-integration`).
metadata:
  version: "2.0.0"
compatibility: >
  TypeScript: Node.js >= 20 and npm, Cloudflare Workers by default (other hosts in
  references/hosting/alternatives.md). Python: Python >= 3.10 and uv. Go: Go >= 1.26. Python and
  Go deploy as containers. Node.js is needed in every language for the SolvaPay CLI.
---

# Create a Paid MCP App

A SolvaPay-monetized MCP server in TypeScript, Python or Go: a new server (OpenAPI for TypeScript, hand-written tools in any language) or an existing server with a paywall added.

> **Human at a terminal?** `npm create solvapay@latest <name> -- --type mcp --language ts|python|go` (use `@latest`; `--language` defaults to `ts`). It scaffolds, installs and runs `solvapay init` in one pass.
>
> **Agent?** Follow this file. TypeScript from an OpenAPI spec goes through `scripts/describe.mjs` + `scripts/scaffold.mjs` per [references/from-openapi/guide.md](references/from-openapi/guide.md): intent-driven clustering and hand-tuned narration need an LLM.

## Language

Detect the language first, with the same markers the SolvaPay CLI uses:

| Marker in the project folder | Language | Read |
| --- | --- | --- |
| `go.mod` | Go | [references/languages/go.md](references/languages/go.md) |
| `uv.lock`, `poetry.lock`, `pyproject.toml` or `requirements.txt` | Python | [references/languages/python.md](references/languages/python.md) |
| `package.json` | TypeScript | [references/languages/ts.md](references/languages/ts.md) |

- Markers for two languages in the folder → ask which one the MCP server is in. Do not guess.
- Empty folder or a new project → use the language the user named; if none, ask "TypeScript, Python or Go?" once. Default TypeScript.
- The user named a language that the markers contradict → ask.

**Read exactly one `references/languages/<ts|python|go>.md`, and do not open the other two.** Every language file has the same sections: Install, Imports, Register a paid tool, Free tool, Respond and narration, Run locally, Test, Deploy, Existing server, Keep the SDK current, Gotchas.

Python and Go are hand-written tools only: there is no OpenAPI mode (`--openapi` with `--language python|go` fails). For a spec, offer TypeScript, or hand-write the Python/Go tools from the spec.

## Scope

Any MCP server whose tools return text or `structuredContent` — data, search, integrations, actions, computations, content generation. The only UI is SolvaPay's built-in checkout / account / top-up widget, which mounts when the user deliberately calls the `account` tool. Custom graphical widgets are TypeScript only: keep this skill for the server and paywall and add [references/mcp-apps-ui.md](references/mcp-apps-ui.md).

Selling the same tools to AI agents that pay per call (preview): [references/agent-payments.md](references/agent-payments.md).

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code, public env vars, an image or a deploy script in plain text. Keep it in a gitignored `.env` for local dev and in the host's secret store when deployed (`npx wrangler secret put` on Workers; Secret Manager / `fly secrets` for containers).
- Never wrap `account`, `activate_plan` or the widget's transport tools in a paywall — they are the recovery path, not paid business logic.
- Never set `_meta.ui.resourceUri` on merchant tools, and never return a custom iframe or UI on a paywall gate. The SDK writes text-only narration naming `account`.
- Never take the customer from a tool argument or an unverified header.
- The public base URL (`MCP_PUBLIC_BASE_URL` in TypeScript, `PUBLIC_BASE_URL` in Python and Go) must equal the URL MCP clients use. Sign-in fails otherwise.
- Always confirm the resolved `SOLVAPAY_PRODUCT_REF` after `solvapay init`; under `--yes` / non-TTY, never treat an auto-picked product as final until the user confirms it belongs to this MCP.
- If the business model is usage-based or metered, verify the product has that plan before handoff. Scaffolding does not create plans.
- TypeScript: always `responseMode: 'json'` on stateless edge runtimes and `hideToolsByAudience: ['ui']`.
- **Deploy-existing = scaffolding only.** On "deploy my existing server" tasks, add only deploy scaffolding (TypeScript: `scripts/deploy.mjs`, `wrangler.jsonc` `[vars]`, `.env`; Python/Go: the host config from [references/hosting/container.md](references/hosting/container.md)) and never edit the server entry file. Note API drift in the handoff as a follow-up.
- **Paywall wiring is separate.** Adding a paywall to an existing MCP server does edit the entry file. See [references/existing-server.md](references/existing-server.md).

## Keep the SDK current

A project keeps whatever SolvaPay SDK version it was scaffolded or copied with. So:

- **Run `npx -y solvapay@latest doctor`** right after scaffold, before every deploy, when you open an existing paid-MCP project, and before reporting a SolvaPay bug. It checks the SDK in every language it finds (`@solvapay/*` in `package.json`, the `solvapay` pin in `uv.lock` / `poetry.lock` / `requirements.txt`, `github.com/solvapay/solvapay-sdk/go` in `go.mod`) against the newest release, and fails when no SolvaPay SDK is found.
- **When it fails, run the upgrade command it prints**, then the project's typecheck and tests. If an upgrade changes an API the project uses, fix the call sites; don't pin back.
- TypeScript: `npm run deploy` stops on outdated `@solvapay/*` packages. Pass `--allow-outdated` only when the user asks, and say so in the handoff.
- Scaffolded projects include `.github/dependabot.yml` (npm, uv or gomod). Keep it when you move the project.

## Gotchas

- Every `create-solvapay` run prints `create-solvapay vX.Y.Z`. If that lags the [published version](https://www.npmjs.com/package/create-solvapay), run `npx clear-npx-cache` and re-invoke with `@latest`.
- Python/Go need a CLI whose `--help` lists `--language`. Run `node scripts/check-toolchain.mjs --language <python|go>` first: it checks the toolchain and that flag, and stops with a clear message if either is missing.
- Language-specific traps are in the Gotchas section of your one language file.
- TypeScript OpenAPI: run `node scripts/describe.mjs` against a **local spec file** (fetch URLs to `/tmp/spec-*.json` first), skip binary/multipart operations (`tier: "skip"`), resolve empty or relative `servers` with the user, and keep `selections.json` **outside** the target dir. Details in [references/from-openapi/guide.md](references/from-openapi/guide.md).
- Deploy pre-flight on Workers: `npx wrangler whoami` (not just `wrangler login`).
- Don't scaffold into an unrelated app repo root without confirming where the MCP server should live — it's its own deployable unit.

## Docs source

Facts (signatures, plan fields, endpoints) come from the docs, not from memory: SolvaPay Docs MCP (`https://docs.solvapay.com/mcp`, HTTP transport, no auth) → https://docs.solvapay.com/llms.txt → direct page fetch. SDK pages: `/sdks/typescript/…`, `/sdks/python/…`, `/sdks/go/…`.

## Mandatory read order

Before writing tool code:

1. This SKILL.md — language, routing, input mode, host.
2. [references/tool-design.md](references/tool-design.md) — the language-neutral contract: tool kinds, narration, identity.
3. The one language file from [Language](#language).
4. One input-mode guide: [references/from-openapi/guide.md](references/from-openapi/guide.md) (TypeScript only) **or** [references/from-scratch/guide.md](references/from-scratch/guide.md) **or** [references/existing-server.md](references/existing-server.md).
5. **If intent-driven mode (OpenAPI):** also [references/from-openapi/intent-driven.md](references/from-openapi/intent-driven.md) and [references/from-openapi/scaffold.md](references/from-openapi/scaffold.md) before any gate.

Do not write a paid or free tool until all required files are loaded.

## Confirmation level (G0 — ask once)

Before any other gate, ask how chatty you should be. See [references/hitl-conventions.md](references/hitl-conventions.md).

> "How chatty should I be? `standard` (default) confirms each big decision; `auto` only confirms irreversible steps (scaffold, deploy, go-live); `chatty` reviews every intent and file."

## Routing

**1. Existing paid-MCP project?** Do not scaffold. Run `npx -y solvapay@latest doctor` first and upgrade an outdated SDK.

| Language | Markers | Go to |
| --- | --- | --- |
| TypeScript | `@solvapay/mcp` or `@solvapay/server` in `package.json`, `wrangler.jsonc`, and `src/worker.ts` with `createSolvaPayMcpFetch` / `createSolvaPayMcpServer` | [references/from-scratch/scaffold-and-extend.md](references/from-scratch/scaffold-and-extend.md) |
| Python | `solvapay` in `pyproject.toml` or a lock file, and `create_solvapay_mcp_server(` in the code | [references/languages/python.md](references/languages/python.md) (Register a paid tool, Free tool) |
| Go | `github.com/solvapay/solvapay-sdk/go` in `go.mod`, and `solvapay.NewMCPServer(` in the code | [references/languages/go.md](references/languages/go.md) (Register a paid tool, Free tool) |

**2. Greenfield or an MCP server without SolvaPay — ask once if unclear:** *"OpenAPI/Swagger spec, hand-written tools, or an existing MCP server?"*

| Answer | Guide | Validator |
| --- | --- | --- |
| Has spec (TypeScript) | [references/from-openapi/guide.md](references/from-openapi/guide.md) | `validate-selections.mjs` → scaffold → verify |
| Hand-written / new (any language) | [references/from-scratch/guide.md](references/from-scratch/guide.md) | local run + verify |
| Existing MCP server (add paywall) | [references/existing-server.md](references/existing-server.md) | tool invocation smoke + verify |
| Existing MCP server, factory wrap only (TypeScript) | [references/existing-server.md](references/existing-server.md) — no scaffold | tool invocation smoke |

**Inside an unrelated app repo:** if cwd is a web app, backend or monorepo without a paid-MCP server in scope, **stop and ask where the MCP server should live** before scaffolding (sibling dir or a subdirectory).

**3. Host:**

| Language | Host | Guide |
| --- | --- | --- |
| TypeScript | Cloudflare Workers (default) | [references/hosting/cloudflare/README.md](references/hosting/cloudflare/README.md); other runtimes: [references/hosting/alternatives.md](references/hosting/alternatives.md) |
| Python, Go | A container: Google Cloud Run (documented), Fly.io (alternative) | [references/hosting/container.md](references/hosting/container.md) |

**4. Credentials:** [references/solvapay-init.md](references/solvapay-init.md) (`npx -y solvapay@latest init`, with `--language` outside TypeScript).

## OpenAPI flow & gates (TypeScript)

`describe.mjs` → author `selections.json` → `validate-selections.mjs` (loop until pass) → `scaffold.mjs <selections> <target-dir>` → author tools per [references/tool-design.md](references/tool-design.md) and [references/languages/ts.md](references/languages/ts.md) → `solvapay init` → confirm product/plan → verify → test → deploy. `SOLVAPAY_SECRET_KEY` is set by `solvapay init`, never in `selections.json`. Full G0–G9 HITL gates: [references/hitl-conventions.md](references/hitl-conventions.md).

## Scripts

| Script | Action | Purpose |
| --- | --- | --- |
| `scripts/check-toolchain.mjs` | **Run** | Before a Python/Go scaffold: toolchain versions and `--language` support in the resolved `create-solvapay` |
| `scripts/describe.mjs` | **Run** | Parse an OpenAPI spec (TypeScript) |
| `scripts/validate-selections.mjs` | **Run** | Validate `selections.json` before scaffold (TypeScript) |
| `scripts/scaffold.mjs` | **Run** | Generate a worker from selections (TypeScript) |
| `scripts/README.md` | **See** | Resolution order, upstream `--help` |

## Verification loop

1. Run `npx -y solvapay@latest doctor`. Every check must pass, including the SDK version check.
2. Run the language's tests (Test section of your language file).
3. Verify the running server:
   - TypeScript: `node scripts/verify.mjs <url>` (ships in the scaffolded project).
   - Python and Go: `npx -y solvapay@latest verify <url>` (add `--credentials-file <path>` for the signed-in checks). Exit 1 means a failure.
4. On failure → the guide's troubleshooting → fix → re-run until pass.
5. Only then complete the handoff template.

## Handoff template

```markdown
## MCP app handoff
- **Language:** TypeScript / Python / Go
- **Input mode:** from-openapi / from-scratch / existing-server
- **Host:** Cloudflare Workers / Cloud Run / Fly.io / other (name it)
- **Server URL:** [public URL; the MCP endpoint is <url>/mcp]
- **Tools authored:** [list, each paid / free-capped / uncounted]
- **Gates cleared:** G0–G[n]
- **Product ref:** [prd_... + how it was confirmed]
- **Plan / metering status:** [free default / usage-based plan verified / needs user action]
- **Sandbox:** [success path + gate path verified; note skipped checks explicitly]
- **Verify:** [verify.mjs / solvapay verify: passed, failed, or not run]
- **SDK versions:** [doctor's SDK check passed / `--allow-outdated` used because …]
- **Agent payments:** [not used / added (preview, needs enabling on the account)]
- **Known gaps:** [if any]
```

## Task progress

- [ ] Detect the language; read [references/tool-design.md](references/tool-design.md) and the one language file
- [ ] Route (existing vs greenfield, input mode, host)
- [ ] Complete the mode guide (OpenAPI: describe → validate → scaffold → author; scratch: scaffold → author)
- [ ] Run [references/solvapay-init.md](references/solvapay-init.md)
- [ ] Run `npx -y solvapay@latest doctor`; upgrade an outdated SDK
- [ ] Run the verification loop until pass
- [ ] Complete the handoff template
