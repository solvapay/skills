# deploy — push to Cloudflare Workers

Orchestration prose, no script. Whatever `SOLVAPAY_SECRET_KEY` is in `.env` is what gets uploaded as a Worker Secret. One worker, one environment, one secret slot.

## When to read this

- You ran [scaffold.md](scaffold.md) and [../solvapay-init.md](../solvapay-init.md). `.env` has `SOLVAPAY_SECRET_KEY`, `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`, and `UPSTREAM_API_KEY` (when applicable).
- You've tested in sandbox and want to swap in `sk_live_…`.

## Prerequisites

- `wrangler login` succeeded once for this account. If not, `npm run deploy` exits early with `npx wrangler login` instructions.
- On a **fresh Cloudflare account**, register a workers.dev subdomain once before the first deploy. `scripts/deploy.mjs` pre-flights this and prints `https://dash.cloudflare.com/<account>/workers/onboarding` instead of letting `wrangler deploy` fail with a buried link.
- `.env` is populated. Run [../solvapay-init.md](../solvapay-init.md) first if it isn't.
- Dependencies are installed. `npx solvapay init` already ran `npm install` (or the detected package manager equivalent) — no need to re-run unless `package.json` changed.

## Step 1 — deploy

Run from inside the scaffolded directory:

```bash
npm run deploy
```

`npm run deploy` runs the template's `scripts/deploy.mjs`. The script:

- Pre-flights Cloudflare auth (`wrangler whoami`) and workers.dev subdomain registration (Cloudflare API `GET /accounts/{id}/workers/subdomain`). Exits with actionable messages when logged out or the subdomain is not registered yet.
- Auto-resolves `MCP_PUBLIC_BASE_URL` when `.env` still holds the scaffold placeholder (`http://localhost:8787` or `__MCP_PUBLIC_BASE_URL__`): computes `https://<worker>.<subdomain>.workers.dev` from `wrangler.jsonc#name` + the account subdomain, writes it to `.env` before deploy, then verifies wrangler's output matches. Skipped when you already set a custom URL or `wrangler.jsonc` has a `custom_domain` route.
- Prompts to confirm the resolved workers.dev URL (skipped under `--yes`, non-TTY, dry-run, or when a custom domain is already configured). Declining exits with dashboard + custom-domain instructions.
- Reads `.env` and forwards `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`, and `SOLVAPAY_API_BASE_URL` as `--var` overrides to `wrangler deploy`.
- Uploads `SOLVAPAY_SECRET_KEY` from `.env` as a Worker secret on the first deploy. Skipped when already present on the worker.
- Uploads `UPSTREAM_API_KEY` from `.env` automatically when scaffold wrote it (i.e. when `selections.json.upstreamAuth.kind` was `bearer` or `apiKey`). Skipped when the key is absent from `.env` (`kind: "none"`) or already on the worker.

Both secrets go through `npx wrangler secret put` under the hood — never `--var`.

Before invoking `wrangler deploy`, the script prints the resolved workers.dev URL and asks `[Y/n]`. Press Enter to accept. Decline (`n`) to abort and follow the printed instructions — either rename the account-wide workers.dev subdomain in the Cloudflare dashboard (affects every Worker on the account), or attach a `custom_domain` route (see Step 2). Pass `--yes` (or set `SOLVAPAY_DEPLOY_YES=1`) to skip the prompt; it's also skipped automatically when `wrangler.jsonc` has a `custom_domain` route or stdin is not a TTY.

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
3. The first-deploy auto-upload only runs when no `SOLVAPAY_SECRET_KEY` is present on the worker. Since one is already there, push the new value explicitly, then redeploy:

   ```bash
   npx wrangler secret put SOLVAPAY_SECRET_KEY
   npm run deploy
   ```

No separate `--env production`, no `.env.prod`. The same worker just serves live traffic now.

## Template's deploy script

The template ships a single-environment `scripts/deploy.mjs` that pre-flights `wrangler login` + workers.dev subdomain registration, auto-resolves `MCP_PUBLIC_BASE_URL` from the Cloudflare API on first deploy, and uploads `SOLVAPAY_SECRET_KEY` and `UPSTREAM_API_KEY` from `.env` as Worker secrets on the first deploy. Shells out via `npx wrangler` (npm / pnpm / yarn all work) and forwards extra args to `wrangler deploy`. See the script header for full details. Multi-env variants live in [examples/cloudflare-workers-mcp/scripts/deploy.mjs](../../../../solvapay-sdk/examples/cloudflare-workers-mcp/scripts/deploy.mjs).

## Hand-off

When the worker is live with the correct `MCP_PUBLIC_BASE_URL`, move to [verify.md](verify.md) and then [test.md](test.md).

## Reference

- [examples/cloudflare-workers-mcp/README.md](../../../../solvapay-sdk/examples/cloudflare-workers-mcp/README.md) — the full deploy walkthrough this module mirrors.
