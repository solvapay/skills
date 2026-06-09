# solvapay-init — wire SolvaPay credentials

No script — delegate to the SolvaPay CLI's browser-auth flow. This module wires first-time credentials into a freshly scaffolded project.

## When to read this

| State | Use this module |
| --- | --- |
| Fresh scaffold, no `SOLVAPAY_SECRET_KEY` in `.env` yet | Yes — first-time setup. |
| Switching from sandbox `sk_test_…` to live `sk_live_…` | No — that's the deploy step's go-live section (from-openapi: [from-openapi/deploy.md](from-openapi/deploy.md); from-scratch: [hosting/cloudflare/README.md](hosting/cloudflare/README.md)). Manual key swap in `.env` + redeploy; no CLI run needed. |

## Run

From inside the freshly scaffolded directory:

```bash
cd /path/to/petstore-mcp
npx -y solvapay@latest init

# Internal testing only — target the SolvaPay dev backend. Use the
# @preview dist-tag (not @latest) so the CLI matches the preview tooling
# dev mode expects. Writes SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com
# to .env so the worker, wrangler dev, and the deploy preflight all hit api-dev.
npx -y solvapay@preview init --dev
```

The `@latest` suffix re-resolves the registry every run (so cached CLIs never lag behind); `-y` auto-confirms the npx install prompt (required for non-interactive / agent execution). Under `--dev`, use `@preview` instead of `@latest` — it tracks the same preview build as `create-solvapay@preview`, keeping the CLI and scaffolder in lockstep.

For agent runs, expect this command to pause for a human browser-auth click. Run it in a background terminal or otherwise avoid streaming the auth spinner into the chat transcript; treat a quiet wait for browser approval as expected, not as a hang.

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
  - Under `--yes` or non-TTY, may auto-pick a product and log which ref was chosen. Treat that as provisional until G10 confirms it.
  - Writes the chosen ref to `.env`.
- Installs / verifies `@solvapay/server` and `@solvapay/core` (the template's `package.json` already declares both, so this is mostly a verify step).

## Gate G10 — product / metering confirmation

After init, read the resulting `SOLVAPAY_PRODUCT_REF` from `.env` and confirm it is the product intended for this MCP server. This gate is mandatory at every confirmation level, and especially when init ran under `--yes` or non-TTY, because unattended product selection can otherwise bind a new MCP to an unrelated account product.

For non-TTY / `--yes` runs, prefer seeding the product before init via `selections.solvapayProductRef` or an existing `.env` value. If no product ref is known, pause and ask for the intended `prd_...` rather than treating an auto-picked product as final.

If the user already knows the intended product, seed it before init (via `selections.solvapayProductRef` or an existing `.env` value) so the CLI verifies that exact ref instead of selecting for you. If the CLI picked an unrelated smoke/test product, replace `SOLVAPAY_PRODUCT_REF` with the intended `prd_...` and rerun init or the product verification before deploy.

For usage-based or metered products, also verify the selected product has the plan the MCP is supposed to sell. `selections.plans[]` is documentation plus scaffold validation; scaffold does **not** create plans in SolvaPay. Create or verify the free default / usage-based plan in Console or via the SDK before handoff, and record the status in the MCP app handoff as `usage-based plan verified` or `needs user action`.

## What the CLI does NOT do

- Populate `MCP_PUBLIC_BASE_URL`. Scaffold writes `http://localhost:8787`; `deploy.mjs` auto-resolves the live workers.dev URL on first deploy.
- Populate upstream credentials. Scaffold writes `UPSTREAM_API_KEY`, `UPSTREAM_API_HEADERS`, or the `UPSTREAM_OAUTH_*` family from `selections.upstreamAuth`.
- Create products or plans. If the account has no product, init warns and points to Console at https://app.solvapay.com. If the selected product needs a usage-based metering plan, create or verify that plan outside scaffold before handoff.
- Deploy anything. After init succeeds, run your mode's deploy step (from-openapi: [from-openapi/deploy.md](from-openapi/deploy.md); from-scratch: [hosting/cloudflare/README.md](hosting/cloudflare/README.md)).

## Default plan and auto-enrollment

MCP products should ship with a **free recurring default plan** (`price: 0`, `freeUnits > 0`). The SolvaPay API rejects paid recurring, one-time, and hybrid defaults — only free recurring or usage-based plans can be marked default.

On the **first paywalled tool call**, the backend's `checkLimits` path auto-enrolls the customer: it creates a Purchase with `origin: 'free_default'` and grants access without calling `activate_plan`. Paid defaults still return `activationRequired: true` (legacy rows only — new products cannot set a paid recurring default via the SDK).

When creating a product in Console or via the SDK, set:

- **Default plan** — free recurring, `price: 0`, `freeUnits` high enough for your free tier (e.g. 10–100).
- **Paid plans** — separate non-default tiers for upgrades.

Merchants who want explicit enrollment at signup can still call `solvapay.purchases.activate(...)` or expose the MCP `activate_plan` tool — but for free defaults the first `checkLimits` / tool call is the enrollment boundary.

If the agent authored `selections.plans` during curate, `scaffold.mjs` pre-flights those entries against the same default-plan guardrail before any API call (see [from-openapi/selections-schema.md](from-openapi/selections-schema.md)).

## Sandbox vs live

| Pass | `.env` value | Set on deployed worker via |
| --- | --- | --- |
| First setup (sandbox) | `sk_test_…` written by `solvapay init` | Auto-uploaded by `npm run deploy` on first deploy (from-openapi: [from-openapi/deploy.md](from-openapi/deploy.md); from-scratch: [hosting/cloudflare/README.md](hosting/cloudflare/README.md)) |
| Go-live | `sk_live_…` written manually by the user, replacing the sandbox value | `npx wrangler secret put SOLVAPAY_SECRET_KEY`, then `npm run deploy` |

Single worker, single secret slot. There is no `--env production`, no `.env.prod` — the template ships one environment by design.

## API key scoping

Recommend separate keys per environment and per project, even when one merchant account hosts them:

- **Sandbox vs live** — always use `sk_test_…` for `wrangler dev` and any non-production deploy; never reuse a `sk_live_…` for local testing. The CLI defaults to sandbox; only swap to live during the documented go-live step.
- **One key per MCP server / product surface** — if the account hosts multiple MCP servers (or multiple products under one account), provision a separate secret key per project so a leak or revocation on one does not impact the others.
- **Scope where available** — when the SolvaPay Console exposes per-product or per-environment scoping on a key, use the narrowest scope that still works for the worker. The default scope is fine for a single-product scaffold; tighten it when one account fans out to many surfaces.

## Hand-off

- First-time setup → from-openapi: [from-openapi/deploy.md](from-openapi/deploy.md); from-scratch: [hosting/cloudflare/README.md](hosting/cloudflare/README.md).

## Reference

- [packages/cli/src/commands/init.ts](https://github.com/solvapay/solvapay-sdk/blob/main/packages/cli/src/commands/init.ts) — the browser-auth flow and `.env` write.
- [packages/cli/README.md](https://github.com/solvapay/solvapay-sdk/blob/main/packages/cli/README.md) — public CLI docs.
