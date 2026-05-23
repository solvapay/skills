# test — smoke harness

Exercises each generated tool with sample inputs derived from the OpenAPI examples. Distinct from [verify.md](verify.md): verify checks the worker looks like an MCP server; test checks the tools actually do something.

> **Warning**: `test.mjs` calls every non-`skip` tool once, including `POST` / `PUT` / `PATCH` / `DELETE` operations. Always run against a sandbox upstream or a sandbox account. To exclude specific mutating operations, mark them `tier: "skip"` in `selections.json` before scaffold; you can also temporarily comment out their `register*` call in `src/tools/index.ts`.

## When to read this

- A worker is running (locally or deployed).
- `verify.mjs` passed.
- You want to confirm each generated tool returns a non-error response with realistic inputs.

## Run

From inside the **scaffolded project directory**. One-time setup for `@apidevtools/swagger-parser` (scaffold copies `scripts/test.mjs`, `scripts/lib/openapi.mjs`, and `scripts/package.json` into the project):

```bash
( cd scripts && npm install )

node scripts/test.mjs https://my-worker.<account>.workers.dev \
  --spec path/to/openapi.json
```

`--spec` must be the **same** OpenAPI document that was passed to `describe.mjs` and `scaffold.mjs` — sample inputs are re-synthesised from it.

## How sample inputs are derived

Sample inputs are synthesised per [describe.md's 6-step fallback chain](describe.md#sample-input-synthesis), implemented in `scripts/lib/openapi.mjs`. Tools whose synthesis fell back to placeholders for any parameter are reported `skipped` (reason `"no real example data in spec"`) — placeholders are for shape testing, not for hitting a real upstream.

## What it reports

Per operation:

| Status | Meaning |
| --- | --- |
| `passed` | Tool was called, returned a non-error envelope. |
| `failed` | Tool call threw or returned `isError: true`. |
| `skipped` (`reason: "tier is \`skip\`"`) | Operation flagged as skip by the heuristic in `describe.mjs`. |
| `skipped` (`reason: "operation not registered..."`) | Selections marked this `tier: "skip"`, or the worker is intent-driven so the per-op tool isn't exposed. |
| `skipped` (`reason: "no real example data in spec"`) | Synthesis fell back to placeholders for at least one parameter. |
| `skipped` (`reason: "intent tool — author test inputs manually..."`) | Worker exposes a tool whose name isn't in the spec's `operationId`s and isn't a SolvaPay recovery intent. Almost always means intent-driven mode. Smoke-test it manually per [intent-driven.md](intent-driven.md). |

Plus one `paywallGate` probe: tries a candidate tool with empty args; passes when the response is a text-only gate that names a recovery intent tool, skips when no tool gates, fails when a gate response has malformed shape.

When the worker requires bearer auth (the SDK default — `requireAuth: true`), `test.mjs` can't enumerate the catalog anonymously, so it exits `0` with `overall: "skipped"` and `reason: "worker requires bearer auth; anonymous probe cannot enumerate tools"` plus the `WWW-Authenticate` challenge so you can confirm the gate is well-formed. To actually exercise tools against an auth-gated worker, either pass a bearer token out-of-band (planned follow-up; not in v1) or temporarily flip the worker to `requireAuth: false` in `createSolvaPayMcpFetch` for the smoke run. This mirrors [verify.md](verify.md)'s auth-aware `toolsList` behaviour.

## Reading a `failed` result

When a tool returns `isError: true`, `test.mjs` surfaces the full multi-line error text (up to 1000 chars) under `response.textPreview` — not the 160-char preview used for happy paths. Generated tools throw `UpstreamError` from `template/src/lib/upstreamFetch.ts` whenever the upstream returns non-2xx or non-JSON, so a `failed` line tells you exactly which `METHOD url`, which HTTP status, which `content-type`, and a body snippet to grep against.

The common cause is the `servers[0]` mismatch trap — see [describe.md#server-probe](describe.md#server-probe) for diagnosis and fix.

## Troubleshooting

`test.mjs` only runs against a reachable worker, so the failure modes that bite first are tunnel-start ones — by the time the script reports a `failed` line you've already passed them. Three to know about:

### `cloudflared` SHA mismatch on `wrangler dev`

Symptom: `wrangler dev` (or pressing `[t]` for a quick tunnel) exits with a SHA256 hash mismatch when downloading the `cloudflared` binary. Wrangler ships a pinned hash; when Cloudflare republishes the release the check fails.

Fix: install `cloudflared` yourself and point wrangler at it.

```bash
brew install cloudflared
# Either rely on PATH (wrangler will detect it):
which cloudflared
# Or be explicit:
export CLOUDFLARED_PATH="$(which cloudflared)"
npx wrangler dev
```

### Quick-tunnel hostname rotation

Each `wrangler dev` start picks a new `*.trycloudflare.com` subdomain, but the worker hands out `MCP_PUBLIC_BASE_URL` from `.env` as its OAuth `resource`. End result: connect once to learn the hostname, restart with that hostname in `.env`. For testing against a real MCP host, `npm run deploy` to a stable `*.workers.dev` URL is faster. See [verify.md#wrangler-dev-quick-tunnels-press-t](verify.md#wrangler-dev-quick-tunnels-press-t) for the full breakdown.

### OAuth metadata points at `localhost`

If `test.mjs` exits cleanly but an MCP host (ChatGPT, Claude Desktop, MCPJam) can't connect to the same worker URL, your `.env` is still pointing at `http://localhost:8787`. See [verify.md#oauth-metadata-points-at-localhost](verify.md#oauth-metadata-points-at-localhost).

## Output

JSON on stdout. Exit code `0` when no operation `failed` and the paywall gate didn't fail, `1` otherwise.

## What this script does NOT do

- Decide which tools to call — it iterates the spec, not the worker's catalog (catalog membership is checked, but the source of truth for "should this be tested" is the spec).
- Validate response payload shape against the OpenAPI response schema. v1 only checks `isError` / envelope; shape validation is a follow-up.
- Run mutating tools "for real" beyond a single call with synthesised inputs. The expectation is that the user runs this against a sandbox upstream or one they own.

## Annotation-aware behaviour

`readOnlyHint: true` tools and mutating tools are each called exactly once with synthesised inputs. See the top-of-file warning for how to exclude mutating tools from a run.

## Hand-off

When `test.mjs` returns `overall: "passed"`, the generated worker is ready for hand-tuning. Move to [../tool-design.md](../tool-design.md) for refinement of individual tool surfaces.
