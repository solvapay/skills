# Behavioral contract: skill ↔ template

What `scaffold.mjs`, `verify.mjs`, and `test.mjs` assume the template at `openapi-to-mcp/template/` provides. The template can evolve without breaking the skill as long as this contract holds.

## Entrypoint shape

`src/worker.ts` calls `createSolvaPayMcpFetch` from `@solvapay/mcp/fetch`:

```ts
import { createSolvaPay } from '@solvapay/server'
import { createSolvaPayMcpFetch } from '@solvapay/mcp/fetch'
import { registerTools } from './tools'

export interface Env {
  SOLVAPAY_SECRET_KEY: string
  SOLVAPAY_PRODUCT_REF: string
  MCP_PUBLIC_BASE_URL: string
  SOLVAPAY_API_BASE_URL?: string
  UPSTREAM_API_KEY?: string
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const handler = createSolvaPayMcpFetch({
      solvaPay: createSolvaPay({ apiKey: env.SOLVAPAY_SECRET_KEY }),
      productRef: env.SOLVAPAY_PRODUCT_REF,
      publicBaseUrl: env.MCP_PUBLIC_BASE_URL,
      mode: 'json-stateless',
      hideToolsByAudience: ['ui'],
      additionalTools: ctx => registerTools(ctx, env),
    })
    return handler(req)
  },
} satisfies ExportedHandler<Env>
```

The arrow wrapper `ctx => registerTools(ctx, env)` threads the Workers `env` binding (which the SDK's `additionalTools` hook does not provide) into generated tool handlers so they can read `env.UPSTREAM_API_KEY`. Adapted from [examples/cloudflare-workers-mcp/src/worker.ts](../../../../solvapay-sdk/examples/cloudflare-workers-mcp/src/worker.ts) lines 80–109.

**Consumers**: `scaffold.mjs` substitutes placeholders here; `verify.mjs` asserts the OAuth + tools/list shape this produces.

## Registration extension point

`src/tools/index.ts` exports a single `registerTools` function. Scaffold appends imports above and `registerXxx(ctx, env)` calls inside.

```ts
import type { AdditionalToolsContext } from '@solvapay/mcp'
import type { Env } from '../worker'
// Scaffold appends one import per generated operation here.

export function registerTools(ctx: AdditionalToolsContext, env: Env) {
  // Scaffold appends one registerXxx(ctx, env) call per generated operation here.
}
```

`registerTools` always takes `(ctx, env)` regardless of `selections.json.upstreamAuth.kind`. The template's `src/worker.ts` ships with `additionalTools: ctx => registerTools(ctx, env)` baked in and scaffold doesn't rewrite it, so the aggregator signature has to match. For `upstreamAuth.kind === 'none'`, `env` is in scope but unused — individual per-operation handlers still drop `env` from their own signatures (see [Tool file shape](#tool-file-shape)).

The template ships an empty `registerTools(ctx, env)` plus one example tool (`src/tools/example.ts`) that scaffold removes wholesale after copying.

**Consumer**: `scaffold.mjs`.

## Tool file shape

One file per operation, named after the camelCase `operationId`. Exports `register{OperationId}(ctx, env)`. All upstream calls route through `upstreamFetchJson` (see [Upstream helper](#upstream-helper) below) — never raw `fetch().json()`.

### Paid tool

```ts
import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'
import { upstreamFetchJson } from '../lib/upstreamFetch'
import type { Env } from '../worker'

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
      const data = await upstreamFetchJson<Record<string, unknown>>(url, {
        method: 'GET',
        headers: { authorization: `Bearer ${env.UPSTREAM_API_KEY}` },
      })
      return c.respond(data, { text: `Pet ${petId}: …` })
    },
  })
}
```

`c.respond(payload, { text })` is the SolvaPay `ResponseContext` helper. It packages `payload` into `structuredContent` for capable hosts and `text` into `content[0].text` for text-only hosts.

### Free tool

```ts
import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'
import { upstreamFetchJson } from '../lib/upstreamFetch'
import type { Env } from '../worker'

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
      const data = await upstreamFetchJson<Record<string, unknown>>(url, {
        method: 'GET',
        headers: { authorization: `Bearer ${env.UPSTREAM_API_KEY}` },
      })
      return {
        content: [{ type: 'text', text: `Found ${(data as { id: number }[]).length} pets.` }],
        structuredContent: data,
      }
    },
  )
}
```

`ctx.respond` is exclusive to `registerPayable`'s handler context. Free tools call `ctx.server.registerTool` from `@modelcontextprotocol/sdk` directly and hand-roll the dual envelope.

### Auth header selection

| `upstreamAuth.kind` | Header | Per-operation `register{OperationId}` signature |
| --- | --- | --- |
| `none` | No header. Headers block omitted. | `(ctx: AdditionalToolsContext)` |
| `bearer` | `` authorization: `Bearer ${env.UPSTREAM_API_KEY}` `` | `(ctx: AdditionalToolsContext, env: Env)` |
| `apiKey` | `` '<name>': `${env.UPSTREAM_API_KEY}` `` | `(ctx: AdditionalToolsContext, env: Env)` |

`Accept: application/json` is set by `upstreamFetchJson` (see [Upstream helper](#upstream-helper)), not by `scaffold.mjs`. Generated tools never set it explicitly.

Both authenticated branches wrap `env.UPSTREAM_API_KEY` (typed `string | undefined` in `Env`) in a template literal so the header value satisfies `HeadersInit`'s `string` requirement. The runtime safety net is `UPSTREAM_API_KEY` on the Worker — uploaded from `.env` by `deploy.mjs` on first deploy (see [deploy.md](../deploy.md)), not a compile-time guard.

**Consumers**: `scaffold.mjs` emits these files; `test.mjs` invokes them with synthesised inputs.

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

| Path | Handler | What converts the throw |
| --- | --- | --- |
| Free | `ctx.server.registerTool(name, ..., handler)` | `@modelcontextprotocol/sdk` wraps the throw into `{ isError: true, content: [{ type: 'text', text: error.message }] }`. |
| Paid | `ctx.registerPayable(name, { handler })` | SolvaPay's `formatError` wraps the throw into `{ isError: true, content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] }`. The customer is not charged for an upstream failure (the `payable` wrapper only records usage on a successful merchant return). |

**Consumers**: `scaffold.mjs` emits the import line and the helper call; the helper file itself is part of `template/` and copied verbatim.

## Env vars the entrypoint reads

| Var | Read by | Source |
| --- | --- | --- |
| `SOLVAPAY_SECRET_KEY` | `createSolvaPay` in `src/worker.ts` | `wrangler secret put` in deployed runs; `.env` for `wrangler dev`. Populated by `solvapay-init`. |
| `SOLVAPAY_PRODUCT_REF` | `createSolvaPayMcpFetch` | `.env` (`--var` override at deploy time). Populated by `scaffold`. |
| `MCP_PUBLIC_BASE_URL` | `createSolvaPayMcpFetch` (OAuth issuer) | `.env` (`--var` override). Auto-resolved by `deploy.mjs` on first workers.dev deploy; set explicitly for custom domains. |
| `SOLVAPAY_API_BASE_URL` | `createSolvaPay` (optional) | `.env`, defaults to `https://api.solvapay.com`. |
| `UPSTREAM_API_KEY` | Tool handlers via `env.UPSTREAM_API_KEY` (closed over from `fetch`) | Uploaded from `.env` by `deploy.mjs` on first deploy; `.env` for `wrangler dev`. Populated by `scaffold` from `selections.upstreamAuth.key`. Omitted when `kind: "none"`. |

`UPSTREAM_API_KEY` is read inside tool handlers, not by the entrypoint factory.

**Consumers**: `scaffold` writes non-SolvaPay-secret vars; `solvapay-init` writes `SOLVAPAY_SECRET_KEY`; `deploy` uploads secrets.

## Who writes what to `.env`

| Writer | Keys |
| --- | --- |
| `scaffold.mjs` | `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`, `UPSTREAM_API_KEY` (only when `kind` is `bearer` or `apiKey`) |
| `npx solvapay init` | `SOLVAPAY_SECRET_KEY` — appended via the CLI's append-safe writer, no clobber |
| Agent | One-time edit to `MCP_PUBLIC_BASE_URL` only for custom-domain deploys (see [../deploy.md](../deploy.md) step 2) |

No other module touches `.env`.

## `.env` + Worker Secret lifecycle

`SOLVAPAY_SECRET_KEY` and `UPSTREAM_API_KEY` are both secrets:

- Written to `.env` (gitignored) so `wrangler dev` picks them up locally.
- `SOLVAPAY_SECRET_KEY` is pushed via a one-time `wrangler secret put SOLVAPAY_SECRET_KEY` (value from `.env`).
- `UPSTREAM_API_KEY` is uploaded from `.env` by `deploy.mjs` when present and not already on the worker. Rotate manually with `wrangler secret put UPSTREAM_API_KEY`.
- **Not** passed via `--var` in the deploy script (reserved for non-secret values).

Go-live is a key swap, not a separate environment: the user replaces `SOLVAPAY_SECRET_KEY` in `.env` with `sk_live_…`, re-runs `wrangler secret put SOLVAPAY_SECRET_KEY`, redeploys. Single worker, single secret slot.

Mirrors [examples/cloudflare-workers-mcp/README.md](../../../../solvapay-sdk/examples/cloudflare-workers-mcp/README.md) lines 108–136, simplified to one environment.

**Consumers**: `scaffold` + `solvapay-init` + `deploy`.

## Placeholders the skill substitutes

| Placeholder (literal) | Substituted with | Lives in |
| --- | --- | --- |
| `__WORKER_NAME__` | `selections.workerName` | `wrangler.jsonc` `name` field |
| `__RESOURCE_URI_SLUG__` | `selections.workerName` | `src/worker.ts` `resourceUri` arg (`ui://<slug>/mcp-app.html`) |
| `__SOLVAPAY_PRODUCT_REF__` | `selections.solvapayProductRef` | `.env.example` (template only; `.env` is generated separately) |
| `__MCP_PUBLIC_BASE_URL__` | `selections.mcpPublicBaseUrl` | `.env.example` |

Substitution is straight string-replace (not template interpolation) so the template files remain valid TypeScript / JSON / JSONC standalone — editors and CI lint them without `scaffold.mjs` ever having run.

The example tool (`src/tools/example.ts`) and its references in `src/tools/index.ts` are removed wholesale rather than substituted. Scaffold rewrites `src/tools/index.ts` from scratch with the operations it generated.

**Consumer**: `scaffold.mjs` (the `PLACEHOLDERS` export in `scripts/lib/template.mjs` is the source of truth for the substitution table).

## MCP wire-shape

Hosted by `createSolvaPayMcpFetch`:

- `/.well-known/oauth-protected-resource` returns `{ resource, authorization_servers, scopes_supported? }`.
- `/.well-known/oauth-authorization-server` returns `{ issuer, authorization_endpoint, token_endpoint, registration_endpoint? }`.
- `tools/list` includes the four intent tools (`upgrade`, `topup`, `activate_plan`, `manage_account`) and the generated tools. UI-only tools (`create_payment_intent`, `create_topup_payment_intent`, …) are hidden from text-only hosts via `hideToolsByAudience: ['ui']`.
- Paywall gate response: text-only narration in `content[0].text` naming the recovery intent tool, `structuredContent.gate` for programmatic consumers, no `_meta.ui` on the gate (the iframe only mounts on deliberate intent-tool calls).

**Consumers**: `verify.mjs` asserts these; `test.mjs` relies on them when interpreting tool responses.
