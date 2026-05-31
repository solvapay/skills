# intent-driven patterns — the three templates

Code templates for the three intent-tool shapes referenced from [intent-driven.md](intent-driven.md). Read the design context in [intent-driven.md](intent-driven.md) (mode question, clustering heuristics, gate contracts, tier rules) **before** copy-pasting from this file. The contract for `registerPayable` / `c.respond` lives in [../tool-design.md](../tool-design.md) — non-negotiable, regardless of how familiar these templates feel.

## Upstream auth headers (by `upstreamAuth.kind`)

In intent-driven mode the scaffolder writes **no** tool files — so you inject the upstream credential yourself in every tool's `headers`. Scaffold has already seeded the secret(s) into `.env` and declared them on the `Env` interface based on `selections.json.upstreamAuth.kind`; your job is to read them off `env` in each handler. Match the snippet to the kind:

| `upstreamAuth.kind` | `env` binding(s) | Header snippet inside `upstreamFetchJson` |
| --- | --- | --- |
| `none` | — | `headers: { 'content-type': 'application/json' }` (drop the `env` param from the register fn) |
| `bearer` | `UPSTREAM_API_KEY` | `` authorization: `Bearer ${env.UPSTREAM_API_KEY}` `` |
| `apiKey` | `UPSTREAM_API_KEY` | `'<header-name>': env.UPSTREAM_API_KEY` (header name from the spec, lower-cased) |
| `oauth2-client-credentials` | `UPSTREAM_OAUTH_*` | `const token = await getAccessToken(env)` before the call, then `` authorization: `Bearer ${token}` `` (import `getAccessToken` from `'../lib/upstreamOAuth'`) |
| **`apiKey-multi`** | `UPSTREAM_API_HEADERS` | spread the whole header set (see below) |

### `apiKey-multi` — spread `UPSTREAM_API_HEADERS`

For APIs that require **two or more static credential headers** (e.g. `x-leyr-client-id` + `x-leyr-client-secret`, or VTEX's `X-VTEX-API-AppKey` + `X-VTEX-API-AppToken`), scaffold seeds a **single** env var, `UPSTREAM_API_HEADERS`, holding a compact-JSON object keyed by header name → value. Spread it into every request's `headers` — don't hard-code the header names:

```ts
const data = await upstreamFetchJson<Appointment>(url, {
  method: 'POST',
  headers: {
    ...(JSON.parse(env.UPSTREAM_API_HEADERS ?? '{}') as Record<string, string>),
    'content-type': 'application/json',
  },
  body: JSON.stringify({ /* ... */ }),
})
```

This is N-agnostic (works for two headers or three), keeps the header names in `.env` rather than the source, and matches exactly what the one-to-one codegen emits. The register function takes `(ctx, env)` because the handler reads `env`. For a parallel fan-out, build the spread once and reuse it across legs:

```ts
const upstreamHeaders = JSON.parse(env.UPSTREAM_API_HEADERS ?? '{}') as Record<string, string>
const [a, b] = await Promise.all([
  upstreamFetchJson<A>(urlA, { headers: upstreamHeaders }),
  upstreamFetchJson<B>(urlB, { headers: upstreamHeaders }),
])
```

> The templates below use the `bearer` snippet (`Bearer ${env.UPSTREAM_API_KEY}`) for brevity. If your spec resolved to a different kind, swap the header block per the table above — the rest of each pattern is unchanged.

## The three patterns

Every intent tool follows one of these three shapes. Copy the template, fill in the spec-specific bits, drop it into `src/tools/`.

### Pattern 1 — Rename (1 intent ← 1 op)

Use when an OpenAPI operation has an awkward `operationId` (`getPetByIdUsingGET_1`), unclear param names, or a description that doesn't match how a user would describe the goal.

```ts
import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'
import type { Env } from '../worker'
import type { operations } from '../types/upstream'
import { upstreamFetchJson } from '../lib/upstreamFetch'

const UPSTREAM_BASE = 'https://petstore.swagger.io/v2'

type Pet = operations['getPetById']['responses']['200']['content']['application/json']

export function registerFindPet(ctx: AdditionalToolsContext, env: Env) {
  ctx.server.registerTool(
    'find_pet',
    {
      title: 'Find a pet by ID',
      description: 'Look up a single pet by its numeric ID. Returns the pet record or a not-found error.',
      inputSchema: {
        petId: z.number().int().describe('Numeric ID of the pet to fetch.'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ petId }) => {
      const data = await upstreamFetchJson<Pet>(
        `${UPSTREAM_BASE}/pet/${petId}`,
        {
          method: 'GET',
          headers: { authorization: `Bearer ${env.UPSTREAM_API_KEY}` },
        },
      )
      return {
        content: [{ type: 'text', text: `Found pet ${petId}. Render as a card showing name, status, and category.` }],
        structuredContent: data,
      }
    },
  )
}
```

For a paid rename, swap `ctx.server.registerTool(name, { ... }, handler)` for `ctx.registerPayable(name, { schema: { ... }, handler: async (input, c) => c.respond(data, { text: '…' }) })` — same template, different envelope.

### Pattern 2 — Action (1 intent ← N ops via discriminator)

Use for CRUD-style resources. One tool, one mutating-paywall gate, branching by an `action` discriminator.

```ts
import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'
import type { Env } from '../worker'
import type { operations } from '../types/upstream'
import { upstreamFetchJson } from '../lib/upstreamFetch'

const UPSTREAM_BASE = 'https://petstore.swagger.io/v2'

type Pet = operations['addPet']['responses']['200']['content']['application/json']

export function registerManagePet(ctx: AdditionalToolsContext, env: Env) {
  ctx.registerPayable('manage_pet', {
    title: 'Create, update, or delete a pet',
    description:
      'Mutate the merchant pet catalogue. `action: "create"` adds a new pet, `"update"` modifies an existing one, `"delete"` removes by ID. 1 credit per call.',
    schema: {
      action: z.enum(['create', 'update', 'delete']).describe('Which mutation to perform.'),
      petId: z.number().int().optional().describe('Required for update and delete.'),
      name: z.string().optional().describe('Required for create; optional for update.'),
      status: z.enum(['available', 'pending', 'sold']).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    handler: async (input, c) => {
      const headers = {
        authorization: `Bearer ${env.UPSTREAM_API_KEY}`,
        'content-type': 'application/json',
      }
      switch (input.action) {
        case 'create': {
          const data = await upstreamFetchJson<Pet>(`${UPSTREAM_BASE}/pet`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: input.name, status: input.status ?? 'available' }),
          })
          return c.respond(data, { text: `Created pet "${input.name}". Render as a card with the new ID.` })
        }
        case 'update': {
          const data = await upstreamFetchJson<Pet>(`${UPSTREAM_BASE}/pet`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ id: input.petId, name: input.name, status: input.status }),
          })
          return c.respond(data, { text: `Updated pet ${input.petId}.` })
        }
        case 'delete': {
          // deletePet returns no JSON body — fall back to `unknown`.
          const data = await upstreamFetchJson<unknown>(
            `${UPSTREAM_BASE}/pet/${input.petId}`,
            { method: 'DELETE', headers },
          )
          return c.respond(data, { text: `Deleted pet ${input.petId}.` })
        }
      }
    },
  })
}
```

The gate runs **once** before the handler — switch branches don't re-check balance.

#### Common pitfall: `c.respond<T>` across switch branches

When each switch branch passes a differently-typed payload, TypeScript can't infer a single `ResponseResult<T>` for the dispatcher and rejects it with errors like `Type 'ResponseResult<Pet>' is not assignable to type 'ResponseResult<User>'`. Fix by pinning one generic across the dispatcher:

```ts
// Wrong — three different Ts, the inferred union doesn't unify.
case 'create': return c.respond(petData, { text: '…' })       // T = Pet
case 'update': return c.respond(userData, { text: '…' })      // T = User
case 'delete': return c.respond(deleteResult, { text: '…' })  // T = unknown

// Right — pin T = unknown at the dispatcher; runtime envelope unchanged.
case 'create': return c.respond<unknown>(petData, { text: '…' })
case 'update': return c.respond<unknown>(userData, { text: '…' })
case 'delete': return c.respond<unknown>(deleteResult, { text: '…' })
```

The gate behavior, narration shape, and JSON-RPC envelope are all unchanged — `unknown` is purely a TypeScript-level relaxation for the dispatcher. Use the narrow `<Pet>` / `<User>` form when you have a single-branch tool and want the payload type echoed back through `c.respond`'s return type.

### Pattern 3 — Fan-out (1 intent ← N ops in parallel)

Use for "give me a complete view of X" or "search across these endpoints".

```ts
import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'
import type { Env } from '../worker'
import type { operations } from '../types/upstream'
import { upstreamFetchJson } from '../lib/upstreamFetch'

const UPSTREAM_BASE = 'https://petstore.swagger.io/v2'

type Pet = operations['getPetById']['responses']['200']['content']['application/json']
type Inventory = operations['getInventory']['responses']['200']['content']['application/json']

export function registerPetDashboard(ctx: AdditionalToolsContext, env: Env) {
  ctx.registerPayable('pet_dashboard', {
    title: 'Full dashboard for a pet',
    description:
      'Fetches a pet plus the orders that reference it, in parallel. Use when the user wants a complete view rather than a single field.',
    schema: {
      petId: z.number().int().describe('Pet to inspect.'),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async ({ petId }, c) => {
      const headers = { authorization: `Bearer ${env.UPSTREAM_API_KEY}` }
      const [pet, inventory] = await Promise.all([
        upstreamFetchJson<Pet>(`${UPSTREAM_BASE}/pet/${petId}`, { headers }),
        upstreamFetchJson<Inventory>(`${UPSTREAM_BASE}/store/inventory`, { headers }),
      ])
      const merged = { pet, inventory }
      return c.respond(merged, {
        text: `Dashboard for pet ${petId}. Render pet as a card, inventory as a small status-count table beneath.`,
      })
    },
  })
}
```

Pick a merge strategy based on shape:

| Backing op shapes | Merge strategy |
| --- | --- |
| Arrays of the same record type | Concat: `result1.concat(result2)` |
| Disjoint object payloads | Wrap each in a named key: `{ pet, orders }` |
| Same-shape objects | Shallow-merge with conflict policy: `{ ...a, ...b }` |

If any leg fails, the whole intent fails — `Promise.all` rejects on first error and `upstreamFetchJson` throws `UpstreamError`, which surfaces as the standard `{ isError: true }` envelope. Use `Promise.allSettled` instead when partial results are acceptable.

## Schema-design crib sheet

When merging params across ops into one intent schema:

- **Required fields all backing ops share** → keep required at top level (e.g. `id` on `manage_pet`).
- **Disjoint param sets** → make them optional and annotate which `action` requires which in the `.describe()` string.
- **Discriminator field** → always required, always `z.enum([...])`. Never `z.string()` — the LLM needs the enum to know its options.
- **Drop params the LLM is unlikely to pass.** A `tag` filter that only takes one obscure value isn't worth the schema noise. Hard-code it if the merchant always wants the same value.
- **Prefer fewer params over completeness.** If the OpenAPI op has 12 query params and most LLMs only ever pass 2, expose only those 2.

The intent schema is the contract you're inviting the LLM to use. Optimise it for "what would a goal-driven user ask for", not "what does the upstream support".

## Aggregator update

After authoring `src/tools/manage_pet.ts`, edit `src/tools/index.ts`:

```ts
import type { AdditionalToolsContext } from '@solvapay/mcp'
import type { Env } from '../worker'
import { registerManagePet } from './manage_pet'

export function registerTools(ctx: AdditionalToolsContext, env: Env) {
  registerManagePet(ctx, env)
}
```

Two-line edit: add the `import` line, add the `register*(ctx, env)` call inside `registerTools`. Drop the leading underscores on `_ctx` / `_env` once either is used. Repeat for each intent file.

## Worked PetStore example

End-to-end output for a small intent-driven scaffold against `https://petstore.swagger.io/v2/swagger.json`. Three intent files plus the aggregator.

### `src/tools/find_pet.ts`

```ts
import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'
import type { Env } from '../worker'
import type { operations } from '../types/upstream'
import { upstreamFetchJson } from '../lib/upstreamFetch'

const UPSTREAM_BASE = 'https://petstore.swagger.io/v2'

type Pet = operations['getPetById']['responses']['200']['content']['application/json']
type Pets = operations['findPetsByStatus']['responses']['200']['content']['application/json']

export function registerFindPet(ctx: AdditionalToolsContext, env: Env) {
  ctx.server.registerTool(
    'find_pet',
    {
      title: 'Find a pet',
      description: 'Look up a single pet by ID, or filter all pets by status. Read-only.',
      inputSchema: {
        petId: z.number().int().optional().describe('Fetch a specific pet by ID. Mutually exclusive with `status`.'),
        status: z
          .enum(['available', 'pending', 'sold'])
          .optional()
          .describe('Filter all pets by lifecycle status. Mutually exclusive with `petId`.'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ petId, status }) => {
      const headers = { authorization: `Bearer ${env.UPSTREAM_API_KEY}` }
      if (typeof petId === 'number') {
        const data = await upstreamFetchJson<Pet>(
          `${UPSTREAM_BASE}/pet/${petId}`,
          { headers },
        )
        return {
          content: [{ type: 'text', text: `Found pet ${petId}. Render as a card.` }],
          structuredContent: data,
        }
      }
      const url = new URL(`${UPSTREAM_BASE}/pet/findByStatus`)
      url.searchParams.set('status', status ?? 'available')
      const data = await upstreamFetchJson<Pets>(url, { headers })
      return {
        content: [
          {
            type: 'text',
            text: `Found ${data.length} pets with status "${status ?? 'available'}". Render as a table.`,
          },
        ],
        structuredContent: { pets: data },
      }
    },
  )
}
```

### `src/tools/manage_pet.ts`

See [Pattern 2 — Action](#pattern-2--action-1-intent--n-ops-via-discriminator) above; that template is the full source.

### `src/tools/pet_dashboard.ts`

See [Pattern 3 — Fan-out](#pattern-3--fan-out-1-intent--n-ops-in-parallel) above.

### `src/tools/index.ts`

```ts
import type { AdditionalToolsContext } from '@solvapay/mcp'
import type { Env } from '../worker'
import { registerFindPet } from './find_pet'
import { registerManagePet } from './manage_pet'
import { registerPetDashboard } from './pet_dashboard'

export function registerTools(ctx: AdditionalToolsContext, env: Env) {
  registerFindPet(ctx, env)
  registerManagePet(ctx, env)
  registerPetDashboard(ctx, env)
}
```

That's the whole worker's tool surface. Three intents covering ten or so OpenAPI operations.

## Manual smoke-test path

`scripts/test.mjs` reports intent tools as `skipped` with reason `"intent tool — author test inputs manually (see intent-driven.md)"` because their names don't match any `operationId` in the spec. Smoke-test them manually instead:

```bash
# Start the worker locally
npm run serve:local

# Point MCP Inspector at it
npx @modelcontextprotocol/inspector http://localhost:8787/

# Or call directly:
curl -X POST http://localhost:8787/ \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0", "id": 1, "method": "tools/call",
    "params": { "name": "manage_pet", "arguments": { "action": "create", "name": "doggie", "status": "available" } }
  }'
```

Run one call per intent — one per discriminator branch for action patterns. If the response carries `isError: true`, the `content[0].text` includes the `UpstreamError` diagnostics (method, URL, status, body snippet) so you can see exactly which backing op failed.
