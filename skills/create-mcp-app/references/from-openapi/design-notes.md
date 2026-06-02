# Design notes: create-mcp-app/from-openapi skill ↔ template

Rationale for individual choices in the template + scaffold contract. Maintainer-facing; the routine happy-path agent doesn't load this. Pair with [tool-template.md](tool-template.md), which states *what* the contract is.

## Why the arrow wrapper

`src/worker.ts` uses `additionalTools: ctx => registerTools(ctx, env)` rather than `additionalTools: registerTools`. The SDK's `additionalTools` hook is called with `ctx` only — there's no way to surface the Workers `env` binding through it. The arrow wrapper closes over `env` from the outer `fetch` scope so generated tool handlers can read `env.UPSTREAM_API_KEY`. Adapted from [examples/cloudflare-workers-mcp/src/worker.ts](https://github.com/solvapay/solvapay-sdk/blob/main/examples/cloudflare-workers-mcp/src/worker.ts) lines 80–109.

## `registerTools` signature is always `(ctx, env)`

`registerTools` takes `(ctx, env)` regardless of `selections.json.upstreamAuth.kind`. The template's `src/worker.ts` ships with `additionalTools: ctx => registerTools(ctx, env)` baked in and scaffold doesn't rewrite it, so the aggregator signature has to match. For `upstreamAuth.kind === 'none'`, `env` is in scope but unused — individual per-operation handlers still drop `env` from their own signatures.

## `env.UPSTREAM_API_KEY` is `string | undefined`

Both authenticated branches wrap `env.UPSTREAM_API_KEY` in a template literal so the header value satisfies `HeadersInit`'s `string` requirement. The runtime safety net is `UPSTREAM_API_KEY` on the Worker — uploaded from `.env` by `deploy.mjs` on first deploy, not a compile-time guard.

## Placeholders are straight string-replace, not interpolation

Placeholders use straight string-replace, not template interpolation. This keeps template files (`wrangler.jsonc`, `.env.example`, `src/worker.ts`) valid TypeScript / JSON / JSONC standalone — editors and CI lint them without `scaffold.mjs` ever having run.

## Why the template ships an example tool

`template/src/tools/example.ts` plus its entry in `src/tools/index.ts` exist so the template compiles, type-checks, and runs under `wrangler dev` *before* scaffold ever touches it. Independently testable template; scaffold removes both wholesale at copy time.

## Why one environment, not two

The skill's `template/scripts/deploy.mjs` is a single-environment variant of [examples/cloudflare-workers-mcp/scripts/deploy.mjs](https://github.com/solvapay/solvapay-sdk/blob/main/examples/cloudflare-workers-mcp/scripts/deploy.mjs). The multi-env path in the source example exists for SolvaPay's own goldberg-demo and creates exactly the split-state the generated worker doesn't need. Go-live is a key swap (replace `sk_test_…` with `sk_live_…` in `.env`, re-run `wrangler secret put`, redeploy), not a separate environment.

## `.env` + Worker Secret lifecycle in one place

Both `SOLVAPAY_SECRET_KEY` and `UPSTREAM_API_KEY` live in `.env` (gitignored) for `wrangler dev` and are uploaded as Worker Secrets for deployed runs. Neither is passed via `--var` — that's reserved for non-secret values. Rotation is by `wrangler secret put` plus a redeploy. The operational flow is documented once in [deploy.md](deploy.md); duplicating it in the contract doc was the original sin this design note exists to record.

## Why `upstreamFetchJson` sets `Accept: application/json` by default

Content-negotiating upstreams default to XML when the `Accept` header isn't pinned. `petstore.swagger.io` is the canonical offender — without the explicit `Accept`, generated tools receive XML and the `JSON.parse` step throws `Unexpected token '<'`, looping the model on a meaningless error string. The helper sets it once; generated tools never repeat it.

## Why `UpstreamError` keeps structured fields

The thrown `UpstreamError` carries `status`, `contentType`, `bodySnippet`, `parseError`, `method`, `url` on the instance so hand-tuned tools (intent-driven mode) can `catch` and branch — e.g. treat 404 as "not found" silently, or surface 429 as a nudge to retry. The default conversion to an MCP error envelope (via SDK wrapping for free, `formatError` for paid) is the safe fallback when the tool doesn't catch.

## Why typed upstream is docs-only, not codegen

The agent (LLM) authoring intent-driven tools is the consumer of typed upstream — not the human running scaffold. Teaching the agent in [intent-driven.md](intent-driven.md) to run `npx openapi-typescript` on demand captures the value without baking a dep + regen story into every scaffold. 1:1-mode users who don't field-access on `data` pay zero cost; intent-driven users (the default) opt in with a single command.

The deliberate split holds: typed upstream is the developer contract (catches field renames at compile time); the MCP `inputSchema` zod stays hand-rolled and lossy (LLM contract — flat tool surface).

Critical constraint that drives the docs rewrite: the agent copies whatever it last saw in the skill. So every example in the skill uses the typed form, and `Record<string, unknown>` exists in **emitted** 1:1 scaffold code only (where the default handler doesn't field-access, so the looser type is harmless) — never in docs.
