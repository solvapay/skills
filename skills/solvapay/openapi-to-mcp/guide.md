# OpenAPI → MCP

Generate a SolvaPay-wired Cloudflare Workers MCP server from an OpenAPI document. State-based router — pick the module that matches the user's current situation, not a linear walkthrough.

## First time? Quickstart

In Claude Code or Cursor with this skill installed:

- **Have an OpenAPI spec already**: say _"Generate an MCP server from `path/to/openapi.json`"_
- **Want to expose an existing REST API but no spec yet**: say _"Wrap my REST API at <url> as MCP tools"_ and the agent will help you obtain a spec first
- **Already scaffolded; need to deploy / verify / test**: say _"My scaffolded MCP server is at `<path>`; help me deploy/verify/test"_

The skill auto-loads and routes to the appropriate module below.

## Guardrails (inherited from [../building-mcp-app/guide.md](../building-mcp-app/guide.md))

- Never expose `SOLVAPAY_SECRET_KEY` to client code, public env vars, or deploy-time plaintext. Upload via `wrangler secret put` and keep it in a gitignored `.env` only for local dev.
- Never wrap SolvaPay intent tools (`upgrade`, `topup`, `manage_account`, `activate_plan`) with `payable.mcp()` — they are the paywall recovery path.
- Never return a custom iframe or structured UI payload on a paywall gate. Gates are **text-only** in `content[0].text` naming the recovery intent tool.
- Always use `mode: 'json-stateless'` on Cloudflare Workers. Isolates don't pin across requests.
- Always hide UI-only virtual tools from text-only hosts with `hideToolsByAudience: ['ui']`.

## State-based routing

| User state | Route to |
| --- | --- |
| I have an OpenAPI / Swagger spec and want to know what I'd generate | [describe.md](describe.md) |
| I've reviewed the operations and want to generate the worker | [scaffold.md](scaffold.md) |
| I picked intent-driven mode and need to author the tool files | [intent-driven.md](intent-driven.md) |
| I have a scaffolded worker and need to wire it up to SolvaPay | [solvapay-init.md](solvapay-init.md) |
| I want to rotate or re-auth my SolvaPay key | [solvapay-init.md](solvapay-init.md) → [deploy.md](deploy.md) (push new secret + redeploy) |
| I have a local worker and want to deploy it | [deploy.md](deploy.md) |
| I tested with sandbox and want to swap in a live key | [deploy.md](deploy.md) (Go-live section) |
| I want to check if my worker satisfies the MCP contract | [verify.md](verify.md) |
| I want to check if my generated tools actually work | [test.md](test.md) |
| Tools generated but I want to hand-tune their shape / narration | [../building-mcp-app/tool-design.md](../building-mcp-app/tool-design.md) |

## End-to-end happy path

```
describe → curate → scaffold → solvapay-init → deploy → verify → test → tool-design (hand-tune)
```

## One-time setup

**Skill scripts** (`describe.mjs`, `scaffold.mjs`) share a single runtime dep (`@apidevtools/swagger-parser`). Install it once per skill checkout:

```bash
( cd skills/skills/solvapay/openapi-to-mcp/scripts && npm install )
```

**Scaffolded project scripts** (`verify.mjs`, `test.mjs`) ship inside the generated project. Run them from the project root with `node scripts/<name>.mjs`. `verify.mjs` has no extra deps; `test.mjs` needs `( cd scripts && npm install )` once inside the project (see [test.md](test.md)).

**Cloudflare prereq**: a workers.dev subdomain must be registered on your account before first deploy. `template/scripts/deploy.mjs` pre-flights and prints the dashboard URL if not — but registering up-front at `https://dash.cloudflare.com/<account>/workers/onboarding` avoids the round-trip.

## What you gather during curate (between `describe.mjs` and writing `selections.json`)

0. **Mode** — ask the user once: *"How should I shape the generated MCP tools? (1) **One-to-one** — one tool per OpenAPI operation (faithful, default). (2) **Intent-driven** — cluster operations into higher-level user goals like `manage_pet` or `find_pet` (better for LLM consumption, ~30 min more design work)."*. If intent-driven, set `mode: "intent-driven"` in `selections.json`, skip steps 1 below, and route to [intent-driven.md](intent-driven.md) right after `scaffold.mjs` finishes — the agent (you) authors `src/tools/*.ts` directly. If one-to-one (default), continue with the remaining steps.
1. **Tier overrides** per operation (`free` / `paid` / `skip`) — start from `describe.mjs`'s `suggestedTier` and confirm with the user. Mutating operations default to `paid`; if the user wants to ship paid-only later, mark them `skip` for now.
2. **`solvapayProductRef`** — optional in `selections.json`. Omit it during curate; `npx solvapay init` lists the account's products and asks the user to pick one (or auto-picks when there's only one / when `--yes` is set). Only the prereq survives: the user must have at least one product before running init. If they have none yet, route to [../provider-onboarding/guide.md](../provider-onboarding/guide.md) (full provider setup) or [../mcp-pay/guide.md](../mcp-pay/guide.md) (no-code hosted), then resume at init.
3. **`upstreamAuth` shape** — pick from `describe.mjs.securitySchemes`:
   - `http-bearer` → `{ kind: 'bearer', key: '<user supplies>' }`
   - `apiKey-header` → `{ kind: 'apiKey', in: 'header', name: '<from spec>', key: '<user supplies>' }`
   - No supported scheme → `{ kind: 'none' }` (only viable if the upstream tolerates anonymous calls)
4. **`mcpPublicBaseUrl`** — use `http://localhost:8787`. `deploy.mjs` auto-resolves the live workers.dev URL on first deploy. For custom domains, set explicitly (see [deploy.md](deploy.md) step 2).
5. **`workerName`** — kebab-case, used as both the Wrangler `name` and the resource URI slug.

Then write `selections.json` to a non-project path (`/tmp/selections-<uuid>.json`) and pass it via `--selections` to `scaffold.mjs`.

`SOLVAPAY_SECRET_KEY` is **not** in `selections.json` — `npx solvapay init` populates it after scaffold.

## Inputs the modules accept

- OpenAPI file path (`.json`, `.yaml`, `.yml`). Both OpenAPI 3.x and Swagger 2.0 are supported.
- HTTP URL → fetch it first into a local file, then pass the path.
- Pasted YAML / JSON → write to a temp file (`/tmp/spec-<uuid>.json`) then pass the path.

### Picking a spec

Pick a spec whose `servers[0]` (or, for Swagger 2.0, `host` + `basePath`) actually hosts the paths the spec declares. Generic example specs (e.g. the `learn.openapis.org` petstore) point at `petstore.swagger.io/v2` for marketing copy, but the real server there uses different paths (`/pet` singular, not `/pets` plural) and tools call out to a 404. `describe.mjs` probes `servers[0]` automatically and surfaces a `serverProbeMismatch` advisory when the spec doesn't match — verify before writing `selections.json`. For the petstore demo specifically, prefer `https://petstore.swagger.io/v2/swagger.json` (the spec that matches the running server). Full probe behavior: [describe.md#server-probe](describe.md#server-probe).

## What's intentionally out of scope (v1)

- **Idempotent regeneration** — re-running scaffold against an existing project hard-fails. Delete and re-scaffold.
- **OAuth2 / OpenID Connect / query / cookie auth** — emits an advisory; remediate with `tier: "skip"` per operation or `upstreamAuth.kind: "none"`.
- **Per-customer upstream credentials** — v1 uses a single server-side `UPSTREAM_API_KEY`.
- **Complex `oneOf` / `allOf` / `anyOf` request bodies** — fall back to `z.record(z.unknown())` with a TODO comment.

## References

- [references/selections-schema.md](references/selections-schema.md) — `selections.json` schema.
- [references/tool-template.md](references/tool-template.md) — behavioral contract between skill and template.
- [../building-mcp-app/tool-design.md](../building-mcp-app/tool-design.md) — read before hand-tuning generated tools.
