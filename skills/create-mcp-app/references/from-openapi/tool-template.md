# Behavioral contract: skill ↔ template

What `scaffold.mjs`, `verify.mjs`, and `test.mjs` assume the template at `create-solvapay/templates/mcp/from-openapi/` provides. The template can evolve without breaking the skill as long as this contract holds.

Rationale (why arrow wrapper, why single environment, etc.) lives in [design-notes.md](design-notes.md) — maintainer-only.

## Entrypoint shape

`src/worker.ts` exports a `fetch` that calls `createSolvaPayMcpFetch` with `mode: 'json-stateless'` and `hideToolsByAudience: ['ui']`, then threads the Workers `env` into generated tools via `additionalTools: ctx => registerTools(ctx, env)`. `src/tools/index.ts` exports the matching `registerTools(ctx, env)`; scaffold appends one import + one `register{OperationId}(ctx, env)` call per generated operation.

## Tool file shape

One file per operation in `src/tools/`, named after the camelCase `operationId`. Exports `register{OperationId}(ctx, env)`. All upstream calls route through `upstreamFetchJson` — never raw `fetch().json()`.

Both forms assume `src/types/upstream.ts` was generated via `npx openapi-typescript <spec> -o src/types/upstream.ts` (see [intent-driven.md#typed-upstream-recommended](intent-driven.md#typed-upstream-recommended)). The typed `upstreamFetchJson<T>` form is canonical; for the fallback when a spec doesn't define a 200 schema, see [Success-status fallback](#success-status-fallback).

### Paid tool

```ts
import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'
import type { operations } from '../types/upstream'
import { upstreamFetchJson } from '../lib/upstreamFetch'
import type { Env } from '../worker'

type Pet = operations['getPetById']['responses']['200']['content']['application/json']

export function registerGetPetById(ctx: AdditionalToolsContext, env: Env) {
  ctx.registerPayable('getPetById', {
    title: 'Get pet by ID',
    description: 'GET /pet/{petId} from PetStore API.',
    schema: { petId: z.number().int() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async ({ petId }, c) => {
      const url = new URL(`https://petstore.swagger.io/v2/pet/${petId}`)
      const data = await upstreamFetchJson<Pet>(url, {
        method: 'GET',
        headers: { authorization: `Bearer ${env.UPSTREAM_API_KEY}` },
      })
      return c.respond(data, { text: `Pet ${petId}: …` })
    },
  })
}
```

`c.respond(payload, { text })` packages `payload` into `structuredContent` for capable hosts and `text` into `content[0].text` for text-only hosts.

### Free tool

Same imports and same `upstreamFetchJson` call shape. Three differences:

- Use `ctx.server.registerTool(name, { inputSchema, annotations }, handler)` instead of `ctx.registerPayable(name, { schema, annotations, handler })` (note `inputSchema` vs `schema`).
- Handler signature is `async (args)` — no `c` callback.
- Return shape is the hand-rolled dual envelope: `{ content: [{ type: 'text', text }], structuredContent: data }`.

`ctx.respond` is exclusive to `registerPayable`; free tools always hand-roll the envelope.

### Success-status fallback

When picking the type argument for `upstreamFetchJson<T>`, walk this order against the operation's `responses`:

| Operation defines | Use as `<T>` |
| --- | --- |
| `responses['200']['content']['application/json']` | `operations[id]['responses']['200']['content']['application/json']` |
| Only `201` (e.g. create) | Same, with `'201'` |
| Only `204` or no JSON | `unknown` |
| No schema | `unknown` |

Never fall back to `Record<string, unknown>` — it advertises object-shape the spec doesn't promise.

### Auth header selection

| `upstreamAuth.kind` | Header | Per-operation signature | Per-handler pre-call |
| --- | --- | --- | --- |
| `none` | No header | `(ctx: AdditionalToolsContext)` | — |
| `bearer` | `` authorization: `Bearer ${env.UPSTREAM_API_KEY}` `` | `(ctx: AdditionalToolsContext, env: Env)` | — |
| `apiKey` | `` '<name>': `${env.UPSTREAM_API_KEY}` `` | `(ctx: AdditionalToolsContext, env: Env)` | — |
| `oauth2-client-credentials` | `` authorization: `Bearer ${token}` `` | `(ctx: AdditionalToolsContext, env: Env)` | `const token = await getAccessToken(env)` (imported from `'../lib/upstreamOAuth'`) right before URL construction |
| `apiKey-multi` | `...(JSON.parse(env.UPSTREAM_API_HEADERS ?? '{}') as Record<string, string>)` spread into the headers object | `(ctx: AdditionalToolsContext, env: Env)` | — |

For `apiKey-multi` (two or more static credential headers required together), scaffold seeds **one** env var, `UPSTREAM_API_HEADERS`, holding compact JSON keyed by header name → value. Generated tools spread it into the request headers — N-agnostic, header names stay in `.env` rather than the source.

`Accept: application/json` is set by `upstreamFetchJson` — generated tools never set it explicitly.

For the OAuth row, the helper at `src/lib/upstreamOAuth.ts` (shipped in `_base`) exchanges `UPSTREAM_OAUTH_CLIENT_ID` + `UPSTREAM_OAUTH_CLIENT_SECRET` against `UPSTREAM_OAUTH_TOKEN_URL` (HTTP Basic, `grant_type=client_credentials`), optionally passing `UPSTREAM_OAUTH_SCOPE` and `UPSTREAM_OAUTH_AUDIENCE`. The returned token is cached at module scope inside the Workers isolate until 30s before `expires_in` — every tool that runs in the same isolate reuses it.

## Upstream helper

`template/src/lib/upstreamFetch.ts` ships pre-baked. Every generated tool imports `upstreamFetchJson`. Contract:

- Sets `Accept: application/json` by default; override via `headers`.
- Reads the body as text first, then `JSON.parse`.
- Throws `UpstreamError` (typed instance with `status`, `contentType`, `bodySnippet`, `parseError`, `method`, `url`) on non-2xx OR JSON parse failure.

The thrown `UpstreamError` is **not caught** in the generated handler — both code paths convert it to an MCP error envelope:

| Path | Converter |
| --- | --- |
| Free | `@modelcontextprotocol/sdk` wraps into `{ isError: true, content: [{ type: 'text', text: error.message }] }` |
| Paid | SolvaPay's `formatError` wraps into the same shape; customer is not charged for upstream failures |

## Who writes what to `.env`

| Writer | Keys |
| --- | --- |
| `scaffold.mjs` | `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`, `UPSTREAM_API_KEY` (only when `kind` is `bearer` or `apiKey`), `UPSTREAM_OAUTH_TOKEN_URL` / `UPSTREAM_OAUTH_CLIENT_ID` / `UPSTREAM_OAUTH_CLIENT_SECRET` plus optional `UPSTREAM_OAUTH_SCOPE` / `UPSTREAM_OAUTH_AUDIENCE` (only when `kind` is `oauth2-client-credentials`), `UPSTREAM_API_HEADERS` (compact JSON; only when `kind` is `apiKey-multi`) |
| `npx -y solvapay@latest init` | `SOLVAPAY_SECRET_KEY` — appended via the CLI's append-safe writer, no clobber |
| Agent | One-time edit to `MCP_PUBLIC_BASE_URL` for custom-domain deploys (see [deploy.md](deploy.md) step 2); dev-mode wrapper seeds `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` when `scripts/scaffold.mjs --dev` is used |

`SOLVAPAY_SECRET_KEY`, `UPSTREAM_API_KEY`, the `UPSTREAM_OAUTH_*` family, and `UPSTREAM_API_HEADERS` are all uploaded as Worker Secrets; see [deploy.md](deploy.md) for the lifecycle. First deploy uploads missing secrets, but later `.env` edits do not refresh existing Worker secrets automatically — run `npx wrangler secret put <NAME>` for changed secrets before redeploy.

## Placeholders the skill substitutes

| Placeholder (literal) | Substituted with | Lives in |
| --- | --- | --- |
| `__WORKER_NAME__` | `selections.workerName` | `wrangler.jsonc` `name` |
| `__RESOURCE_URI_SLUG__` | `selections.workerName` | `src/worker.ts` `resourceUri` arg (`ui://<slug>/mcp-app.html`) |
| `__SOLVAPAY_PRODUCT_REF__` | `selections.solvapayProductRef` | `.env.example` |
| `__MCP_PUBLIC_BASE_URL__` | `selections.mcpPublicBaseUrl` | `.env.example` |

`template/src/tools/example.ts` and its `src/tools/index.ts` entry are removed wholesale rather than substituted — scaffold rewrites `src/tools/index.ts` from scratch. `PLACEHOLDERS` in `scripts/lib/template.mjs` is the source of truth.

## MCP wire-shape

Hosted by `createSolvaPayMcpFetch`:

- `/.well-known/oauth-protected-resource` returns `{ resource, authorization_servers, scopes_supported? }`.
- `/.well-known/oauth-authorization-server` returns `{ issuer, authorization_endpoint, token_endpoint, registration_endpoint? }`.
- `tools/list` includes the four intent tools (`upgrade`, `topup`, `activate_plan`, `manage_account`) plus generated tools. UI-only tools are hidden from text-only hosts via `hideToolsByAudience: ['ui']`.
- Paywall gate response: text-only narration in `content[0].text` naming the recovery intent tool; `structuredContent.gate` for programmatic consumers; no `_meta.ui` on the gate.
