# solvapay-init — wire SolvaPay credentials

No script — delegate to the SolvaPay CLI's browser-auth flow. This module exists so first-time setup and credential rotation share the same entry point.

## When to read this

| State | Use this module |
| --- | --- |
| Fresh scaffold, no `SOLVAPAY_SECRET_KEY` in `.env` yet | Yes — first-time setup. |
| Existing project, user rotated their SolvaPay key | Yes — populate the new key, then redeploy. |
| Switching from sandbox `sk_test_…` to live `sk_live_…` | No — that's [deploy.md](deploy.md)'s go-live section (manual key swap in `.env` + redeploy; no CLI run needed). |
| Lost track of which environment a deployed worker points at | No — check `wrangler secret list` first. |

## Run

From inside the freshly scaffolded directory:

```bash
cd /path/to/petstore-mcp
npx solvapay init
```

The CLI:

- Opens a browser, signs the user in (or creates an account), exchanges for a sandbox `sk_test_…`.
- Appends `SOLVAPAY_SECRET_KEY` to `.env` using its append-safe writer (does not clobber `SOLVAPAY_PRODUCT_REF` or `UPSTREAM_API_KEY` that scaffold already wrote).
- Ensures `.env` is in `.gitignore` (scaffold also does this; CLI is the redundant guard).
- Verifies the key against the SolvaPay API.
- Configures `SOLVAPAY_PRODUCT_REF`:
  - If `.env` already has a real ref, verifies it via `GET /v1/sdk/products/<ref>` and asks **Keep this? [Y/n]** (skipped under `--yes`).
  - If the ref is missing, still the scaffold placeholder, or not found on the account, lists products via `GET /v1/sdk/products?limit=10` (newest first) and prompts:
    - **0 products** — warns with a Console URL and skips the step.
    - **1 product** — `Use "<name>" (prd_xxx)? [Y/n]`.
    - **2+ products** — numbered list (cap 10), `Pick a product [1-N] (default 1)`.
  - Under `--yes` or non-TTY, auto-picks the newest product and logs which ref was chosen.
  - Writes the chosen ref to `.env`.
- Installs / verifies `@solvapay/server` and `@solvapay/core` (the template's `package.json` already declares both, so this is mostly a verify step).

## What the CLI does NOT do

- Populate `MCP_PUBLIC_BASE_URL`. Scaffold writes `http://localhost:8787`; `deploy.mjs` auto-resolves the live workers.dev URL on first deploy.
- Populate `UPSTREAM_API_KEY`. Scaffold writes it from `selections.upstreamAuth.key`.
- Create a product. If the account has none, init warns and points to Console — route to [../provider-onboarding/guide.md](../provider-onboarding/guide.md) first.
- Deploy anything. Rotation and first-time setup both end with a re-run of [deploy.md](deploy.md).

## Sandbox vs live

| Pass | `.env` value | Set on deployed worker via |
| --- | --- | --- |
| First setup (sandbox) | `sk_test_…` written by `solvapay init` | `wrangler secret put SOLVAPAY_SECRET_KEY` (in [deploy.md](deploy.md)) |
| Go-live | `sk_live_…` written manually by the user, replacing the sandbox value | `wrangler secret put SOLVAPAY_SECRET_KEY` again, then `npm run deploy` |

Single worker, single secret slot. There is no `--env production`, no `.env.prod` — the template ships one environment by design.

## Post-rotation redeploy

When this module is invoked for an **already-deployed** worker (the user rotated their key after a leak, or wants to switch accounts):

1. `npx solvapay init` writes the new `SOLVAPAY_SECRET_KEY` to `.env`.
2. The deployed worker still has the old key on the Workers Secret store.
3. Route the user to [deploy.md](deploy.md) step 1: `wrangler secret put SOLVAPAY_SECRET_KEY` (paste the new value from `.env`) followed by `npm run deploy`.

Rotation is not complete until both `.env` and the deployed Secret have the new value.

## Hand-off

- First-time setup → [deploy.md](deploy.md).
- Rotation → [deploy.md](deploy.md) (push new secret + redeploy).

## Reference

- [packages/cli/src/commands/init.ts](../../../../solvapay-sdk/packages/cli/src/commands/init.ts) — the browser-auth flow and `.env` write.
- [packages/cli/README.md](../../../../solvapay-sdk/packages/cli/README.md) — public CLI docs.
