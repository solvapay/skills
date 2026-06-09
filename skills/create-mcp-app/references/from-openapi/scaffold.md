# scaffold — generate the worker

Destructive step. Takes a curated `selections.json` and produces a Cloudflare Workers MCP project with one tool file per non-skipped operation, SolvaPay paywall wiring on paid tools, and a gitignored `.env`.

## When to read this

- You ran [describe.md](describe.md), curated tier overrides with the user, and gathered `upstreamAuth`.
- You're ready to write `selections.json` and generate the project.

## Inputs

| Input | Source |
| --- | --- |
| `<spec>` | OpenAPI document path (same one passed to `describe.mjs`). |
| `<target-dir>` | Fresh directory path — must not exist. |
| `--selections <path>` | Path to `selections.json`, **outside** `<target-dir>`. |

Full `selections.json` schema lives in [selections-schema.md](selections-schema.md).

## `selections.json` lifecycle (important)

`selections.json` contains the literal upstream API key under `upstreamAuth.key`. Treat it like a secret:

1. Write it to a path outside the target project. Recommended: `/tmp/selections-<uuid>.json` (POSIX) or `%TEMP%\selections-<uuid>.json` (Windows).
2. Run `scaffold.mjs`.
3. Delete the file immediately after.

`scaffold.mjs` refuses to run if the `--selections` path resolves inside `<target-dir>`. It never writes `selections.json` into the scaffolded project. This prevents a follow-up `git add .` from leaking the key.

## Gate G6 — selections.json preview (always at standard + chatty; auto: confirm-only, no preview)

Last reviewable artifact before the destructive scaffold step. **G6 always fires** — even at `auto` — because `scaffold.mjs` writes files to disk. The difference between levels:

- **`standard` + `chatty`**: render the full resolved JSON with secrets redacted, then ask for `run` or `edit`.
- **`auto`**: skip the JSON preview, just ask one short confirmation (`run` / cancel) before invoking `scaffold.mjs`. The scaffold step itself is not collapsible at any level.

```
GateId: G6
Prompt: Here's the resolved selections.json. Run scaffold, or edit?
Options:
  - run:  Run scaffold — write the project
  - edit: Edit — change tiers, auth, worker name, or mode
```

### Redaction rules

Per [../hitl-conventions.md#redaction](../hitl-conventions.md#redaction), before rendering replace these fields with `"<redacted>"`:

- `upstreamAuth.key` (when `kind` is `bearer` or `apiKey`)
- `upstreamAuth.clientSecret` (when `kind` is `oauth2-client-credentials`)
- `upstreamAuth.headers[].value` (when `kind` is `apiKey-multi`)

Leave everything else verbatim — `upstreamAuth.kind`, `tokenUrl`, `clientId`, `name`, `in`, `scope`, `audience`, `headers[].name`, `mode`, `workerName`, `mcpPublicBaseUrl`, and the full `operations` / `solvapayProductRef` payload. The user needs to see exactly what `scaffold.mjs` will consume.

Render the redacted JSON as a fenced ```jsonc``` block above the options.

> **Mode matters for the JSON shape:**
> - **`mode: "one-to-one"`** includes the `operations[]` array — one entry per operationId with its resolved tier. Render it.
> - **`mode: "intent-driven"`** has **no `operations[]` field**. Tier-per-op lives implicitly in the cluster proposal you already approved at G2; `selections.json` for intent-driven only carries `mode`, `workerName`, `mcpPublicBaseUrl`, `upstreamAuth`, and `solvapayProductRef`. **Do not invent an `operations[]` array in the intent-driven G6 preview** — if you see one in your draft, you have leaked one-to-one shape into intent-driven mode; drop it before rendering.

One-to-one example:

````
### G6 — run scaffold with this selections.json?

```jsonc
{
  "mode": "one-to-one",
  "workerName": "petstore-mcp",
  "mcpPublicBaseUrl": "http://localhost:8787",
  "upstreamAuth": {
    "kind": "bearer",
    "key": "<redacted>"
  },
  "operations": [
    { "operationId": "getPetById", "tier": "free" },
    { "operationId": "addPet",     "tier": "paid" }
    // ...
  ]
}
```

- a: Run scaffold — write the project
- b: Edit — change tiers, auth, worker name, or mode

Reply with a / b.
````

Intent-driven example (note: no `operations[]`):

````
### G6 — run scaffold with this selections.json?

```jsonc
{
  "mode": "intent-driven",
  "workerName": "petstore-mcp",
  "mcpPublicBaseUrl": "http://localhost:8787",
  "upstreamAuth": {
    "kind": "bearer",
    "key": "<redacted>"
  },
  "solvapayProductRef": "prd_..."
}
```

- a: Run scaffold — write the project
- b: Edit — change auth, worker name, or mode

Reply with a / b.
````

On `G6:edit`, accept the change description, mutate the in-memory selections, re-render the redacted JSON once, and re-ask. On `G6:run`, write the file to a non-project path (`/tmp/selections-<uuid>.json`) and proceed to [Run](#run).

The redacted preview is render-time only — the file written to `/tmp/selections-<uuid>.json` still carries the real `key` / `clientSecret`, because `scaffold.mjs` needs them to seed `.env`.

## Run

Assumes the wrapper can already resolve `create-solvapay/scripts/mcp` per
[describe.md](describe.md).

```bash
node scripts/scaffold.mjs path/to/openapi.json /path/to/petstore-mcp \
  --selections /tmp/selections-9f1c.json
```

## What it does

1. Validates `selections.json` (discriminated union on `upstreamAuth.kind` — one of `none` / `bearer` / `apiKey` / `oauth2-client-credentials` / `apiKey-multi`; `mode` optional with `'one-to-one'` default).
2. Hard-fails if `<target-dir>` exists, or if `--selections` resolves inside `<target-dir>`.
3. Copies the template (`template/`) to `<target-dir>`, substituting placeholders (`__WORKER_NAME__`, `__RESOURCE_URI_SLUG__`, `__SOLVAPAY_PRODUCT_REF__`, `__MCP_PUBLIC_BASE_URL__`). Preserves `.env.example` verbatim. Includes `scripts/verify.mjs`, `scripts/test.mjs`, and `scripts/lib/` for post-deploy checks (see [verify.md](verify.md) and [test.md](test.md)).
4. **In one-to-one mode (default)**, for each operation with `tier !== 'skip'`, writes `src/tools/<operationId>.ts` with:
   - `register{OperationId}(ctx, env)` (or `(ctx)` when `upstreamAuth.kind === 'none'`).
   - `ctx.registerPayable(...)` for paid tiers, `ctx.server.registerTool(...)` for free tiers.
   - Correct auth header per `upstreamAuth.kind`:
     - `bearer` → `Authorization: Bearer ${env.UPSTREAM_API_KEY}`
     - `apiKey` → `<name>: ${env.UPSTREAM_API_KEY}`
     - `oauth2-client-credentials` → `const token = await getAccessToken(env)` right before URL construction, then `Authorization: Bearer ${token}`. The `getAccessToken` helper lives in `src/lib/upstreamOAuth.ts` (shipped in `_base`) and caches the exchanged token in-isolate.
     - `apiKey-multi` → spread `...(JSON.parse(env.UPSTREAM_API_HEADERS ?? '{}') as Record<string, string>)` into the request headers (two or more static credential headers, carried as one compact-JSON env var).

   **In intent-driven mode**, skips per-op codegen entirely. The agent (you) authors `src/tools/<intent>.ts` files directly after scaffold finishes — see [intent-driven.md](intent-driven.md) for templates and clustering guidance.
5. Writes `src/tools/index.ts`:
   - **One-to-one**: imports + calls every generated `register{OperationId}` from one `registerTools(ctx, env)` aggregator. Removes the template's example tool.
   - **Intent-driven**: writes an empty aggregator (`registerTools(_ctx, _env) { /* Intent tools registered here. See intent-driven.md. */ }`). You edit this file each time you add a new intent tool.
6. Writes `.env` with `SOLVAPAY_PRODUCT_REF` (or the `__SOLVAPAY_PRODUCT_REF__` placeholder when `solvapayProductRef` is omitted from `selections.json`), `MCP_PUBLIC_BASE_URL`, and per `upstreamAuth.kind`:
   - `bearer` / `apiKey` → `UPSTREAM_API_KEY`
   - `oauth2-client-credentials` → `UPSTREAM_OAUTH_TOKEN_URL`, `UPSTREAM_OAUTH_CLIENT_ID`, `UPSTREAM_OAUTH_CLIENT_SECRET`, plus `UPSTREAM_OAUTH_SCOPE` / `UPSTREAM_OAUTH_AUDIENCE` when supplied.
   - `apiKey-multi` → `UPSTREAM_API_HEADERS` (a single compact-JSON object keyed by header name → value).

   **Does not write `SOLVAPAY_SECRET_KEY`** — that's [../solvapay-init.md](../solvapay-init.md).
7. Ensures `.gitignore` covers `.env`.
8. Prints a JSON summary on stdout: mode used, files written, operations generated (empty in intent-driven mode), secrets seeded, and reminders. In intent-driven mode the reminders include a pointer to `intent-driven.md`.

## Generated docs expectations

Before handoff, skim the generated README and `.env.example` for mode/auth accuracy:

- **Intent-driven mode** — generated docs must not claim every tool maps one-to-one to an OpenAPI operation. The scaffold only writes the skeleton and an empty aggregator; the agent-authored `src/tools/<intent>.ts` files are the tool contract.
- **One-to-one mode** — one generated tool per selected operation is accurate, but skipped operations and unsupported auth remediations should be called out.
- **`apiKey-multi` auth** — docs should name `UPSTREAM_API_HEADERS` (compact JSON keyed by header name) instead of only `UPSTREAM_API_KEY`.
- **Secret refresh** — docs should say first deploy uploads missing Worker secrets, but later `.env` edits require explicit `npx wrangler secret put <NAME>` before redeploy.

If the package template source is available locally, fix it there. If not, patch the generated README in the project and list the upstream template change as a follow-up.

## What it refuses to do

- Overwrite an existing `<target-dir>`. Re-running scaffold against an existing project is an open follow-up. Delete and re-run for now.
- Generate a tool that requires an unsupported security scheme (non-`clientCredentials` oauth2 flows, openIdConnect, query/cookie apiKey, combined schemes) unless either the operation is `tier: "skip"` or `upstreamAuth.kind = "none"`. The error message names the offending operation and both remediations. OAuth2 `clientCredentials` IS supported — set `upstreamAuth.kind: "oauth2-client-credentials"` with `tokenUrl`, `clientId`, and `clientSecret`.
- Write `selections.json` into the scaffolded project.
- Populate `SOLVAPAY_SECRET_KEY`. That's [../solvapay-init.md](../solvapay-init.md)'s job.

## After scaffold

- **One-to-one mode**: move to [../solvapay-init.md](../solvapay-init.md) to populate `SOLVAPAY_SECRET_KEY` via browser auth and pick `SOLVAPAY_PRODUCT_REF` from the account's products.
- **Intent-driven mode**: move to [intent-driven.md](intent-driven.md) first — author your `src/tools/<intent>.ts` files and update the aggregator. Then continue to [../solvapay-init.md](../solvapay-init.md). (Order doesn't matter strictly; both are required before deploy.)

For typed upstream calls (recommended in intent-driven mode), see [intent-driven.md#typed-upstream-recommended](intent-driven.md#typed-upstream-recommended).

Delete the temporary `selections.json` you created in step 1.
