# describe — inspect the OpenAPI spec

Read-only first step. Run this whenever you (or the user) want to know what the generated worker would look like without writing any files.

## When to read this

- The user has an OpenAPI / Swagger document and wants to see which operations are eligible.
- The user is iterating on which tools to expose, or on tier overrides.
- You're about to write `selections.json` and need the operation list + suggested tiers + resolved security schemes.

## Run

One-time setup (per skill checkout): install the single runtime dep `@apidevtools/swagger-parser`.

```bash
( cd scripts && npm install )
```

Then:

```bash
node scripts/describe.mjs path/to/openapi.json
# or skip the live HTTP probe (see below) for private / unreachable upstreams:
node scripts/describe.mjs path/to/openapi.json --no-probe
```

Accepts `.json`, `.yaml`, or `.yml`. Use the absolute path or one relative to the working directory. Swagger 2.0 documents are accepted — the canonical server URL is derived from `host` + `basePath` + `schemes`.

## What it prints

JSON on stdout. Top-level keys:

| Key | Shape | Use |
| --- | --- | --- |
| `openapiVersion`, `title`, `description`, `servers` | Strings / array | Confirm you're looking at the right document. |
| `securitySchemes` | Array of `{ name, type, supported, kind, headerName?, reason? }` | Decide `upstreamAuth` shape. |
| `operations` | Array of operation summaries (see below) | Curate per-operation tiers. |
| `serverProbe` | `{ status, serverUrl, head, sampleGet }` — see [Server probe](#server-probe) | Confirm `servers[0]` actually hosts the spec's paths before scaffolding. |
| `advisories` | Array of remediation hints | Resolve unsupported auth schemes and probe mismatches before scaffold. |

Each `operations[i]`:

```jsonc
{
  "operationId": "getPetById",
  "method": "GET",
  "path": "/pet/{petId}",
  "summary": "Find pet by ID",
  "deprecated": false,
  "tags": ["pet"],
  "suggestedTier": "free",
  "parameters": [{ "name": "petId", "in": "path", "type": "integer", "required": true }],
  "requestBody": null,
  "examples": { "petId": 42 },
  "examplesQuality": "real"
}
```

## Tier heuristic

| Method | Suggested tier |
| --- | --- |
| `GET`, `HEAD` | `free` |
| `POST`, `PUT`, `PATCH`, `DELETE` | `paid` |
| `deprecated: true` or `x-internal: true` | `skip` |

These are suggestions only. The user (via you) picks the final tier per operation in `selections.json`.

## Sample-input synthesis

For each parameter and the JSON request body, `describe.mjs` picks the first defined source:

1. `parameter.example`
2. First value in `parameter.examples`
3. `parameter.schema.default`
4. `parameter.schema.example`
5. First `enum` value
6. Type-driven placeholder: `0` (integer/number), `"string"` (string), `true` (boolean), `[]` (array), `{}` (object). Format-aware: `uuid` -> a zero UUID, `date` -> `2026-01-01`, `date-time` -> `2026-01-01T00:00:00.000Z`, `email` -> `user@example.com`.

If any value falls back to step 6, the operation is flagged `"examplesQuality": "placeholder"`. `test.mjs` reports those tools as `skipped` rather than `failed` when the upstream rejects placeholder data — a placeholder example is for shape testing, not for hitting a real upstream.

## Reading `securitySchemes`

| `kind` | `supported` | Meaning |
| --- | --- | --- |
| `http-bearer` | `true` | `Authorization: Bearer <UPSTREAM_API_KEY>` |
| `apiKey-header` | `true` | `<headerName>: <UPSTREAM_API_KEY>` |
| `apiKey-unsupported` | `false` | `apiKey` in query or cookie — not supported in v1 |
| `oauth2`, `openIdConnect` | `false` | Not supported in v1 |

If `supported: false` appears on a scheme used by at least one selected operation, the `advisories` array carries one entry per affected operation with two remediations:

- Mark each affected operation `tier: "skip"` in `selections.json`.
- Set top-level `upstreamAuth.kind = "none"` and accept anonymous calls upstream (only viable when the API allows it).

Pick one with the user and reflect the choice in `selections.json`. `scaffold.mjs` refuses to generate a tool that requires an unsupported scheme unless one of these has been applied.

## Server probe

`describe.mjs` makes two live HTTP calls before printing its summary:

1. **`HEAD <serverUrl>`** — confirms the host resolves and responds. 5s timeout. Most APIs return `404`/`405` for a bare HEAD on the base URL; we only care that the request didn't time out or fail DNS.
2. **`GET <serverUrl><firstReadablePath>`** with `Accept: application/json` — picks the first `GET` operation whose params resolve from real `example`/`default` values (or, failing that, the first `GET` with no path params). Records status, content-type, JSON-parseability, and a 200-char body snippet.

The `serverProbe.status` field summarises the result:

| Status | Meaning | What to do |
| --- | --- | --- |
| `ok` | Sample GET returned 2xx + parseable JSON | Proceed to scaffold. |
| `mismatch` | Sample GET returned non-2xx or non-JSON | The spec's `servers[0]` URL may not host these operations — see the `serverProbeMismatch` advisory. Most often: the OpenAPI document is a generic example (e.g. `learn.openapis.org` petstore) whose `servers` URL doesn't actually serve those paths. Common fix: swap to a spec that targets a running server (e.g. `https://petstore.swagger.io/v2/swagger.json` for the petstore demo). |
| `partial` | HEAD worked but no GET was suitable to probe | Inspect manually before scaffolding (the spec has no read-only operations or all GETs have path params with no real examples). |
| `error` | DNS / TLS / timeout / connection refused | Either the upstream is not publicly reachable from this machine, or the URL is wrong. Re-run with `--no-probe` if the upstream is intentionally private. |
| `skipped` | `--no-probe` flag was passed, or the spec declares no servers | Verify the upstream yourself before scaffolding. |

The probe doesn't fail scaffolding — `scaffold.mjs` is happy to generate tools whose upstream URL is wrong. The point of the probe is to catch the trap *before* the agent writes `selections.json` and the user spends time deploying a worker whose first tool call returns `Unexpected token '<', "<?xml vers"...`.

Pass `--no-probe` to skip the live calls entirely — useful for private upstreams reachable only via VPN, or when running `describe.mjs` in CI without network egress.

## What this script does NOT do

- Write any files.
- Talk to the user — you (the agent) own the conversation.
- Pick tiers or auth shape — only suggests.
- Cache state. Every invocation re-parses the spec from disk.

## Hand-off

Before writing `selections.json`, ask the user once which generation mode they want — count operations from this script's output first:

> *"Your spec has N operations. Two ways to shape the generated MCP tools: (1) **Intent-driven** (recommended in this context) — I cluster the N operations into a small number of higher-level semantic tools like `manage_pet` or `find_pet` and author them directly. The host LLM picks fewer, more meaningful tools better. (2) **One-to-one** — generate exactly N tool files matching the spec verbatim. Useful when the API surface IS the user-facing model, or when you want byte-for-byte traceability between the spec and the tools."*

- **Intent-driven (recommended)**: read [intent-driven.md](intent-driven.md) before writing `selections.json` — you'll need its clustering heuristics to pick a good `workerName` and to design the intents you'll author after scaffold bootstraps the project. Set `"mode": "intent-driven"` explicitly in `selections.json`.
- **One-to-one (default in `scaffold.mjs`)**: curate per-op tiers and `upstreamAuth`, then move to [scaffold.md](scaffold.md). Set `"mode": "one-to-one"` or omit `mode` entirely — `scaffold.mjs` defaults to one-to-one for terminal-safety.
