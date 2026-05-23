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

Full `selections.json` schema lives in [references/selections-schema.md](references/selections-schema.md).

## `selections.json` lifecycle (important)

`selections.json` contains the literal upstream API key under `upstreamAuth.key`. Treat it like a secret:

1. Write it to a path outside the target project. Recommended: `/tmp/selections-<uuid>.json` (POSIX) or `%TEMP%\selections-<uuid>.json` (Windows).
2. Run `scaffold.mjs`.
3. Delete the file immediately after.

`scaffold.mjs` refuses to run if the `--selections` path resolves inside `<target-dir>`. It never writes `selections.json` into the scaffolded project. This prevents a follow-up `git add .` from leaking the key.

## Run

Assumes you already ran the one-time `( cd scripts && npm install )` from [describe.md](describe.md).

```bash
node scripts/scaffold.mjs path/to/openapi.json /path/to/petstore-mcp \
  --selections /tmp/selections-9f1c.json
```

## What it does

1. Validates `selections.json` (discriminated union on `upstreamAuth.kind`; `mode` optional with `'one-to-one'` default).
2. Hard-fails if `<target-dir>` exists, or if `--selections` resolves inside `<target-dir>`.
3. Copies the template (`template/`) to `<target-dir>`, substituting placeholders (`__WORKER_NAME__`, `__RESOURCE_URI_SLUG__`, `__SOLVAPAY_PRODUCT_REF__`, `__MCP_PUBLIC_BASE_URL__`). Preserves `.env.example` verbatim. Includes `scripts/verify.mjs`, `scripts/test.mjs`, and `scripts/lib/` for post-deploy checks (see [verify.md](verify.md) and [test.md](test.md)).
4. **In one-to-one mode (default)**, for each operation with `tier !== 'skip'`, writes `src/tools/<operationId>.ts` with:
   - `register{OperationId}(ctx, env)` (or `(ctx)` when `upstreamAuth.kind === 'none'`).
   - `ctx.registerPayable(...)` for paid tiers, `ctx.server.registerTool(...)` for free tiers.
   - Correct auth header (`Authorization: Bearer ${env.UPSTREAM_API_KEY}` for `kind: "bearer"`, `<name>: ${env.UPSTREAM_API_KEY}` for `kind: "apiKey"`).

   **In intent-driven mode**, skips per-op codegen entirely. The agent (you) authors `src/tools/<intent>.ts` files directly after scaffold finishes — see [intent-driven.md](intent-driven.md) for templates and clustering guidance.
5. Writes `src/tools/index.ts`:
   - **One-to-one**: imports + calls every generated `register{OperationId}` from one `registerTools(ctx, env)` aggregator. Removes the template's example tool.
   - **Intent-driven**: writes an empty aggregator (`registerTools(_ctx, _env) { /* Intent tools registered here. See intent-driven.md. */ }`). You edit this file each time you add a new intent tool.
6. Writes `.env` with `SOLVAPAY_PRODUCT_REF` (or the `__SOLVAPAY_PRODUCT_REF__` placeholder when `solvapayProductRef` is omitted from `selections.json`), `MCP_PUBLIC_BASE_URL`, and (when applicable) `UPSTREAM_API_KEY`. **Does not write `SOLVAPAY_SECRET_KEY`** — that's [../solvapay-init.md](../solvapay-init.md).
7. Ensures `.gitignore` covers `.env`.
8. Prints a JSON summary on stdout: mode used, files written, operations generated (empty in intent-driven mode), secrets seeded, and reminders. In intent-driven mode the reminders include a pointer to `intent-driven.md`.

## What it refuses to do

- Overwrite an existing `<target-dir>`. Re-running scaffold against an existing project is an open follow-up. Delete and re-run for now.
- Generate a tool that requires an unsupported security scheme (oauth2, openIdConnect, query/cookie apiKey, combined schemes) unless either the operation is `tier: "skip"` or `upstreamAuth.kind = "none"`. The error message names the offending operation and both remediations.
- Write `selections.json` into the scaffolded project.
- Populate `SOLVAPAY_SECRET_KEY`. That's [../solvapay-init.md](../solvapay-init.md)'s job.

## After scaffold

- **One-to-one mode**: move to [../solvapay-init.md](../solvapay-init.md) to populate `SOLVAPAY_SECRET_KEY` via browser auth and pick `SOLVAPAY_PRODUCT_REF` from the account's products.
- **Intent-driven mode**: move to [intent-driven.md](intent-driven.md) first — author your `src/tools/<intent>.ts` files and update the aggregator. Then continue to [../solvapay-init.md](../solvapay-init.md). (Order doesn't matter strictly; both are required before deploy.)

For typed upstream calls (recommended in intent-driven mode), see [intent-driven.md#typed-upstream-recommended](intent-driven.md#typed-upstream-recommended).

Delete the temporary `selections.json` you created in step 1.
