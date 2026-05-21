# `selections.json` schema

The contract between the agent (which writes `selections.json`) and `scaffold.mjs` (which reads it). Captured here so both sides agree.

## Discriminated union on `upstreamAuth.kind`

```ts
type Selections = {
  workerName: string                  // kebab-case, used as Wrangler `name` and the resource URI slug
  solvapayProductRef?: string         // optional `prd_…` — omit unless you have a specific ref in mind; `solvapay init` will prompt
  mcpPublicBaseUrl: string            // start with `http://localhost:8787`; auto-resolved on deploy
  upstreamAuth: UpstreamAuth
  operations: Array<{
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

## Field-source rules

| Field | Source | Notes |
| --- | --- | --- |
| `workerName` | Agent suggests, user confirms | Kebab-case, no spaces. Used as Wrangler `name`. |
| `solvapayProductRef` | **Optional** | Omit during curate — `npx solvapay init` lists account products and prompts (or auto-picks). Include only when you want a specific ref written at scaffold time. If the user has no product yet, route to [solvapay/provider-onboarding/guide.md](../../provider-onboarding/guide.md) or [solvapay/mcp-pay/guide.md](../../mcp-pay/guide.md) before init. |
| `mcpPublicBaseUrl` | Agent default + deploy auto-resolve | Use `http://localhost:8787` initially. `deploy.mjs` auto-resolves the live `*.workers.dev` URL on first deploy when still a placeholder. For custom domains, set explicitly before deploy (see [../deploy.md](../deploy.md) step 2). |
| `upstreamAuth.kind` | Agent reads from `describe.mjs` security schemes, then confirms with user | One of `none` / `bearer` / `apiKey`. |
| `upstreamAuth.key` | **User-supplied** | The literal upstream API key. Treat like a secret — see `scaffold.md`'s "selections.json lifecycle". |
| `upstreamAuth.name` | Agent reads from `describe.mjs` | Header name for `apiKey` (e.g. `X-API-Key`). Only `in: "header"` is supported in v1. |
| `operations[].tier` | Agent default (from `describe.mjs.suggestedTier`) + user override | Per-operation override happens during curate. |
| `solvapaySecretKey` | **Intentionally absent** | `solvapay-init` writes it directly to `.env`. Not part of this file ever. |

## Example

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
- Each `operations[].tier` must be `free`, `paid`, or `skip`.
- Every `operationId` referenced must exist in the OpenAPI document.

## File lifecycle

`selections.json` contains the literal upstream API key. The agent always writes it to a non-project path (recommended: `/tmp/selections-<uuid>.json` on POSIX, `%TEMP%\selections-<uuid>.json` on Windows) and deletes it after scaffold succeeds.

`scaffold.mjs` refuses to run when the `--selections` path resolves inside `<target-dir>` so a follow-up `git add .` can't leak the upstream key.

## What's intentionally NOT in this schema

- `solvapaySecretKey` — `npx solvapay init` writes it directly to `.env`. Never include it here.
- `apiBaseUrl` for the upstream — derived from the OpenAPI document's `servers[0].url` at scaffold time.
- `selectionsForRotation` — there is no rotation flow that goes through scaffold. Rotation is handled by re-running [../solvapay-init.md](../solvapay-init.md) + [../deploy.md](../deploy.md).
