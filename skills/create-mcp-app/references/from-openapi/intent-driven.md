# intent-driven — author intent tools yourself

> **Recommended when an LLM agent (Cursor/Claude/etc.) is in the loop.** The agent reads `describe.mjs` output, clusters operations into higher-level intents (`manage_pet`, `find_pet`, etc.), and authors `src/tools/<intent>.ts` directly. Terminal-only invocations via `npx -y create-solvapay@latest -- --type mcp` cannot use this mode — they default to `one-to-one` (see [scaffold.md](scaffold.md)).

Optional alternative to one-to-one mode. `scaffold.mjs` only bootstraps the project skeleton; you author `src/tools/<intent>.ts` files directly using the patterns documented in [intent-driven-patterns.md](intent-driven-patterns.md).

## When to read this

- After [describe.md](describe.md) you asked the user the mode question and they picked **intent-driven**.
- You've already written `selections.json` with `"mode": "intent-driven"` and run `scaffold.mjs`.
- You now own `src/tools/` and `src/tools/index.ts`.

## STOP — read [../tool-design.md](../tool-design.md) before authoring any intent file

This is **not** optional and **not** a "polish later" step. Intent tools use the same `registerPayable(name, config)` two-argument shape and the same `c.respond(data, { text })` response-mode contract as one-to-one tools — both rules live only in [../tool-design.md](../tool-design.md), not here. The templates in [intent-driven-patterns.md](intent-driven-patterns.md) assume you have already internalised them; if you author from those templates without `tool-design.md`, you will silently invent a wrong shape (most common failures: missing `title`, dropping the `text` narration, returning raw `content` arrays from paid handlers).

Required read order for intent-driven:
1. [guide.md](guide.md) — routing and the mode question
2. [describe.md](describe.md) — `describe.mjs` output, gates G1/G4/G5
3. **[../tool-design.md](../tool-design.md) — the `registerPayable` shape, the `c.respond` contract, narration rules**
4. This file ([intent-driven.md](intent-driven.md)) — clustering heuristics + the gate contract
5. [intent-driven-patterns.md](intent-driven-patterns.md) — the three template patterns (rename / action / fan-out), schema-design crib sheet, worked PetStore example
6. [scaffold.md](scaffold.md) — G6 preview rules and `scaffold.mjs` invocation

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

Then use the generated types in every `upstreamFetchJson` call:

```ts
import type { operations } from '../types/upstream'

type Pet = operations['getPetById']['responses']['200']['content']['application/json']
const data = await upstreamFetchJson<Pet>(url, { ... })
```

This gives `tsc --noEmit` enough signal to catch upstream field renames and gives you autocomplete on `data.…` while authoring. Re-run the command when the upstream spec evolves.

Check the actual success response code and schema before typing each handler. Create operations often return `201`, not `200`; delete operations may return `204` with an empty body. If the spec doesn't define a 200 response schema for an operation, fall back to `unknown` (not `Record<string, unknown>`). For success-status fallback order (`200` → `201` → `204` → `unknown`), see [tool-template.md#success-status-fallback](tool-template.md#success-status-fallback).

If `describe.mjs` reports empty or relative `servers`, confirm the real upstream API base URL before authoring handlers. Centralize it in one helper or constant, then build endpoint paths from that helper so a wrong base URL is fixed once.

## Clustering heuristics

If you haven't yet, run the [typed-upstream](#typed-upstream-recommended) command first — every example in [intent-driven-patterns.md](intent-driven-patterns.md) assumes `src/types/upstream.ts` exists.

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

On `G7:edit`, accept changes ("don't author `pet_dashboard.ts` yet — defer to follow-up"). Re-render the list once before authoring. After `G7:author` (or skipping at `standard`/`auto`), author the files per the three patterns documented in [intent-driven-patterns.md](intent-driven-patterns.md) and update the aggregator per the same file.

## Tier rules

**Paid wins.** If any backing op is mutating (POST/PUT/PATCH/DELETE), the intent is paid — use `ctx.registerPayable`. Even if the user only ever takes the "read" branch of an action discriminator, the intent's surface includes the mutating branches and should gate them all.

`registerPayable`'s gate runs once *before* the handler. So an action-pattern intent with `case 'create' | 'update' | 'delete'` only deducts one credit per call regardless of which branch runs.

Pure-read intents (rename or fan-out across only `GET` ops) can use `ctx.server.registerTool` — same shape as one-to-one mode's free tools.

## Relationship to `tool-design.md`

"Intent" in this guide means *user-goal-shaped tool that clusters OpenAPI ops* — a design choice you make per intent file.

"Intent" in [../tool-design.md](../tool-design.md) means *SolvaPay's built-in recovery tools* (`upgrade`, `topup`, `manage_account`, `activate_plan`). Don't wrap those with `registerPayable`.

After authoring your intent tools, read `tool-design.md` for narration polish, annotation guidance, and the silent / nudge / gate response-mode model — all of which apply to intent tools the same as 1:1 tools.

## Hand-off

Once `src/tools/*.ts` is filled in and `src/tools/index.ts` imports each one, move to [../solvapay-init.md](../solvapay-init.md) (if not already done) → [deploy.md](deploy.md) → manual smoke test (see [intent-driven-patterns.md#manual-smoke-test-path](intent-driven-patterns.md#manual-smoke-test-path)) → [../tool-design.md](../tool-design.md) for hand-tuning.
