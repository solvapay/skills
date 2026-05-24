# OpenAPI → MCP

Generate a SolvaPay-wired Cloudflare Workers MCP server from an OpenAPI document. State-based router — pick the module that matches the user's current situation, not a linear walkthrough.

> Arrived from [../guide.md](../guide.md)? Right place. This guide owns scaffold → init → deploy → verify → test end-to-end; hand-tuning at the end returns to [../tool-design.md](../tool-design.md).

## Agent-driven path (this is you)

In Claude Code or Cursor with this skill installed:

- **Have an OpenAPI spec already**: say _"Generate an MCP server from `path/to/openapi.json`"_
- **Want to expose an existing REST API but no spec yet**: say _"Wrap my REST API at <url> as MCP tools"_ and the agent will help you obtain a spec first
- **Already scaffolded; need to deploy / verify / test**: say _"My scaffolded MCP server is at `<path>`; help me deploy/verify/test"_

The skill auto-loads and routes to the appropriate state-based module below (`describe.mjs` → curate → `scaffold.mjs` → `solvapay-init` → deploy → verify → test). Intent-driven clustering, per-operation tier curation, and hand-tuned narration all live on this path.

**Do not use `npm create solvapay` from an agent context.** The published CLI cannot author `src/tools/*.ts` because that step requires an LLM — it only ever emits one-to-one tools (one file per spec operation), which is rarely the right shape for a host LLM to navigate when the spec has more than a handful of operations.

## Human shortcut (terminal users only)

For humans at a terminal who already have a spec and explicitly want one-to-one tools, the published scaffolder runs the whole flow in one command:

```bash
npm create solvapay my-mcp -- --type mcp --openapi <url-or-path>
# or: pnpm create solvapay my-mcp -- --type mcp --openapi <url-or-path>
# or: yarn create solvapay my-mcp -- --type mcp --openapi <url-or-path>
```

It handles spec parsing, `selections.json` defaults (one-to-one mode, `suggestedTier` per operation), the project-local `npm install`, and the browser-based `solvapay init` (auth + product picker + `.env` writes) in one pass. Use this only when you are a human running it from a shell.

## Guardrails

See [../guide.md](../guide.md) for the umbrella's guardrails block. All apply to OpenAPI-generated tools.

## State-based routing

| User state | Route to |
| --- | --- |
| I have an OpenAPI / Swagger spec and want to know what I'd generate | [describe.md](describe.md) |
| I've reviewed the operations and want to generate the worker | [scaffold.md](scaffold.md) |
| I picked intent-driven mode and need to author the tool files | [intent-driven.md](intent-driven.md) |
| I have a scaffolded worker and need to wire it up to SolvaPay | [../solvapay-init.md](../solvapay-init.md) |
| I have a local worker and want to deploy it | [deploy.md](deploy.md) |
| I tested with sandbox and want to swap in a live key | [deploy.md](deploy.md) (Go-live section) |
| I want to check if my worker satisfies the MCP contract | [verify.md](verify.md) |
| I want to check if my generated tools actually work | [test.md](test.md) |
| Tools generated but I want to hand-tune their shape / narration | [../tool-design.md](../tool-design.md) |

## End-to-end happy path

```
describe → curate → scaffold → solvapay-init → deploy → verify → test → tool-design (hand-tune)
```

## One-time setup

**Scaffolder scripts** (`describe.mjs`, `scaffold.mjs`) live inside the published `create-solvapay` package (`packages/create-solvapay/scripts/mcp/` in the solvapay-sdk monorepo). They share a single runtime dep (`@apidevtools/swagger-parser`) which the CLI installs lazily on first use — no manual `npm install` step required.

For agents working directly against the package in a local checkout, install the helper deps once:

```bash
( cd solvapay-sdk/packages/create-solvapay/scripts/mcp && npm install )
```

**Scaffolded project scripts** (`verify.mjs`, `test.mjs`) ship inside the generated project. Run them from the project root with `node scripts/<name>.mjs`. `verify.mjs` has no extra deps; `test.mjs` needs `( cd scripts && npm install )` once inside the project (see [test.md](test.md)).

**Cloudflare prereq**: a workers.dev subdomain must be registered on your account before first deploy. `scripts/deploy.mjs` (shipped inside the scaffolded project) pre-flights and prints the dashboard URL if not — but registering up-front at `https://dash.cloudflare.com/<account>/workers/onboarding` avoids the round-trip. `deploy.mjs` also confirms the resolved workers.dev URL on every deploy so you don't accidentally inherit a subdomain from an unrelated worker — pass `--yes` (or set `SOLVAPAY_DEPLOY_YES=1`) for non-interactive use.

## What you gather during curate (between `describe.mjs` and writing `selections.json`)

0. **Mode** — after `describe.mjs` returns, count the operations and tell the user: *"Your spec has N operations. Two ways to shape the generated MCP tools: (1) **Intent-driven** (recommended in this context) — I cluster the N operations into a small number of higher-level semantic tools like `manage_pet` or `find_pet` and author them directly. The host LLM picks fewer, more meaningful tools better. (2) **One-to-one** — generate exactly N tool files matching the spec verbatim. Useful when the API surface IS the user-facing model, or when you want byte-for-byte traceability between the spec and the tools."*. If intent-driven (recommended), set `"mode": "intent-driven"` explicitly in `selections.json`, skip step 1 below, and route to [intent-driven.md](intent-driven.md) right after `scaffold.mjs` finishes — author `src/tools/<intent>.ts` files directly. If one-to-one, set `"mode": "one-to-one"` (or omit `mode` — `scaffold.mjs` defaults to one-to-one for terminal-safety) and continue with the remaining steps.
1. **Tier overrides** per operation (`free` / `paid` / `skip`) — start from `describe.mjs`'s `suggestedTier` and confirm with the user. Mutating operations default to `paid`; if the user wants to ship paid-only later, mark them `skip` for now.

   **Read-only-first when the API is unfamiliar.** If you're wrapping an upstream you've never integrated before, ship the read-only / idempotent operations first (mostly `GET` / `HEAD`) and `tier: "skip"` the mutating ones. Get auth, errors, and the verifier checks green against the safe surface before exposing `POST` / `PUT` / `PATCH` / `DELETE` to the LLM. Add the mutating operations in a follow-up once their semantics and pricing are explicitly approved. Skip this rule when the product's core value *is* a write/action workflow (e.g. "send transactional email", "create invoice") — but still keep `annotations: { destructiveHint: true }` on those tools and confirm the destructive scope with the user before scaffolding.
2. **`solvapayProductRef`** — optional in `selections.json`. Omit it during curate; `npx solvapay init` lists the account's products and asks the user to pick one (or auto-picks when there's only one / when `--yes` is set). Only the prereq survives: the user must have at least one product before running init. If they have none yet, ask the user to create a product in SolvaPay Console (https://app.solvapay.com), then resume at init.
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

### If the user gave you a Swagger UI URL

URLs like `https://example.com/api-docs/`, `/swagger-ui/`, or `/docs/` point at the rendered docs page, not the spec itself. The spec usually lives next to the page. Try these in order before giving up:

1. `<base>/swagger.json`
2. `<base>/openapi.json`
3. `<base>/openapi.yaml` or `<base>/swagger.yaml`
4. `<base>?format=yaml` or `<base>?format=json`
5. Strip the trailing path segment (`/api-docs/` → `/`) and try `/swagger.json`, `/openapi.json` at the root.

If none of those resolve, view-source on the docs page and look for the `url:` field in the `SwaggerUIBundle({ url: '…' })` config — it's the canonical spec source.

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
- [../tool-design.md](../tool-design.md) — read before hand-tuning generated tools.
