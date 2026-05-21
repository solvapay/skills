# deploy — push to Cloudflare Workers

Orchestration prose, no script. Whatever `SOLVAPAY_SECRET_KEY` is in `.env` is what gets uploaded as a Worker Secret. One worker, one environment, one secret slot.

## When to read this

- You ran [scaffold.md](scaffold.md) and [solvapay-init.md](solvapay-init.md). `.env` has `SOLVAPAY_SECRET_KEY`, `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`, and `UPSTREAM_API_KEY` (when applicable).
- You rotated the SolvaPay key in [solvapay-init.md](solvapay-init.md) and need to push the new value to the deployed worker.
- You've tested in sandbox and want to swap in `sk_live_…`.

## Prerequisites

- `wrangler login` succeeded once for this account. If not, `npm run deploy` exits early with `npx wrangler login` instructions.
- On a **fresh Cloudflare account**, register a workers.dev subdomain once before the first deploy. `scripts/deploy.mjs` pre-flights this and prints `https://dash.cloudflare.com/<account>/workers/onboarding` instead of letting `wrangler deploy` fail with a buried link.
- `.env` is populated. Run [solvapay-init.md](solvapay-init.md) first if it isn't.
- Dependencies are installed. `npx solvapay init` already ran `npm install` (or the detected package manager equivalent) — no need to re-run unless `package.json` changed.

## Step 1 — push secrets and deploy

Run from inside the scaffolded directory:

```bash
wrangler secret put SOLVAPAY_SECRET_KEY
# Paste the value currently in .env (sandbox sk_test_… on the first pass).

npm run deploy
```

`npm run deploy` runs the template's `scripts/deploy.mjs`. The script:

- Pre-flights Cloudflare auth (`wrangler whoami`) and workers.dev subdomain registration (Cloudflare API `GET /accounts/{id}/workers/subdomain`). Exits with actionable messages when logged out or the subdomain is not registered yet.
- Auto-resolves `MCP_PUBLIC_BASE_URL` when `.env` still holds the scaffold placeholder (`http://localhost:8787` or `__MCP_PUBLIC_BASE_URL__`): computes `https://<worker>.<subdomain>.workers.dev` from `wrangler.jsonc#name` + the account subdomain, writes it to `.env` before deploy, then verifies wrangler's output matches. Skipped when you already set a custom URL or `wrangler.jsonc` has a `custom_domain` route.
- Reads `.env` and forwards `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`, and `SOLVAPAY_API_BASE_URL` as `--var` overrides to `wrangler deploy`.
- Uploads `UPSTREAM_API_KEY` from `.env` automatically when scaffold wrote it (i.e. when `selections.json.upstreamAuth.kind` was `bearer` or `apiKey`). Skipped when the key is absent from `.env` (`kind: "none"`) or already on the worker. To rotate an upstream key, update `.env` and run `wrangler secret put UPSTREAM_API_KEY` manually.

`SOLVAPAY_SECRET_KEY` is **not** passed via `--var` — set it once with `wrangler secret put` as shown above.

On a default `*.workers.dev` deploy, **one** `npm run deploy` is enough — you do not need a second deploy to pin `MCP_PUBLIC_BASE_URL`.

Note the deployed URL in the wrangler output (for custom-domain setups). It looks like:

```
Deployed solvapay-mcp-petstore triggers (1.2 sec)
  https://petstore-mcp.<account>.workers.dev
```

## Step 2 — custom domain only (optional)

Skip this step on a default `*.workers.dev` deploy — `deploy.mjs` auto-resolves `MCP_PUBLIC_BASE_URL` before the first deploy (see step 1).

When you'd rather serve the worker on a stable hostname (e.g. `mcp.your-company.com`) than a `*.workers.dev` URL:

### Prerequisites

- The hostname's apex domain (`your-company.com`) is an active Cloudflare zone on the **same account** as the worker. Custom domain routes can't cross accounts. Check at `https://dash.cloudflare.com/<account>/<zone>/dns` — the zone must be "Active", not "Pending nameservers".
- No conflicting DNS record exists for the hostname. Wrangler will create the proxied CNAME itself; a pre-existing A / AAAA / CNAME on `mcp.your-company.com` makes the deploy fail.

### Bind the route in `wrangler.jsonc`

```jsonc
{
  "name": "__WORKER_NAME__",
  "main": "src/worker.ts",
  // ... existing config ...
  "routes": [
    { "pattern": "mcp.your-company.com", "custom_domain": true }
  ]
}
```

`custom_domain: true` is the modern shape — wrangler provisions the DNS record and the Cloudflare-managed cert. Multi-environment variants (`[env.production]` with its own `routes` block) live in [examples/cloudflare-workers-mcp/wrangler.jsonc](../../../../solvapay-sdk/examples/cloudflare-workers-mcp/wrangler.jsonc); the generated worker keeps a single environment by design (see [Template's deploy script](#templates-deploy-script)).

### Set `MCP_PUBLIC_BASE_URL` explicitly

In `.env`:

```
MCP_PUBLIC_BASE_URL=https://mcp.your-company.com
```

`deploy.mjs` detects the `custom_domain` route and skips workers.dev auto-resolution, so whatever you put in `.env` is what gets advertised as the OAuth `resource`. Setting this before the first deploy is what keeps OAuth metadata correct from the start — no second deploy.

### Deploy

```bash
npm run deploy
```

The first deploy provisions the cert; expect ~30s–3min before the worker is reachable on the hostname. Subsequent deploys are instant. Re-run `node scripts/verify.mjs https://mcp.your-company.com` after the cert lands.

## Step 3 — go-live (after sandbox testing)

When the user has verified the sandbox worker behaves correctly:

1. Generate a live key (`sk_live_…`) in the SolvaPay Console under **API Keys**.
2. Replace `SOLVAPAY_SECRET_KEY=sk_test_…` with `SOLVAPAY_SECRET_KEY=sk_live_…` in `.env`.
3. Re-run:

   ```bash
   wrangler secret put SOLVAPAY_SECRET_KEY
   npm run deploy
   ```

No separate `--env production`, no `.env.prod`. The same worker just serves live traffic now.

## Template's deploy script

The skill's `template/scripts/deploy.mjs` is a single-environment variant of [examples/cloudflare-workers-mcp/scripts/deploy.mjs](../../../../solvapay-sdk/examples/cloudflare-workers-mcp/scripts/deploy.mjs):

- Reads `.env` only (no `.env.prod` branch).
- Pre-flights `wrangler login` and workers.dev subdomain registration before deploy.
- Auto-resolves `MCP_PUBLIC_BASE_URL` from the Cloudflare API when `.env` still holds the localhost placeholder (skipped for custom-domain routes or an already-set URL).
- Passes `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`, `SOLVAPAY_API_BASE_URL` as `--var` overrides.
- Uploads `UPSTREAM_API_KEY` from `.env` when present and not already on the worker (idempotent via `wrangler secret list`).
- Shells out via `npx wrangler` so npm, pnpm, and yarn all work with the same command (`npm run deploy` / `pnpm deploy` / `yarn deploy`).
- Forwards extra args to `wrangler deploy` (e.g. `npm run deploy -- --dry-run`).

Keeping a single environment is intentional — the multi-env path in the source example exists for SolvaPay's own goldberg-demo and creates exactly the split-state the generated worker doesn't need.

## Hand-off

When the worker is live with the correct `MCP_PUBLIC_BASE_URL`, move to [verify.md](verify.md) and then [test.md](test.md).

## Reference

- [examples/cloudflare-workers-mcp/README.md](../../../../solvapay-sdk/examples/cloudflare-workers-mcp/README.md) — the full deploy walkthrough this module mirrors.
