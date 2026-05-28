# Cloudflare Workers — Setup (Steps 1-7)

Prerequisites through local dev. Templates: [widget-templates-config.md](widget-templates-config.md) and [widget-templates-widget-and-scripts.md](widget-templates-widget-and-scripts.md). Deploy and verify steps live in [deploy-verify.md](deploy-verify.md).

## Step 1 — Prerequisites

- Node.js 20+.
- `pnpm` 9.6+ (examples use pnpm; `npm` and `yarn` also work with the same scripts).
- Cloudflare account with `wrangler` authenticated: `npx wrangler login`.
- SolvaPay secret key (`sk_...`) and product ref (`prd_...`) available.
- If using a custom domain, a Cloudflare zone you control.

## Step 2 — Scaffold

Create the project directory and write each file from [widget-templates-config.md](widget-templates-config.md) and [widget-templates-widget-and-scripts.md](widget-templates-widget-and-scripts.md):

```
my-mcp/
├── package.json
├── tsconfig.json
├── wrangler.jsonc
├── vite.config.ts
├── mcp-app.html
├── .env.example
├── .gitignore
├── scripts/
│   ├── deploy.mjs
│   └── dev.mjs
└── src/
    ├── assets.d.ts
    ├── worker.ts
    └── mcp-app.tsx
```

The dep versions in `package.json` are known-good at the time of writing. After scaffolding, run `pnpm outdated` (or `npm outdated`) and bump what needs bumping; SolvaPay packages follow semver.

## Step 3 — Install

```bash
pnpm install
```

## Step 4 — Configure

Edit in place:

- **`package.json`** — set `"name"` to your project slug.
- **`wrangler.jsonc`** — set `"name"` to your Worker slug (shows up in the `*.workers.dev` URL and must be URL-safe). Either set `routes[0].pattern` to your custom domain, or delete the entire `routes` block to serve on the default `*.workers.dev` URL.
- **`src/worker.ts`** — update the `resourceUri` string to `ui://<your-worker-slug>/mcp-app.html` (match the `name` in `wrangler.jsonc`).

## Step 5 — Env + secret

```bash
cp .env.example .env
```

Edit `.env` with real values for `SOLVAPAY_SECRET_KEY`, `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`. Keep `SOLVAPAY_API_BASE_URL` blank unless you're pointing at a non-production API origin (skill authors / internal testing: pass `--dev` to `npm create solvapay@latest` or `npx -y solvapay@latest init` to set this to `https://api-dev.solvapay.com` automatically).

`npm run deploy` (Step 8 in [deploy-verify.md](deploy-verify.md)) uploads `SOLVAPAY_SECRET_KEY` from `.env` to Cloudflare Worker Secrets automatically on the first deploy. The local `.env` keeps the secret available to `wrangler dev`; the deployed Worker reads it from Cloudflare's secret store after that.

## Step 6 — Build the widget

```bash
pnpm build
```

This runs Vite to bundle `src/mcp-app.tsx` into a single-file `dist/mcp-app.html`, then copies it to `src/assets/mcp-app.html`. Wrangler's Text module rule (covers `.html` by default) inlines that file into the Worker bundle via the `import mcpAppHtml from './assets/mcp-app.html'` line in `worker.ts`.

## Step 7 — Local dev

```bash
pnpm dev
```

This runs `vite build --watch` (rebuilds the widget on edits and mirrors it into `src/assets/`) and `wrangler dev` (Worker on `http://localhost:8787`) in parallel under one process. Ctrl+C tears both down.

Use `pnpm dev:widget` for the widget watcher only, or `pnpm serve:local` for the Worker only.

Verify with an MCP client:

```bash
# Reference MCP client
npx @modelcontextprotocol/inspector

# Then connect to http://localhost:8787/ in the inspector UI
```

Quick sanity curls:

```bash
curl http://localhost:8787/.well-known/oauth-protected-resource
curl http://localhost:8787/.well-known/oauth-authorization-server
```

Both should return JSON with your `MCP_PUBLIC_BASE_URL` in the `resource` / `issuer` fields.

## Next

Continue to [deploy-verify.md](deploy-verify.md) for Step 8 (deploy) and Step 9 (gate smoke test). When something breaks, see [troubleshooting.md](troubleshooting.md).
