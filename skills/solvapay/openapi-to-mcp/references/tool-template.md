# Behavioral contract: skill ↔ template

What `scaffold.mjs`, `verify.mjs`, and `test.mjs` assume the template at `openapi-to-mcp/template/` provides. The template can evolve without breaking the skill as long as this contract holds.

Rationale (why arrow wrapper, why single environment, etc.) lives in [design-notes.md](design-notes.md) — maintainer-only.

## Entrypoint shape

`src/worker.ts` exports a `fetch` that calls `createSolvaPayMcpFetch` with `mode: 'json-stateless'` and `hideToolsByAudience: ['ui']`, then threads the Workers `env` into the generated tools via `additionalTools: ctx => registerTools(ctx, env)`. `src/tools/index.ts` exports the matching `registerTools(ctx, env)`; scaffold appends one import + one `registerXxx(ctx, env)` call per generated operation.

Full file: [examples/cloudflare-workers-mcp/src/worker.ts](../../../../solvapay-sdk/examples/cloudflare-workers-mcp/src/worker.ts).

## Tool file shape

One file per operation in `src/tools/`, named after the camelCase `operationId`. Exports `register{OperationId}(ctx, env)`. All upstream calls route through `upstreamFetchJson` (see [Upstream helper](#upstream-helper)) — never raw `fetch().json()`.

Both examples assume `src/types/upstream.ts` has been generated via `npx openapi-typescript path/to/spec.json -o src/types/upstream.ts` (see [../intent-driven.md#typed-upstream-recommended](../intent-driven.md#typed-upstream-recommended)). The typed `upstreamFetchJson<T>` form is canonical; for the fallback when a spec doesn't define a 200 schema, see [Success-status fallback](#success-status-fallback) below.

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
    schema: {
      petId: z.number().int(),
    },
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

```ts
import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'
import type { operations } from '../types/upstream'
import { upstreamFetchJson } from '../lib/upstreamFetch'
import type { Env } from '../worker'

type Pets = operations['listPets']['responses']['200']['content']['application/json']

export function registerListPets(ctx: AdditionalToolsContext, env: Env) {
  ctx.server.registerTool(
    'listPets',
    {
      title: 'List pets',
      description: 'GET /pets from PetStore API.',
      inputSchema: { limit: z.number().int().optional() },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ limit }) => {
      const url = new URL('https://petstore.swagger.io/v2/pets')
      if (limit !== undefined) url.searchParams.set('limit', String(limit))
      const data = await upstreamFetchJson<Pets>(url, {
        method: 'GET',
        headers: { authorization: `Bearer ${env.UPSTREAM_API_KEY}` },
      })
      return {
        content: [{ type: 'text', text: `Found ${data.length} pets.` }],
        structuredContent: data,
      }
    },
  )
}
```

Free tools call `ctx.server.registerTool` from `@modelcontextprotocol/sdk` directly and hand-roll the dual envelope; `ctx.respond` is exclusive to `registerPayable`.

### Success-status fallback

When picking the type argument for `upstreamFetchJson<T>`, walk this fallback order against the operation's `responses` block:

| Operation defines                                 | Use as `<T>`                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `responses['200']['content']['application/json']` | `operations[id]['responses']['200']['content']['application/json']` |
| Only `201` (e.g. create)                          | Same, with `'201'`                                                  |
| Only `204` or no JSON                             | `unknown`                                                           |
| No schema at all                                  | `unknown`                                                           |

Never fall back to `Record<string, unknown>` — it advertises object-shape that the spec doesn't promise.

### Auth header selection

| `upstreamAuth.kind` | Header | Per-operation signature |
| --- | --- | --- |
| `none` | No header. Headers block omitted. | `(ctx: AdditionalToolsContext)` |
| `bearer` | `` authorization: `Bearer ${env.UPSTREAM_API_KEY}` `` | `(ctx: AdditionalToolsContext, env: Env)` |
| `apiKey` | `` '<name>': `${env.UPSTREAM_API_KEY}` `` | `(ctx: AdditionalToolsContext, env: Env)` |

`Accept: application/json` is set by `upstreamFetchJson` — generated tools never set it explicitly.

## Upstream helper

`template/src/lib/upstreamFetch.ts` ships pre-baked. Every generated tool imports `upstreamFetchJson` from it. The helper:

- Sets `Accept: application/json` by default (caller can override via `headers`). Without this, content-negotiating upstreams (petstore.swagger.io is the canonical offender) default to XML.
- Reads the body as text *first*, then attempts `JSON.parse`. A non-JSON 404 body lands as a typed error, not a bare `Unexpected token '<'`.
- Throws `UpstreamError` on non-2xx OR JSON parse failure. The error message is multi-line:
  ```
  Upstream GET https://petstore.swagger.io/v2/pets returned 404 application/json
  Body snippet: {"code":404,"type":"unknown","message":"null for uri: ..."}
  ```
- Keeps structured fields (`status`, `contentType`, `bodySnippet`, `parseError`, `method`, `url`) on the `UpstreamError` instance for hand-tuned tools that want to `catch` and branch (e.g. treat 404 as "not found" silently, surface 429 as a nudge).

### Error propagation

The thrown `UpstreamError` is **not caught inside the generated handler**. Both paths convert it to a proper MCP error envelope automatically:

| Path | What converts the throw |
| --- | --- |
| Free | `@modelcontextprotocol/sdk` wraps the throw into `{ isError: true, content: [{ type: 'text', text: error.message }] }`. |
| Paid | SolvaPay's `formatError` wraps the throw into the same shape. The customer is not charged for an upstream failure — `payable` only records usage on a successful merchant return. |

## Who writes what to `.env`

| Writer | Keys |
| --- | --- |
| `scaffold.mjs` | `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`, `UPSTREAM_API_KEY` (only when `kind` is `bearer` or `apiKey`) |
| `npx solvapay init` | `SOLVAPAY_SECRET_KEY` — appended via the CLI's append-safe writer, no clobber |
| Agent | One-time edit to `MCP_PUBLIC_BASE_URL` only for custom-domain deploys (see [../deploy.md](../deploy.md) step 2) |

`SOLVAPAY_SECRET_KEY` and `UPSTREAM_API_KEY` are uploaded as Worker Secrets; see [../deploy.md](../deploy.md) for the lifecycle.

## Placeholders the skill substitutes

| Placeholder (literal) | Substituted with | Lives in |
| --- | --- | --- |
| `__WORKER_NAME__` | `selections.workerName` | `wrangler.jsonc` `name` field |
| `__RESOURCE_URI_SLUG__` | `selections.workerName` | `src/worker.ts` `resourceUri` arg (`ui://<slug>/mcp-app.html`) |
| `__SOLVAPAY_PRODUCT_REF__` | `selections.solvapayProductRef` | `.env.example` |
| `__MCP_PUBLIC_BASE_URL__` | `selections.mcpPublicBaseUrl` | `.env.example` |

The example tool (`src/tools/example.ts`) and its reference in `src/tools/index.ts` are removed wholesale rather than substituted — scaffold rewrites `src/tools/index.ts` from scratch with the operations it generated.

The `PLACEHOLDERS` export in `scripts/lib/template.mjs` is the source of truth for this table.

## MCP wire-shape

Hosted by `createSolvaPayMcpFetch`:

- `/.well-known/oauth-protected-resource` returns `{ resource, authorization_servers, scopes_supported? }`.
- `/.well-known/oauth-authorization-server` returns `{ issuer, authorization_endpoint, token_endpoint, registration_endpoint? }`.
- `tools/list` includes the four intent tools (`upgrade`, `topup`, `activate_plan`, `manage_account`) and the generated tools. UI-only tools (`create_payment_intent`, `create_topup_payment_intent`, …) are hidden from text-only hosts via `hideToolsByAudience: ['ui']`.
- Paywall gate response: text-only narration in `content[0].text` naming the recovery intent tool, `structuredContent.gate` for programmatic consumers, no `_meta.ui` on the gate (the iframe only mounts on deliberate intent-tool calls).
