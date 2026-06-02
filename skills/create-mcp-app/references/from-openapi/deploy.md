# deploy — push to Cloudflare Workers

Orchestration prose, no script. First deploy uploads missing Worker secrets from `.env`; later secret changes require explicit `npx wrangler secret put <NAME>` before redeploy. One worker, one environment, one secret slot.

## When to read this

- You ran [scaffold.md](scaffold.md) and [../solvapay-init.md](../solvapay-init.md). `.env` has `SOLVAPAY_SECRET_KEY`, `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`, and any upstream secrets scaffold wrote (`UPSTREAM_API_KEY`, `UPSTREAM_API_HEADERS`, or `UPSTREAM_OAUTH_*`).
- You've tested in sandbox and want to swap in `sk_live_…`.

## Prerequisites

- `wrangler login` succeeded once for this account. If not, `npm run deploy` exits early with `npx wrangler login` instructions.
- On a **fresh Cloudflare account**, register a workers.dev subdomain once before the first deploy. `scripts/deploy.mjs` pre-flights this and prints `https://dash.cloudflare.com/<account>/workers/onboarding` instead of letting `wrangler deploy` fail with a buried link.
- `.env` is populated. Run [../solvapay-init.md](../solvapay-init.md) first if it isn't.
- The resolved `SOLVAPAY_PRODUCT_REF` has been confirmed as the intended product for this MCP. If the MCP is usage-based or metered, the selected product has the intended usage-based plan (scaffold validates `plans[]` but does not create plans).
- Dependencies are installed. `npx -y solvapay@latest init` already ran `npm install` (or the detected package manager equivalent) — no need to re-run unless `package.json` changed.

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
- Uploads `UPSTREAM_API_HEADERS` from `.env` automatically when scaffold wrote it (i.e. when `selections.json.upstreamAuth.kind` was `apiKey-multi`). Skipped when absent or already on the worker.
- Uploads the `UPSTREAM_OAUTH_*` secrets from `.env` automatically when scaffold wrote them (i.e. when `selections.json.upstreamAuth.kind` was `oauth2-client-credentials`). Required: `UPSTREAM_OAUTH_TOKEN_URL`, `UPSTREAM_OAUTH_CLIENT_ID`, `UPSTREAM_OAUTH_CLIENT_SECRET`. Optional, uploaded only when present: `UPSTREAM_OAUTH_SCOPE`, `UPSTREAM_OAUTH_AUDIENCE`. The deploy aborts if `.env` carries only some of the three required keys.

All secrets go through `npx wrangler secret put` under the hood — never `--var`.

Existing Worker secrets are **not** refreshed just because `.env` changed. First deploy auto-uploads missing secrets; rotation and corrections are explicit. If you edit `.env` after a secret already exists on the worker, refresh it manually before redeploying:

```bash
npx wrangler secret put SOLVAPAY_SECRET_KEY
npx wrangler secret put UPSTREAM_API_KEY
npx wrangler secret put UPSTREAM_API_HEADERS
npx wrangler secret put UPSTREAM_OAUTH_TOKEN_URL
npx wrangler secret put UPSTREAM_OAUTH_CLIENT_ID
npx wrangler secret put UPSTREAM_OAUTH_CLIENT_SECRET
npx wrangler secret put UPSTREAM_OAUTH_SCOPE
npx wrangler secret put UPSTREAM_OAUTH_AUDIENCE
npm run deploy
```

Only run the commands for keys that exist in your `.env`. A future template CLI should grow a safer shortcut such as `npm run deploy -- --sync-secrets` or `npm run deploy -- --refresh-secret UPSTREAM_API_HEADERS`; until then, use `wrangler secret put` explicitly.

When `.env` carries `SOLVAPAY_API_BASE_URL` (either seeded by preview tooling with `--dev` or set manually), `deploy.mjs` forwards it as a `--var` override and the preflight `GET /v1/sdk/merchant` hits the same origin. No extra step — one knob, one source of truth.

Before invoking `wrangler deploy`, the script prints the resolved workers.dev URL and asks `[Y/n]`. Press Enter to accept. Decline (`n`) to abort and follow the printed instructions — either rename the account-wide workers.dev subdomain in the Cloudflare dashboard (affects every Worker on the account), or attach a `custom_domain` route (see Step 2). Pass `--yes` (or set `SOLVAPAY_DEPLOY_YES=1`) to skip the prompt; it's also skipped automatically when `wrangler.jsonc` has a `custom_domain` route or stdin is not a TTY.

### Gate G8 — deploy confirm

This `[Y/n]` prompt **is** G8 in the gate reference (see [../hitl-conventions.md](../hitl-conventions.md)).

```
GateId: G8
Prompt: Deploy to <resolved-workers-dev-url>?
Options:
  - deploy: Deploy — push to Cloudflare
  - cancel: Cancel — rename the workers.dev subdomain or attach a custom_domain first
```

| Confirmation level | G8 behavior                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `standard`         | Run `npm run deploy` without `--yes` — the script's interactive prompt is the gate.                                       |
| `chatty`           | Same as `standard`.                                                                                                       |
| `auto`             | Pass `--yes` (`npm run deploy -- --yes`) or export `SOLVAPAY_DEPLOY_YES=1`. The script still prints the resolved URL.     |

Auto skips the prompt but does **not** skip the deploy — there is no "auto-cancel deploy" path. If the user wants to skip deploy entirely, don't invoke `npm run deploy` in the first place.

On a default `*.workers.dev` deploy, **one** `npm run deploy` is enough — you do not need a second deploy to pin `MCP_PUBLIC_BASE_URL`.

Note the deployed URL in the wrangler output (for custom-domain setups). It looks like:

```
Deployed solvapay-mcp-petstore triggers (1.2 sec)
  https://petstore-mcp.<account>.workers.dev
```

## Step 1a — verify merchant bootstrap

`scripts/deploy.mjs` calls `GET /v1/sdk/merchant` before `wrangler deploy` runs, so if the secret key in `.env` has no merchant on the SolvaPay backend the deploy aborts with a recovery message instead of silently uploading a doomed secret. **This is the agent-runnable check** — it hits SolvaPay directly with the raw `SOLVAPAY_SECRET_KEY`, no OAuth, no browser. If the preflight passes and `wrangler deploy` succeeds, the deploy is bootstrapped correctly.

The optional follow-up below proves the **deployed** worker (not just the local key) can reach its merchant under bearer auth. It requires a human at a browser — autonomous agents should skip this and rely on the preflight.

> **Requires a human at a browser.** `mcpjam oauth login` defaults to `--auth-mode interactive`, which opens a system browser and blocks until you click "Approve" on the SolvaPay consent screen. SolvaPay workers only advertise the `authorization_code` grant type, so `--auth-mode client_credentials` is not viable and the headless flow still needs a human approval click. If you're running this step inside an autonomous agent, stop here.

Install the [MCPJam CLI](https://www.npmjs.com/package/@mcpjam/cli) once per machine:

```bash
npm i -g @mcpjam/cli
# or, no global install: prefix every call with `npx -y @mcpjam/cli@latest`
```

Then mint a token and re-run `verify.mjs`:

```bash
# 1. Mint a bearer token for the deployed worker (one-time per session).
#    Opens a browser; click "Approve". The worker mounts MCP at /mcp by
#    default, so pass <deployed-url>/mcp.
mcpjam oauth login --url <deployed-url>/mcp --credentials-out /tmp/creds.json

# 2. Run verify.mjs with the credentials so the merchantBootstrap check
#    actually exercises the SolvaPay layer. verify.mjs takes the worker
#    root and appends /mcp itself.
node scripts/verify.mjs <deployed-url> --credentials-file /tmp/creds.json
```

`merchantBootstrap` is the only check that hits the worker's SolvaPay layer with a real bearer token — `passed` means the deployed worker can reach its merchant; `failed` with `Provider not found` text means the secret key on the worker has no matching merchant (re-run `npx -y solvapay@latest init` and redeploy). `failed` with `401` or `Bearer realm` text usually means the token expired — re-run the `mcpjam oauth login` command to refresh `/tmp/creds.json` (the file stores `accessToken` only; `verify.mjs` doesn't auto-refresh).

Without `--credentials-file`, `verify.mjs` still runs every other check and reports `merchantBootstrap: { status: 'skipped' }`; if the catalog cannot be enumerated without bearer auth, `paywallGate` can skip too. That is not proof that the paid path or merchant bootstrap works. Record skipped paid-path checks in the handoff. You can also fall back to the raw MCPJam path if your scripts directory is not up to date:

```bash
mcpjam tools call \
  --url <deployed-url>/mcp \
  --tool-name manage_account \
  --credentials-file /tmp/creds.json \
  --quiet --format json
```

`mcpjam tools call` returns the full envelope — assert `isError: false` and that `content[0].text` does not contain `Provider not found`.

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

`custom_domain: true` is the modern shape — wrangler provisions the DNS record and the Cloudflare-managed cert. Multi-environment variants (`[env.production]` with its own `routes` block) live in [examples/cloudflare-workers-mcp/wrangler.jsonc](https://github.com/solvapay/solvapay-sdk/blob/main/examples/cloudflare-workers-mcp/wrangler.jsonc); the generated worker keeps a single environment by design (see [Template's deploy script](#templates-deploy-script)).

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

### Gate G9 — go-live key swap (always fires, overrides `auto`)

This is the single point where the worker switches from sandbox (`sk_test_…`) to production (`sk_live_…`). Even at `auto` confirmation level, G9 **always** fires — `auto` does not collapse this gate. Real money starts moving on the next deploy.

```
GateId: G9
Prompt: Swap SOLVAPAY_SECRET_KEY from sk_test_... to sk_live_... and redeploy? Real charges will start on the next paid tool call.
Options:
  - goLive: Go live — upload the live key as a Worker secret and redeploy
  - stay:   Stay on sandbox — keep sk_test_... for now
```

On `G9:stay`, do nothing — the worker keeps serving with the sandbox key. On `G9:goLive`, proceed:

1. Generate a live key (`sk_live_…`) in the SolvaPay Console under **API Keys**.
2. Replace `SOLVAPAY_SECRET_KEY=sk_test_…` with `SOLVAPAY_SECRET_KEY=sk_live_…` in `.env`.
3. The first-deploy auto-upload only runs when no `SOLVAPAY_SECRET_KEY` is present on the worker. Since one is already there, push the new value explicitly, then redeploy:

   ```bash
   npx wrangler secret put SOLVAPAY_SECRET_KEY
   npm run deploy
   ```

No separate `--env production`, no `.env.prod`. The same worker just serves live traffic now.

(The redeploy in step 3 also goes through G8; at `auto` you can still pass `--yes` because G8 is independently configurable per level. G9 is the only "live money" decision and never collapses.)

## Template's deploy script

The template ships a single-environment `scripts/deploy.mjs` that pre-flights `wrangler login` + workers.dev subdomain registration, auto-resolves `MCP_PUBLIC_BASE_URL` from the Cloudflare API on first deploy, and uploads missing secrets from `.env` on the first deploy (`SOLVAPAY_SECRET_KEY`, `UPSTREAM_API_KEY`, `UPSTREAM_API_HEADERS`, or `UPSTREAM_OAUTH_*` depending on auth shape). Shells out via `npx wrangler` (npm / pnpm / yarn all work) and forwards extra args to `wrangler deploy`. See the script header for full details. Multi-env variants live in [examples/cloudflare-workers-mcp/scripts/deploy.mjs](https://github.com/solvapay/solvapay-sdk/blob/main/examples/cloudflare-workers-mcp/scripts/deploy.mjs).

## Hand-off

When the worker is live with the correct `MCP_PUBLIC_BASE_URL`, move to [verify.md](verify.md) and then [test.md](test.md).

## Reference

- [examples/cloudflare-workers-mcp/README.md](https://github.com/solvapay/solvapay-sdk/blob/main/examples/cloudflare-workers-mcp/README.md) — the full deploy walkthrough this module mirrors.
