# intent-driven — author intent tools yourself

> **Recommended when an LLM agent (Cursor/Claude/etc.) is in the loop.** The agent reads `describe.mjs` output, clusters operations into higher-level intents (`manage_pet`, `find_pet`, etc.), and authors `src/tools/<intent>.ts` directly. Terminal-only invocations via `npx -y create-solvapay@latest -- --type mcp` cannot use this mode — they default to `one-to-one` (see [scaffold.md](scaffold.md)).

Optional alternative to one-to-one mode. `scaffold.mjs` only bootstraps the project skeleton; you author `src/tools/<intent>.ts` files directly using the templates below.

## When to read this

- After [describe.md](describe.md) you asked the user the mode question and they picked **intent-driven**.
- You've already written `selections.json` with `"mode": "intent-driven"` and run `scaffold.mjs`.
- You now own `src/tools/` and `src/tools/index.ts`.

## STOP — read [../tool-design.md](../tool-design.md) before authoring any intent file

This is **not** optional and **not** a "polish later" step. Intent tools use the same `registerPayable(name, config)` two-argument shape and the same `c.respond(data, { text })` response-mode contract as one-to-one tools — both rules live only in [../tool-design.md](../tool-design.md), not here. The templates below assume you have already internalised them; if you author from these templates without `tool-design.md`, you will silently invent a wrong shape (most common failures: missing `title`, dropping the `text` narration, returning raw `content` arrays from paid handlers).

Required read order for intent-driven:
1. [guide.md](guide.md) — routing and the mode question
2. [describe.md](describe.md) — `describe.mjs` output, gates G1/G4/G5
3. **[../tool-design.md](../tool-design.md) — the `registerPayable` shape, the `c.respond` contract, narration rules**
4. This file ([intent-driven.md](intent-driven.md)) — clustering + the three patterns
5. [scaffold.md](scaffold.md) — G6 preview rules and `scaffold.mjs` invocation

If you cannot recite the two-argument `registerPayable(name, { title, description, schema, handler, annotations? })` shape and the `c.respond(data, { text })` rule from memory, go back to step 3 before continuing.

## When to pick intent-driven vs one-to-one

| Use intent-driven when | Use one-to-one when |
| --- | --- |
| Spec has 10+ ops with obvious resource groupings (CRUD on `pets`, `orders`, etc.) | Spec is small (< 8 ops) or read-only |
| LLM consumers are the primary audience (tool catalogue should be small + goal-shaped) | Programmatic / SDK-style consumers who already know the operationIds |
| Multiple ops share most parameters and only differ by verb | Each op has a meaningfully distinct schema |
| An LLM agent is in the loop to design and author the intent schemas | You want a faithful 1:1 export with no design work, or no agent is available |

Don't pick intent-driven for tiny read-only APIs — the design overhead doesn't pay back.

## Typed upstream (recommended)

Before authoring intent files, generate TypeScript types for the upstream API once:

```bash
npx openapi-typescript path/to/spec.json -o src/types/upstream.ts
```

If the spec is Swagger 2.0 (`"swagger": "2.0"` at the root — `openapi-typescript` rejects it with `Unsupported Swagger version: 2.x`), convert it to OpenAPI 3 first, then run the command above against the converted file:

```bash
npx -y swagger2openapi path/to/spec.json -o path/to/spec.openapi.json
npx openapi-typescript path/to/spec.openapi.json -o src/types/upstream.ts
```

Then use them in every `upstreamFetchJson` call:

```ts
import type { operations } from '../types/upstream'

type Pet = operations['getPetById']['responses']['200']['content']['application/json']
const data = await upstreamFetchJson<Pet>(url, { ... })
```

This gives `tsc --noEmit` enough signal to catch upstream field renames and gives you autocomplete on `data.…` while authoring. Re-run the command when the upstream spec evolves.

If the spec doesn't define a 200 response schema for an operation, fall back to `unknown` (not `Record<string, unknown>`). For success-status fallback order (`200` → `201` → `204` → `unknown`), see [references/tool-template.md](references/tool-template.md#success-status-fallback).

## Clustering heuristics

If you haven't yet, run the [typed-upstream](#typed-upstream-recommended) command first — every example below assumes `src/types/upstream.ts` exists.

Three rules, applied in order during curate (before writing `selections.json`):

1. **Group by resource noun.** OpenAPI `tags` are usually right: a `Pet`-tagged group becomes a single `manage_pet` intent. If no tags, group by the second URL segment (`/pet/{id}/uploadImage` → `pet`).
2. **One action intent per resource, plus optional search/list intent.** `manage_pet` (covers POST/PUT/DELETE on the resource) + `find_pet` (covers GET / search). Splitting reads from writes keeps the gate-vs-free decision simple.
3. **Fan-out only when the user goal genuinely spans endpoints.** A `pet_dashboard` intent that hits 3 endpoints in parallel is right for "give me everything about this pet"; don't reach for fan-out just to bundle unrelated calls.

When in doubt, ship fewer intents. You can always add a second intent later by dropping another file into `src/tools/`.

## Gate G2 — propose the cluster set (always at standard + chatty, intent-driven only)

Before writing `selections.json`, surface your proposed clusters as a single approval gate. This is **G2** in the gate reference. Skipped at `auto` — the agent writes `selections.json` directly with the proposed clusters and continues to scaffold.

Apply the [clustering heuristics](#clustering-heuristics) above to draft the cluster set first, then ask:

```
GateId: G2
Prompt: I'd cluster the N operations into M intent tools. Approve, edit, or switch to one-to-one mode?
Options:
  - approve:  Approve — write selections.json and run scaffold
  - edit:     Edit — describe merges, splits, or renames
  - oneToOne: Switch to one-to-one mode (one file per operation)
```

Render the cluster proposal as a supporting table above the options. One row per proposed intent:

```
| intent_name  | ops covered                                  | tier | one-line description |
| ------------ | -------------------------------------------- | ---- | -------------------- |
| manage_pet   | POST /pet, PUT /pet, DELETE /pet/{id}        | paid | CRUD on pets         |
| find_pet     | GET /pet/{id}, GET /pet/findByStatus         | free | read-only lookups    |
| manage_order | POST /store/order, GET /store/order/{id}     | paid | order management     |
```

Markdown fallback:

```
### G2 — approve the proposed intent cluster?

| intent_name  | ops covered                                  | tier | one-line description |
| ------------ | -------------------------------------------- | ---- | -------------------- |
| manage_pet   | POST /pet, PUT /pet, DELETE /pet/{id}        | paid | CRUD on pets         |
| find_pet     | GET /pet/{id}, GET /pet/findByStatus         | free | read-only lookups    |
| manage_order | POST /store/order, GET /store/order/{id}     | paid | order management     |

- a: Approve — write selections.json and run scaffold
- b: Edit — describe merges, splits, or renames
- c: Switch to one-to-one mode

Reply with a / b / c, or describe changes.
```

On `G2:edit`, accept free-form changes ("merge `find_pet` and `find_order` into one `search`", "rename `manage_pet` to `pet_admin`") and re-render the table once before continuing. On `G2:oneToOne`, set `"mode": "one-to-one"` in `selections.json`, route back to [describe.md](describe.md) for **G4** (tier overrides), and proceed from there.

The `tier` column on each intent follows the "paid wins" rule (see [Tier rules](#tier-rules)) — any intent that covers a mutating backing op is `paid`; pure-read intents are `free`.

## Gate G3 — per-intent design review (chatty only, intent-driven only)

Only fires at `chatty`. Skipped at `standard` and `auto` — those trust your design.

For each non-trivial intent (>3 ops merged, fan-out across multiple resources, or any intent with `destructiveHint: true`), surface a per-intent design preview before authoring the file. Trivial intents (rename pattern, 1:1 mapping) do not need G3 even at `chatty`.

```
GateId: G3
Prompt: Here's the design for `<intent_name>`. Approve, or edit?
Options:
  - approve: Approve — author src/tools/<intent_name>.ts as designed
  - edit:    Edit — describe schema changes or merge-strategy changes
```

Render the design as a supporting block above the options:

```
intent_name: manage_pet
pattern:     Action (1 intent ← N ops via discriminator)
backing ops: POST /pet, PUT /pet, DELETE /pet/{petId}
inputSchema:
  - action: 'create' | 'update' | 'delete' (required, discriminator)
  - petId:  number (required for update/delete)
  - name:   string (required for create, optional for update)
  - status: 'available' | 'pending' | 'sold' (optional)
annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true }
narration:   `Created/updated/deleted pet ${petId}. Render as a card.`
tier:        paid (registerPayable) — any mutating branch gates the whole intent
```

On `G3:edit`, accept changes ("drop the `status` field on delete", "add a `tag` filter to `find_pet`"). Re-render the design block once before authoring. Loop through G3 for each non-trivial intent — one prompt per intent, not one prompt for the whole batch (the user needs to see each schema in isolation).

## Gate G7 — post-scaffold file summary (chatty only, intent-driven only)

Only fires at `chatty`. Skipped at `standard` and `auto` — those let you author the files directly.

After `scaffold.mjs` bootstraps the project skeleton (`src/tools/index.ts` empty in intent-driven mode), and before you start writing `src/tools/<intent>.ts` files, surface one summary gate listing every file you're about to author or edit.

```
GateId: G7
Prompt: I'm about to author M files under src/tools/ and edit the aggregator. Author, or edit the list?
Options:
  - author: Author — write all files as listed
  - edit:   Edit — describe additions, removals, or renames
```

Render the file list as a supporting table above the options:

```
| file                              | purpose                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| src/tools/manage_pet.ts (new)     | Action pattern — CRUD on pets via `action` discriminator   |
| src/tools/find_pet.ts (new)       | Rename pattern — read-only lookup by ID or status filter   |
| src/tools/pet_dashboard.ts (new)  | Fan-out pattern — pet + inventory in parallel              |
| src/tools/index.ts (edit)         | Add 3 imports + 3 register*() calls to registerTools       |
```

On `G7:edit`, accept changes ("don't author `pet_dashboard.ts` yet — defer to follow-up"). Re-render the list once before authoring. After `G7:author` (or skipping at `standard`/`auto`), author the files per [The three patterns](#the-three-patterns) below and update the aggregator per [Aggregator update](#aggregator-update).

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

## Tier rules

**Paid wins.** If any backing op is mutating (POST/PUT/PATCH/DELETE), the intent is paid — use `ctx.registerPayable`. Even if the user only ever takes the "read" branch of an action discriminator, the intent's surface includes the mutating branches and should gate them all.

`registerPayable`'s gate runs once *before* the handler. So an action-pattern intent with `case 'create' | 'update' | 'delete'` only deducts one credit per call regardless of which branch runs.

Pure-read intents (rename or fan-out across only `GET` ops) can use `ctx.server.registerTool` — same shape as one-to-one mode's free tools.

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

## Relationship to `tool-design.md`

"Intent" in this guide means *user-goal-shaped tool that clusters OpenAPI ops* — a design choice you make per intent file.

"Intent" in [../tool-design.md](../tool-design.md) means *SolvaPay's built-in recovery tools* (`upgrade`, `topup`, `manage_account`, `activate_plan`). Don't wrap those with `registerPayable`.

After authoring your intent tools, read `tool-design.md` for narration polish, annotation guidance, and the silent / nudge / gate response-mode model — all of which apply to intent tools the same as 1:1 tools.

## Hand-off

Once `src/tools/*.ts` is filled in and `src/tools/index.ts` imports each one, move to [../solvapay-init.md](../solvapay-init.md) (if not already done) → [deploy.md](deploy.md) → manual smoke test above → [../tool-design.md](../tool-design.md) for hand-tuning.
