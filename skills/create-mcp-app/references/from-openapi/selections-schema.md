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
  // Optional — plan shapes the agent will create on the product after scaffold.
  // `scaffold.mjs` pre-flights these against the SolvaPay default-plan guardrail.
  plans?: Array<{
    name?: string
    type: 'recurring' | 'one-time' | 'usage-based' | 'hybrid'
    price?: number
    currency?: string
    billingCycle?: 'monthly' | 'yearly' | 'weekly' | 'quarterly'
    freeUnits?: number
    creditsPerUnit?: number
    default?: boolean
  }>
  // solvapaySecretKey is intentionally absent — populated by `npx -y solvapay@latest init`.
}

type UpstreamAuth =
  | { kind: 'none' }
  | { kind: 'bearer'; key: string }
  | { kind: 'apiKey'; in: 'header'; name: string; key: string }
  | {
      kind: 'oauth2-client-credentials'
      tokenUrl: string         // from `securitySchemes[*].flows.clientCredentials.tokenUrl`
      clientId: string         // user-supplied
      clientSecret: string     // user-supplied (treat like `bearer.key`)
      scope?: string           // optional, space-delimited; default empty
      audience?: string        // optional; some providers (e.g. Auth0) require this
    }
  | {
      kind: 'apiKey-multi'     // 2+ static credential headers required together (OpenAPI multi-scheme AND)
      headers: Array<{ name: string; value: string }>  // >= 2 entries; `name` from spec, `value` user-supplied secret
    }
```

## Mode

| `mode` | Meaning |
| --- | --- |
| `'intent-driven'` (recommended in skill / agent context) | `scaffold.mjs` only bootstraps the project skeleton + an empty aggregator. The agent then authors `src/tools/<intent>.ts` files directly per [`intent-driven.md`](intent-driven.md). `operations[]` is ignored if present. Best for LLM consumption — fewer, more semantic tools. Requires an agent (Cursor/Claude/etc.) in the loop. |
| `'one-to-one'` (default in `scaffold.mjs`; only mode supported by `npx -y create-solvapay@latest -- --type mcp`) | One generated tool per non-skipped OpenAPI operation. `scaffold.mjs` writes every `src/tools/<operationId>.ts` and the `registerTools` aggregator. Requires `operations[]`. Produces working tools without an agent. |

Intent definitions are not part of `selections.json` — the intent tool source files ARE the contract. There is no `intents[]` field.

## Field-source rules

| Field | Source | Notes |
| --- | --- | --- |
| `workerName` | Agent suggests, user confirms | Kebab-case, no spaces. Used as Wrangler `name`. |
| `solvapayProductRef` | **Optional, but explicit when known** | Include the intended `prd_...` when the user knows it so `npx -y solvapay@latest init` verifies that exact product. If omitted, init lists products and prompts (or auto-picks under `--yes` / non-TTY); always confirm the resulting `.env` value before deploy. If the user has no product yet, ask them to create one in SolvaPay Console (https://app.solvapay.com) before init. |
| `mcpPublicBaseUrl` | Agent default + deploy auto-resolve | Use `http://localhost:8787` initially. `deploy.mjs` auto-resolves the live `*.workers.dev` URL on first deploy when still a placeholder. For custom domains, set explicitly before deploy (see [deploy.md](deploy.md) step 2). |
| `mode` | **Optional**, agent asks user once after `describe.mjs` (recommends `'intent-driven'` when running inside the skill) | `'one-to-one'` (default) for faithful per-op mapping; `'intent-driven'` for agent-authored clusters. See [intent-driven.md](intent-driven.md). The standalone `npx -y create-solvapay@latest -- --type mcp` CLI always writes `'one-to-one'`. |
| `upstreamAuth.kind` | Agent reads from `describe.mjs` security schemes, then confirms with user | One of `none` / `bearer` / `apiKey` / `oauth2-client-credentials` / `apiKey-multi`. |
| `upstreamAuth.key` | **User-supplied** | The literal upstream API key. Treat like a secret — see `scaffold.md`'s "selections.json lifecycle". |
| `upstreamAuth.name` | Agent reads from `describe.mjs` | Header name for `apiKey` (e.g. `X-API-Key`). Only `in: "header"` is supported in v1. |
| `upstreamAuth.headers[]` | `name` from `describe.mjs`; `value` **user-supplied** | For `apiKey-multi`: 2+ `{ name, value }` pairs, one per required header (e.g. `X-VTEX-API-AppKey` + `X-VTEX-API-AppToken`). Each `value` is a secret. Seeded into `.env` as one compact-JSON `UPSTREAM_API_HEADERS` var. |
| `upstreamAuth.tokenUrl` | Agent reads from `describe.mjs.securitySchemes[*].tokenUrl` | OAuth 2.0 token endpoint. Must be HTTPS (or `http://localhost` for local tests). |
| `upstreamAuth.clientId` / `clientSecret` | **User-supplied** | OAuth client credentials. Both treated as secrets. |
| `upstreamAuth.scope` / `audience` | **Optional, user-supplied** | `scope` is a space-delimited list (defaults to empty); `audience` is only required by some providers (Auth0). |
| `operations[].tier` | Agent default (from `describe.mjs.suggestedTier`) + user override | Per-operation override happens during curate. Only used in `one-to-one` mode. |
| `plans[]` | **Optional**, agent proposes when curating pricing | Document-only during scaffold — `scaffold.mjs` validates but does not POST plans. Use for MCP products that need a free recurring default (`price: 0`, `freeUnits > 0`, `default: true`) or a usage-based metering plan, then create/verify the actual plan outside scaffold before handoff. See [Default plan and auto-enrollment](#default-plan-and-auto-enrollment). |
| `solvapaySecretKey` | **Intentionally absent** | `solvapay-init` writes it directly to `.env`. Not part of this file ever. |

## Default plan and auto-enrollment

MCP paywalls call `checkLimits` on every tool invocation. When the product's **default plan** is free and non-usage-based (typically free recurring with `freeUnits > 0`), the first call **auto-enrolls** the customer — a Purchase row is created with `origin: 'free_default'` and the tool proceeds without `activate_plan`.

| Default plan shape | First tool call behaviour |
| --- | --- |
| Free recurring (`price: 0`, `freeUnits > 0`) | Auto-enrolls; no gate |
| Usage-based (any) | No auto-enroll Purchase; pull-only freeUnits or `activationRequired` when prepaid credits required |
| Paid recurring | `activationRequired: true` — customer must activate or upgrade (legacy products only; SDK rejects new paid recurring defaults) |

**Server guardrail** (enforced at plan-create time and pre-flighted by `scaffold.mjs`): only **free recurring** or **usage-based** plans may be marked `default: true`. Paid recurring, one-time, and hybrid defaults return `400`.

When authoring `plans[]`, prefer:

```jsonc
{
  "name": "Free",
  "type": "recurring",
  "price": 0,
  "currency": "USD",
  "billingCycle": "monthly",
  "freeUnits": 50,
  "default": true
}
```

Add paid tiers as separate plans with `default: false` (or omit `default`).

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

### OAuth 2.0 client_credentials

```jsonc
{
  "workerName": "roaring-mcp",
  "mcpPublicBaseUrl": "http://localhost:8787",
  "upstreamAuth": {
    "kind": "oauth2-client-credentials",
    "tokenUrl": "https://api.roaring.io/token",
    "clientId": "rrg_client_…",
    "clientSecret": "rrg_secret_…",
    "scope": "company:read"
    // "audience": "https://api.roaring.io"   // only when the provider requires it
  },
  "mode": "intent-driven"
}
```

Scaffold writes the five `UPSTREAM_OAUTH_*` keys to `.env`; `scripts/deploy.mjs` uploads them as Worker Secrets on first deploy. `src/lib/upstreamOAuth.ts` (shipped in `_base`) exchanges the credentials for a short-lived bearer token, caches it in the Workers isolate until ~30s before expiry, and stamps each upstream call with `Authorization: Bearer <token>`.

### apiKey-multi (two or more static credential headers)

For APIs that require multiple credential headers on every request (the OpenAPI "multiple required schemes (AND)" case — no token exchange):

```jsonc
{
  "workerName": "leyr-booking-agent",
  "mcpPublicBaseUrl": "http://localhost:8787",
  "upstreamAuth": {
    "kind": "apiKey-multi",
    "headers": [
      { "name": "x-leyr-client-id",     "value": "client_id_value" },
      { "name": "x-leyr-client-secret", "value": "client_secret_value" }
    ]
  },
  "mode": "intent-driven"
}
```

Generic over N headers and header names — works for `AppKey` + `AppToken`, a three-header combination, etc. Scaffold writes a **single** `.env` var, `UPSTREAM_API_HEADERS`, holding compact JSON keyed by header name → value (`{"x-leyr-client-id":"…","x-leyr-client-secret":"…"}`); `scripts/deploy.mjs` uploads it as a Worker Secret. One-to-one tools spread it into each request's headers; in intent-driven mode the agent spreads it by hand (see [intent-driven-patterns.md](intent-driven-patterns.md#upstream-auth-headers-by-upstreamauthkind)).

## Validation

`scaffold.mjs` validates this schema and refuses to proceed on shape mismatch:

- `kind` must be one of `none`, `bearer`, `apiKey`, `oauth2-client-credentials`, `apiKey-multi`.
- `kind: "bearer"` requires `key`.
- `kind: "apiKey"` requires `in: "header"`, `name`, and `key`. Query / cookie shapes are routed to the "unsupported, generate without auth" advisory path.
- `kind: "apiKey-multi"` requires `headers`: an array of **at least two** `{ name, value }` entries, each with a non-empty `name` and `value`, and no duplicate `name`s (case-insensitive). A single header should use `kind: "apiKey"` instead.
- `kind: "oauth2-client-credentials"` requires `tokenUrl`, `clientId`, and `clientSecret`. `tokenUrl` must parse as a URL and must be `https:` (only `http://localhost` / `http://127.0.0.1` are permitted for local tests). `scope` and `audience` are optional strings. Other OAuth2 flows (`authorizationCode`, `implicit`, `password`) are still unsupported and routed through the advisories path.
- `mode` (when provided) must be `'one-to-one'` or `'intent-driven'`.
- When `mode === 'one-to-one'` (or absent), `operations[]` is required. Each `operations[].tier` must be `free`, `paid`, or `skip`, and every `operationId` referenced must exist in the OpenAPI document.
- When `mode === 'intent-driven'`, `operations[]` is ignored if present (no per-op codegen runs).
- When `plans[]` is provided, each entry needs `type`. At most one plan may set `default: true`. Default plans must pass the free-recurring or usage-based guardrail above; violations fail scaffold with an actionable error instead of a bare API `400`.
- Free recurring defaults with `freeUnits` missing or `0` produce a scaffold reminder (non-fatal) — set `freeUnits > 0` so auto-enrollment grants a usable quota.

## File lifecycle

`selections.json` contains the literal upstream API key. The agent always writes it to a non-project path (recommended: `/tmp/selections-<uuid>.json` on POSIX, `%TEMP%\selections-<uuid>.json` on Windows) and deletes it after scaffold succeeds.

`scaffold.mjs` refuses to run when the `--selections` path resolves inside `<target-dir>` so a follow-up `git add .` can't leak the upstream key.

## What's intentionally NOT in this schema

- `solvapaySecretKey` — `npx -y solvapay@latest init` writes it directly to `.env`. Never include it here.
- `apiBaseUrl` for the upstream — derived from the OpenAPI document's `servers[0].url` at scaffold time. If `servers` is empty or relative, confirm the real upstream base URL before scaffold rather than trying to encode it here.
- `selectionsForRotation` — there is no rotation flow that goes through scaffold. Rotation is handled by editing `.env`, refreshing changed Worker secrets with `npx wrangler secret put <NAME>`, and redeploying per [deploy.md](deploy.md).
