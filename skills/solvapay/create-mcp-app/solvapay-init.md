# solvapay-init — wire SolvaPay credentials

No script — delegate to the SolvaPay CLI's browser-auth flow. This module wires first-time credentials into a freshly scaffolded project.

## When to read this

| State | Use this module |
| --- | --- |
| Fresh scaffold, no `SOLVAPAY_SECRET_KEY` in `.env` yet | Yes — first-time setup. |
| Switching from sandbox `sk_test_…` to live `sk_live_…` | No — that's the deploy step's go-live section (from-openapi: [from-openapi/deploy.md](from-openapi/deploy.md); from-scratch: [hosting/cloudflare.md](hosting/cloudflare.md)). Manual key swap in `.env` + redeploy; no CLI run needed. |

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
- Create a product. If the account has none, init warns and points to Console at https://app.solvapay.com — direct the user there to create one first.
- Deploy anything. After init succeeds, run your mode's deploy step (from-openapi: [from-openapi/deploy.md](from-openapi/deploy.md); from-scratch: [hosting/cloudflare.md](hosting/cloudflare.md) deploy section).

## Sandbox vs live

| Pass | `.env` value | Set on deployed worker via |
| --- | --- | --- |
| First setup (sandbox) | `sk_test_…` written by `solvapay init` | Auto-uploaded by `npm run deploy` on first deploy (from-openapi: [from-openapi/deploy.md](from-openapi/deploy.md); from-scratch: [hosting/cloudflare.md](hosting/cloudflare.md)) |
| Go-live | `sk_live_…` written manually by the user, replacing the sandbox value | `npx wrangler secret put SOLVAPAY_SECRET_KEY`, then `npm run deploy` |

Single worker, single secret slot. There is no `--env production`, no `.env.prod` — the template ships one environment by design.

## API key scoping

Recommend separate keys per environment and per project, even when one merchant account hosts them:

- **Sandbox vs live** — always use `sk_test_…` for `wrangler dev` and any non-production deploy; never reuse a `sk_live_…` for local testing. The CLI defaults to sandbox; only swap to live during the documented go-live step.
- **One key per MCP server / product surface** — if the account hosts multiple MCP servers (or multiple products under one account), provision a separate secret key per project so a leak or revocation on one does not impact the others.
- **Scope where available** — when the SolvaPay Console exposes per-product or per-environment scoping on a key, use the narrowest scope that still works for the worker. The default scope is fine for a single-product scaffold; tighten it when one account fans out to many surfaces.

## Hand-off

- First-time setup → from-openapi: [from-openapi/deploy.md](from-openapi/deploy.md); from-scratch: [hosting/cloudflare.md](hosting/cloudflare.md) deploy section.

## Reference

- [packages/cli/src/commands/init.ts](../../../../solvapay-sdk/packages/cli/src/commands/init.ts) — the browser-auth flow and `.env` write.
- [packages/cli/README.md](../../../../solvapay-sdk/packages/cli/README.md) — public CLI docs.
