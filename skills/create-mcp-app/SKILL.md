---
name: create-mcp-app
description: >
  Use when the user is building a brand-new paid MCP server from zero — no existing server in play.
  Entry points: OpenAPI/Swagger into monetized MCP tools (TypeScript), or hand-written tools on a
  fresh SolvaPay scaffold in TypeScript, Python, Ruby, Go, or Rust. Also use for `npm create solvapay`
  with `--type mcp --language`. Covers scaffold, tool authoring, host deploy, and paywall setup.
  Skip when they already have a running MCP server and only want a paywall — use existing-server.
  Skip for web checkout, Lovable flows, and SDK-only integrations.
metadata:
  version: "1.0.0"
compatibility: >
  Scaffolder needs Node >= 20. Host and toolchain are a function of language
  (npm / uv / bundle / go / cargo). OpenAPI codegen is TypeScript-only.
---

# Create a Paid MCP App

SolvaPay-monetized MCP server. Language is a parameter — TypeScript is a row, not the default.

> **Human?** `npm create solvapay@latest <name> -- --type mcp --language <id>` (`ts` / `python` / `ruby` / `go` / `rust`). Add `--no-openapi` for from-scratch. Runs install + `solvapay init --language <id>`.
>
> **Agent?** Clear [references/languages/toolchain-gate.md](references/languages/toolchain-gate.md), then `scripts/scaffold-app.mjs` (from-scratch, every language) or `scripts/describe.mjs` + `scripts/scaffold.mjs` (OpenAPI, TypeScript only). Internal: add `--dev`.

## Scope

Any MCP server whose tools return text or `structuredContent`. Domain-agnostic.

Built-in UI is the checkout / account / topup widget, mounted only when the user invokes the `account` viewer (`/upgrade`, `/manage_account`, `/topup` remap onto it with `view`). Custom widgets: keep this skill for server + paywall and add [references/mcp-apps-ui.md](references/mcp-apps-ui.md).

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code, public env, or deploy-time plaintext.
- Never wrap `account` / `activate_plan` (or UI transport tools) with the payable helper.
- Never set `_meta.ui.resourceUri` on merchant payable tools (SEP-1865).
- Never return custom iframe/UI on paywall gates — text-only narration naming `` `account` `` (or `` `activate_plan` `` when a `planRef` is known).
- **Read exactly one** [references/languages/](references/languages/) file — the row you picked. Never open a second. Comparison lives only in the matrix below.
- Never scaffold until `scripts/check-toolchain.mjs --language <id>` prints `ok`.
- Never treat a scaffolder `⚠️` install line as success — it is a soft warning in every language.
- Always confirm `SOLVAPAY_PRODUCT_REF` after `solvapay init`. Under `--yes` / non-TTY, auto-pick is not final.
- If the model is usage-based, verify the product has that plan before handoff.
- **Deploy-existing = scaffolding only** except paywall-wiring tasks — [references/existing-server.md](references/existing-server.md).

## Language matrix

Host, serve, install, and input modes come from this table. Do not assume Cloudflare or npm.

| id | Serve | Port | Install | Manifest | Modes | File |
| --- | --- | --- | --- | --- | --- | --- |
| `ts` | `npm run dev` | 8787 | `npm install` | `package.json` | scratch, openapi | [references/languages/ts.md](references/languages/ts.md) |
| `python` | `./scripts/http.sh` | 3030 | `uv sync` | `pyproject.toml` | scratch | [references/languages/python.md](references/languages/python.md) |
| `ruby` | `./scripts/http.sh` | 3030 | `bundle install` | `Gemfile` | scratch | [references/languages/ruby.md](references/languages/ruby.md) |
| `go` | `./scripts/http.sh` | 3030 | `go mod tidy` | `go.mod` | scratch | [references/languages/go.md](references/languages/go.md) |
| `rust` | `./scripts/http.sh` | 3030 | `cargo fetch` | `Cargo.toml` | scratch | [references/languages/rust.md](references/languages/rust.md) |

Shared env: `SOLVAPAY_SECRET_KEY`, `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`. Local stack API: `http://localhost:3010` (never `:3001`).

## Gotchas

- Paid handlers use the language's respond helper — never raw `content` arrays.
- OpenAPI `describe.mjs` needs a **local** spec file; skip binary/multipart ops (`tier: "skip"`).
- `selections.json` stays **outside** the scaffold target.
- Don't scaffold into an unrelated app root without asking where the MCP server should live.

## Mandatory read order

1. This SKILL.md — routing, language + input mode.
2. [references/tool-design.md](references/tool-design.md) — shared contract (`account` viewer, `activate_plan`).
3. **Exactly one** `references/languages/<id>.md` from the matrix.
4. [references/languages/toolchain-gate.md](references/languages/toolchain-gate.md) — before scaffold.
5. One mode guide: [references/from-openapi/guide.md](references/from-openapi/guide.md) **or** [references/from-scratch/guide.md](references/from-scratch/guide.md) **or** [references/existing-server.md](references/existing-server.md).
6. Intent-driven OpenAPI: also [references/from-openapi/intent-driven.md](references/from-openapi/intent-driven.md) and [references/from-openapi/scaffold.md](references/from-openapi/scaffold.md).

Do not write a payable registration until steps 1–3 are loaded.

## Confirmation level (G0 — ask once)

[references/hitl-conventions.md](references/hitl-conventions.md).

> "How chatty should I be? `standard` (default) confirms each big decision; `auto` only confirms irreversible steps (scaffold, deploy, go-live); `chatty` reviews every intent and file."

## Routing

**1. Existing paid-MCP project?** SolvaPay MCP SDK already in the manifest + server boot file → [references/from-scratch/scaffold-and-extend.md](references/from-scratch/scaffold-and-extend.md). Do not re-scaffold.

**2. Greenfield — ask once:** *"Which language (`ts` / `python` / `ruby` / `go` / `rust`), and OpenAPI spec or hand-written tools?"* Reject OpenAPI unless the row's Modes include `openapi`.

| Pair | Guide | Validator |
| --- | --- | --- |
| spec + `ts` | [references/from-openapi/guide.md](references/from-openapi/guide.md) | `validate-selections.mjs` → scaffold → verify |
| scratch + any id | [references/from-scratch/guide.md](references/from-scratch/guide.md) | serve-command smoke from the matrix |
| existing MCP (add paywall) | [references/existing-server.md](references/existing-server.md) | tool invocation smoke |

Inside an unrelated app repo: **stop and ask where the MCP server should live**.

> **Dev mode (internal only).** `--dev` + preview tags: `npm create solvapay@preview <name> -- --type mcp --language <id> --dev`, `node scripts/scaffold-app.mjs … --dev`, `npx -y solvapay@preview init --language <id> --dev`. Never for end users.

**3. Host** is the matrix `Serve` / `Port` for the chosen id. TypeScript extra runtimes: [references/hosting/alternatives.md](references/hosting/alternatives.md). Optional custom UI: [references/mcp-apps-ui.md](references/mcp-apps-ui.md).

**4. Credentials:** [references/solvapay-init.md](references/solvapay-init.md) — `npx -y solvapay@latest init --language <id>`.

## OpenAPI flow & gates

`describe.mjs` → `selections.json` → `validate-selections.mjs` → `scaffold.mjs` → author tools → `solvapay init --language ts` → confirm product → verify → deploy. Never put `SOLVAPAY_SECRET_KEY` in `selections.json`. Gates: [references/hitl-conventions.md](references/hitl-conventions.md).

## Scripts

| Script | Action | Purpose |
| --- | --- | --- |
| `scripts/check-toolchain.mjs` | **Run** | Uniform registry / checkout gate |
| `scripts/scaffold-app.mjs` | **Run** | From-scratch scaffold, every language |
| `scripts/describe.mjs` | **Run** | Parse OpenAPI spec |
| `scripts/validate-selections.mjs` | **Run** | Validate `selections.json` |
| `scripts/scaffold.mjs` | **Run** | OpenAPI worker from selections |
| `scripts/README.md` | **See** | Resolution order |

## Verification loop

1. Run the mode validator (serve command from the matrix, verify script, or guide checklist).
2. On failure → language-file troubleshooting → fix → re-run until pass.
3. Then complete the handoff.

## Handoff template

```markdown
## MCP app handoff
- **Language / input mode:** <id> / from-openapi | from-scratch | existing-server
- **Host / URL:** [matrix host] / [url]
- **Tools authored:** [list]
- **Gates cleared:** G0–G[n]
- **Product ref:** [prd_... + how confirmed]
- **Plan / metering:** [free default / usage-based verified / needs action]
- **Sandbox:** [success + gate; skipped checks named]
- **Paid-path verification:** [paywallGate / merchantBootstrap: passed | skipped | not run]
- **Known gaps:** [if any]
```

## Task progress

- [ ] Read tool-design + **one** language file + toolchain-gate + mode guide
- [ ] Route (existing vs greenfield, language + input mode)
- [ ] `check-toolchain.mjs --language <id>` prints `ok`
- [ ] Complete mode guide (scratch: `scaffold-app.mjs`; OpenAPI: describe → validate → scaffold → author)
- [ ] `solvapay init --language <id>`
- [ ] Verification loop until pass
- [ ] Handoff template
