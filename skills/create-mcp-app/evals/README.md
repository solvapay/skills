# create-mcp-app evals

This directory defines the eval suite for the `create-mcp-app` skill. The harness that executes these evals lives outside this repo; this README is the contract it implements.

## Source control

Commit the **eval spec**, not **run results**. The repo is the versioned contract; each harness run is regenerable.

| Commit | Do not commit |
| --- | --- |
| `evals.json` — prompts, expectations, file lists | `iterations/` — generated outputs, transcripts, `timing.json`, `grading.json` |
| `fixtures/` — stable inputs for setup evals | Anything under a per-run workspace the harness creates locally |
| This README — harness contract | Benchmark aggregates or CI artifacts (store those outside git) |

Run outputs go under `iterations/<iteration>/<eval-id>/{with_skill,without_skill}/`. That tree is gitignored at the repo root. Re-run the harness to reproduce them; upload iteration folders as CI artifacts if you need to share a failed run.

## `evals.json` schema

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `skill_name` | string | yes | Skill the suite covers. |
| `dev_mode_suffix` | string | no | Text the harness MUST append verbatim to each eval's `prompt` when running in dev mode (see below). Absent → dev mode is a no-op. |
| `evals[]` | array | yes | Eval cases. Each has `id`, `prompt`, `expected_output`, `files`, `expectations`. |

## Dev-mode contract

The harness selects dev mode when the env var `EVAL_DEV_MODE=1` is set on its invocation.

When dev mode is active and `dev_mode_suffix` is present, the harness MUST concatenate `dev_mode_suffix` to the end of each eval's `prompt` (unchanged) before sending it to the executor. No per-eval edits, no other transformations.

When dev mode is inactive, the harness MUST send `prompt` as-is.

## How `--dev` flows end-to-end

`--dev` seeds `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` into the project `.env`. From there:

- The Cloudflare Worker reads it via `env.SOLVAPAY_API_BASE_URL` and routes SolvaPay SDK calls to api-dev.
- `scripts/deploy.mjs` forwards it as a `--var` override to `wrangler deploy`, so the deployed Worker hits api-dev too.
- `solvapay init --dev` mints keys against api-dev and writes them to `.env`.

Supported entry points:

| Entry point | Flag | Behaviour |
| --- | --- | --- |
| `npm create solvapay@latest ... --type mcp --dev` | `--dev` | Seeds `.env`, forwards to `solvapay init --dev`. |
| `npx solvapay@latest init --dev` | `--dev` | Mints api-dev keys, writes to `.env`. |
| `node scripts/scaffold.mjs <spec> <dir> --selections <path> --dev` | `--dev` | Seeds `.env`. Explicit `selections.apiBaseUrl` wins over the flag. |

Internal testing only — production keys are rejected by api-dev.

## Follow-up

Per-eval `expectations_dev` to assert the dev codepath actually ran (e.g. `.env` contains `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com`) is deferred to a separate slice; current expectations are dev/prod-agnostic.
