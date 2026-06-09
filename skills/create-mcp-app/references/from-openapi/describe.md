# describe — inspect the OpenAPI spec

Read-only first step. Run this whenever you (or the user) want to know what the generated worker would look like without writing any files.

## When to read this

- The user has an OpenAPI / Swagger document and wants to see which operations are eligible.
- The user is iterating on which tools to expose, or on tier overrides.
- You're about to write `selections.json` and need the operation list + suggested tiers + resolved security schemes.

## Run

Before the first run, make sure the wrapper can resolve `create-solvapay/scripts/mcp`.
Use one of:

```bash
npm install create-solvapay
# or set SCAFFOLDER_SCRIPTS_DIR to a local create-solvapay/scripts/mcp checkout
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
| `requestBody.content` includes `multipart/form-data` or `application/octet-stream` (binary uploads) | `skip` |
| Response body is a binary stream (`application/octet-stream`, `image/*`, `application/pdf`) | `skip` |

These are suggestions only. The user (via you) picks the final tier per operation in `selections.json`.

**Why `skip` for binary I/O:** MCP tools return text or `structuredContent`, not file streams. An operation that consumes a `multipart/form-data` upload or returns a raw binary payload can't be wrapped as a useful MCP tool — the LLM cannot synthesise the bytes, and the host has no surface for inline downloads.

**How to find them** (in v1, `describe.mjs` does not surface content types — it normalises `requestBody` to `contentType: 'application/json'`). After running `describe.mjs`, grep the original spec for `multipart/form-data`, `application/octet-stream`, `image/`, and `application/pdf` under `requestBody.content` and response `content` keys. For each operation that matches, set `tier: "skip"` in `selections.json` unless you have a specific workaround (e.g. wrapping the upload behind a pre-signed-URL endpoint).

Common offenders: `uploadFile`, `uploadImage`, `downloadAttachment`, anything in a `/files` or `/upload` path.

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
| `oauth2-clientCredentials` | `true` | Exchange `client_id` + `client_secret` for a short-lived bearer at `tokenUrl`; the resulting `Authorization: Bearer <token>` is cached in-isolate. Surfaced as `{ tokenUrl, scopes, flow: 'clientCredentials' }`. |
| `apiKey-unsupported` | `false` | `apiKey` in query or cookie — not supported in v1 |
| `oauth2` | `false` | OAuth 2.0 flows other than `clientCredentials` (`authorizationCode`, `implicit`, `password`) — not supported in v1 |
| `openIdConnect` | `false` | Not supported in v1 |

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

If `servers` is empty, missing, or relative, treat the probe result as a blocking advisory until the user confirms the real upstream base URL. For one-to-one mode, the generated tools derive their API base from the spec; for intent-driven mode, the agent must encode the confirmed base URL in the authored upstream helper.

Also inspect path prefixes before scaffold. A path that breaks the dominant prefix pattern, such as `/apifhir/...` among many `/api/fhir/...` siblings, is usually a spec typo. Ask whether to skip, correct, or explicitly keep that operation before it becomes a generated tool.

Pass `--no-probe` to skip the live calls entirely — useful for private upstreams reachable only via VPN, or when running `describe.mjs` in CI without network egress.

## What this script does NOT do

- Write any files.
- Talk to the user — you (the agent) own the conversation.
- Pick tiers or auth shape — only suggests.
- Cache state. Every invocation re-parses the spec from disk.

## Hand-off — curate gates

Three gates run in this phase, in order. Each follows the structured-question contract in [../hitl-conventions.md](../hitl-conventions.md) — present it through the host's native primitive (e.g. Cursor `AskQuestion`) when available, otherwise the markdown fallback.

Count operations from this script's output first; you'll need `N` for G1.

### Gate G1 — generation mode (always fires)

```
GateId: G1
Prompt: Your spec has N operations. Cluster them into intent tools (recommended when an LLM is in the loop), or generate one tool per operation?
Options:
  - intentDriven: Intent-driven — cluster into a few semantic tools like manage_pet / find_pet
  - oneToOne:     One-to-one — generate exactly N tool files matching the spec verbatim
```

Markdown fallback:

```
### G1 — how should I shape the generated MCP tools?

Your spec has N operations.

- a: Intent-driven (recommended) — I cluster the N operations into a small number of higher-level semantic tools like `manage_pet` or `find_pet`. The host LLM picks fewer, more meaningful tools better.
- b: One-to-one — generate exactly N tool files matching the spec verbatim. Useful when the API surface IS the user-facing model, or for byte-for-byte traceability.

Reply with a / b.
```

- **`G1:intentDriven`**: read [intent-driven.md](intent-driven.md) before writing `selections.json` — you'll need its clustering heuristics. Set `"mode": "intent-driven"` explicitly in `selections.json`. Skip G4 (intent tier is decided per-intent in G2, not per-operation). Continue to G5.
- **`G1:oneToOne`**: set `"mode": "one-to-one"` or omit `mode` entirely. Continue to G4.

### Gate G4 — tier overrides (one-to-one only; fires at standard + chatty)

Skipped entirely when `G1:intentDriven`. Skipped at `auto` (the agent applies `describe.mjs`'s `suggestedTier` defaults verbatim and continues to G5).

```
GateId: G4
Prompt: Here are the suggested tiers per operation. Approve, or edit?
Options:
  - approve: Approve — use the suggested tiers
  - edit:    Edit — describe overrides (e.g. "skip uploadFile, paid for createOrder")
```

Render the operation list as a supporting table above the options. Batch — don't ask per-op:

```
| operationId         | method | path               | suggestedTier | overrideTier |
| ------------------- | ------ | ------------------ | ------------- | ------------ |
| getPetById          | GET    | /pet/{petId}       | free          |              |
| addPet              | POST   | /pet               | paid          |              |
| uploadFile          | POST   | /pet/{petId}/uploadImage | skip    |              |
| ...                                                                                |
```

**Read-only-first when the API is unfamiliar.** If you're wrapping an upstream you've never integrated before, ship the read-only / idempotent operations first (mostly `GET` / `HEAD`) and `tier: "skip"` the mutating ones. Get auth, errors, and the verifier checks green against the safe surface before exposing `POST` / `PUT` / `PATCH` / `DELETE` to the LLM. Add the mutating operations in a follow-up once their semantics and pricing are explicitly approved. Skip this rule when the product's core value *is* a write/action workflow (e.g. "send transactional email", "create invoice") — but still keep `annotations: { destructiveHint: true }` on those tools and confirm the destructive scope with the user.

When the user picks `G4:edit`, accept overrides as free-form text and reflect each change in the `overrideTier` column before moving on. Re-show the table after edits when the override count is non-trivial.

### Gate G5 — upstreamAuth shape + key (always fires, even at `auto`)

`auto` does not collapse this gate — the user must supply the secret. There is no automated path.

```
GateId: G5
Prompt: Confirm upstream auth shape, then paste the credential(s).
Options:
  - bearer:           HTTP Bearer — paste API key
  - apiKey:           API key in header — paste API key
  - multiHeader:      Two or more static headers required together — paste each header's value
  - oauth2:           OAuth2 client credentials — paste clientId + clientSecret
  - none:             No auth (upstream tolerates anonymous calls)
```

Pick the default option from `describe.mjs.securitySchemes` (the first `supported: true` entry — or `multiHeader` when an operation's `security` requires **two or more** `apiKey-header` schemes together). After the user picks, prompt for the secret(s) per [guide.md](guide.md#what-you-gather-during-curate-between-describemjs-and-writing-selectionsjson) step 3. The resolved value lands in `selections.json.upstreamAuth` — `key` for `bearer`/`apiKey`, `clientId` + `clientSecret` (plus optional `scope` / `audience`) for `oauth2-client-credentials`, an array of `{ name, value }` for `apiKey-multi`. Treat the file as a secret per [scaffold.md](scaffold.md#selectionsjson-lifecycle-important).

### Next gate

Once G1 + (G4 when applicable) + G5 are resolved, move to:

- **`G1:intentDriven`** → [intent-driven.md](intent-driven.md) for **G2** (cluster proposal). Then [scaffold.md](scaffold.md) for **G6** (selections.json preview) + scaffold run.
- **`G1:oneToOne`** → [scaffold.md](scaffold.md) for **G6** (selections.json preview) + scaffold run.
