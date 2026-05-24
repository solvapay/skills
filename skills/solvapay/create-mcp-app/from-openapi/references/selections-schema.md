# `selections.json` schema

The contract between the agent (which writes `selections.json`) and `scaffold.mjs` (which reads it). Captured here so both sides agree.

## Discriminated union on `upstreamAuth.kind`

```ts
type Selections = {
  workerName: string                  // kebab-case, used as Wrangler `name` and the resource URI slug
  solvapayProductRef?: string         // optional `prd_…` — omit unless you have a specific ref in mind; `solvapay init` will prompt
  mcpPublicBaseUrl: string            // start with `http://localhost:8787`; auto-resolved on deploy
  upstreamAuth: UpstreamAuth
  mode?: 'intent-driven' | 'one-to-one'  // defaults to 'one-to-one' (terminal-safe); recommended in skill context: 'intent-driven'
  // Required when mode === 'one-to-one' (or absent); ignored when mode === 'intent-driven'.
  operations?: Array<{
    operationId: string
    tier: 'free' | 'paid' | 'skip'
  }>
  // solvapaySecretKey is intentionally absent — populated by `npx solvapay init`.
}

type UpstreamAuth =
  | { kind: 'none' }
  | { kind: 'bearer'; key: string }
  | { kind: 'apiKey'; in: 'header'; name: string; key: string }
```

## Mode

| `mode` | Meaning |
| --- | --- |
| `'intent-driven'` (recommended in skill / agent context) | `scaffold.mjs` only bootstraps the project skeleton + an empty aggregator. The agent then authors `src/tools/<intent>.ts` files directly per [`../intent-driven.md`](../intent-driven.md). `operations[]` is ignored if present. Best for LLM consumption — fewer, more semantic tools. Requires an agent (Cursor/Claude/etc.) in the loop. |
| `'one-to-one'` (default in `scaffold.mjs`; only mode supported by `npx create-solvapay -- --type mcp`) | One generated tool per non-skipped OpenAPI operation. `scaffold.mjs` writes every `src/tools/<operationId>.ts` and the `registerTools` aggregator. Requires `operations[]`. Produces working tools without an agent. |

Intent definitions are not part of `selections.json` — the intent tool source files ARE the contract. There is no `intents[]` field.

## Field-source rules

| Field | Source | Notes |
| --- | --- | --- |
| `workerName` | Agent suggests, user confirms | Kebab-case, no spaces. Used as Wrangler `name`. |
| `solvapayProductRef` | **Optional** | Omit during curate — `npx solvapay init` lists account products and prompts (or auto-picks). Include only when you want a specific ref written at scaffold time. If the user has no product yet, ask them to create one in SolvaPay Console (https://app.solvapay.com) before init. |
| `mcpPublicBaseUrl` | Agent default + deploy auto-resolve | Use `http://localhost:8787` initially. `deploy.mjs` auto-resolves the live `*.workers.dev` URL on first deploy when still a placeholder. For custom domains, set explicitly before deploy (see [../deploy.md](../deploy.md) step 2). |
| `mode` | **Optional**, agent asks user once after `describe.mjs` (recommends `'intent-driven'` when running inside the skill) | `'one-to-one'` (default) for faithful per-op mapping; `'intent-driven'` for agent-authored clusters. See [../intent-driven.md](../intent-driven.md). The standalone `npx create-solvapay -- --type mcp` CLI always writes `'one-to-one'`. |
| `upstreamAuth.kind` | Agent reads from `describe.mjs` security schemes, then confirms with user | One of `none` / `bearer` / `apiKey`. |
| `upstreamAuth.key` | **User-supplied** | The literal upstream API key. Treat like a secret — see `scaffold.md`'s "selections.json lifecycle". |
| `upstreamAuth.name` | Agent reads from `describe.mjs` | Header name for `apiKey` (e.g. `X-API-Key`). Only `in: "header"` is supported in v1. |
| `operations[].tier` | Agent default (from `describe.mjs.suggestedTier`) + user override | Per-operation override happens during curate. Only used in `one-to-one` mode. |
| `solvapaySecretKey` | **Intentionally absent** | `solvapay-init` writes it directly to `.env`. Not part of this file ever. |

## Examples

### Intent-driven (recommended in skill context)

```jsonc
{
  "workerName": "petstore-mcp",
  "solvapayProductRef": "prd_abc123",
  "mcpPublicBaseUrl": "http://localhost:8787",
  "upstreamAuth": { "kind": "bearer", "key": "upstream_api_key_value" },
  "mode": "intent-driven"
  // No `operations[]` — the agent authors src/tools/*.ts files per ../intent-driven.md.
}
```

### One-to-one (default in `scaffold.mjs`)

```jsonc
{
  "workerName": "petstore-mcp",
  "solvapayProductRef": "prd_abc123",
  "mcpPublicBaseUrl": "http://localhost:8787",
  "upstreamAuth": { "kind": "bearer", "key": "upstream_api_key_value" },
  "operations": [
    { "operationId": "getPetById",  "tier": "paid" },
    { "operationId": "addPet",      "tier": "paid" },
    { "operationId": "listPets",    "tier": "free" },
    { "operationId": "deletePet",   "tier": "skip" }
  ]
}
```

## Validation

`scaffold.mjs` validates this schema and refuses to proceed on shape mismatch:

- `kind` must be one of `none`, `bearer`, `apiKey`.
- `kind: "bearer"` requires `key`.
- `kind: "apiKey"` requires `in: "header"`, `name`, and `key`. Query / cookie shapes are routed to the "unsupported, generate without auth" advisory path.
- `mode` (when provided) must be `'one-to-one'` or `'intent-driven'`.
- When `mode === 'one-to-one'` (or absent), `operations[]` is required. Each `operations[].tier` must be `free`, `paid`, or `skip`, and every `operationId` referenced must exist in the OpenAPI document.
- When `mode === 'intent-driven'`, `operations[]` is ignored if present (no per-op codegen runs).

## File lifecycle

`selections.json` contains the literal upstream API key. The agent always writes it to a non-project path (recommended: `/tmp/selections-<uuid>.json` on POSIX, `%TEMP%\selections-<uuid>.json` on Windows) and deletes it after scaffold succeeds.

`scaffold.mjs` refuses to run when the `--selections` path resolves inside `<target-dir>` so a follow-up `git add .` can't leak the upstream key.

## What's intentionally NOT in this schema

- `solvapaySecretKey` — `npx solvapay init` writes it directly to `.env`. Never include it here.
- `apiBaseUrl` for the upstream — derived from the OpenAPI document's `servers[0].url` at scaffold time.
- `selectionsForRotation` — there is no rotation flow that goes through scaffold. Rotation is handled by re-running [../../solvapay-init.md](../../solvapay-init.md) + [../deploy.md](../deploy.md).
