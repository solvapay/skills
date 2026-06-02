# Cloudflare Workers Deploy (Default, Bulletproof)

End-to-end deploy of a SolvaPay MCP server on Cloudflare Workers — prerequisites through gate smoke test, with troubleshooting. Self-contained: no repo cloning. The file bodies you copy during Step 2 live in two template files (split for length only):

- [widget-templates-config.md](widget-templates-config.md) — `package.json`, `tsconfig.json`, `wrangler.jsonc`, `vite.config.ts`, `mcp-app.html`, `src/assets.d.ts`, `src/worker.ts`.
- [widget-templates-widget-and-scripts.md](widget-templates-widget-and-scripts.md) — `src/mcp-app.tsx`, `scripts/deploy.mjs`, `scripts/dev.mjs`, `.env.example`, `.gitignore`.

Guardrails (secrets, `json-stateless`, `resourceUri`, no custom gate UI) are in the create-mcp-app SKILL.md and apply throughout.

## Existing project? (deploy-existing fast path)

If the project already has `src/worker.ts` calling `createSolvaPayMcpFetch` or `createSolvaPayMcpServer`, this is a **deploy-existing** task — not a greenfield scaffold:

- Run `npx wrangler whoami` first (confirms auth + prints your `*.workers.dev` subdomain), then jump to Step 8.
- Add only deploy scaffolding: `scripts/deploy.mjs`, `wrangler.jsonc` `[vars]`, `.env`.
- **Leave `src/worker.ts` byte-for-byte unchanged** — do not write `src/tools/*` or widget files from the templates.

## Step 1 — Prerequisites

- Node.js 20+.
- `pnpm` 9.6+ (examples use pnpm; `npm` and `yarn` also work with the same scripts).
- Cloudflare account with `wrangler` authenticated: `npx wrangler login`.
- SolvaPay secret key (`sk_...`) and product ref (`prd_...`) available.
- If the product is usage-based or metered, the intended plan exists on that product. Scaffold docs can describe plans, but the plan must be created or verified in SolvaPay before handoff.
- If using a custom domain, a Cloudflare zone you control.

**Pre-flight check:** run `wrangler whoami` before anything else. It confirms you are logged in and prints your account name and the `*.workers.dev` subdomain your Workers will be published under. That subdomain becomes your `MCP_PUBLIC_BASE_URL` when you don't have a custom domain (e.g. `https://petstore-mcp.<subdomain>.workers.dev`).

## Step 2 — Scaffold

**Existing project?** Skip any file that already exists. **Never edit an existing `src/worker.ts` on deploy tasks** — deploy scaffolding only. For deploy-only tasks on an existing worker, jump to Step 8 and add only `scripts/deploy.mjs` + `wrangler.jsonc` vars.

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

Edit `.env` with real values for `SOLVAPAY_SECRET_KEY`, `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`. Keep `SOLVAPAY_API_BASE_URL` blank unless you're pointing at a non-production API origin (skill authors / internal testing: use preview tooling and pass `--dev` to `npm create solvapay@preview` or `npx -y solvapay@preview init` to set this to `https://api-dev.solvapay.com` automatically).

`npm run deploy` (Step 8) uploads `SOLVAPAY_SECRET_KEY` from `.env` to Cloudflare Worker Secrets automatically on the first deploy. The local `.env` keeps the secret available to `wrangler dev`; the deployed Worker reads it from Cloudflare's secret store after that.

If you later edit a secret in `.env`, refresh the Worker secret explicitly before redeploying:

```bash
npx wrangler secret put SOLVAPAY_SECRET_KEY
pnpm run deploy
```

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

## Step 8 — Deploy

Pre-flight (deploy-existing especially): `npx wrangler whoami` confirms auth and prints your `*.workers.dev` subdomain. On deploy-existing tasks, do **not** edit `src/worker.ts` — add scaffolding only.

```bash
pnpm run deploy
```

This runs `scripts/deploy.mjs`, which sources your local `.env` and forwards `SOLVAPAY_PRODUCT_REF` / `MCP_PUBLIC_BASE_URL` / `SOLVAPAY_API_BASE_URL` as `--var` overrides to `wrangler deploy`. `SOLVAPAY_SECRET_KEY` is deliberately **not** re-uploaded on every deploy — it lives in the Cloudflare secret store from Step 5. Use `npx wrangler secret put SOLVAPAY_SECRET_KEY` when rotating or correcting the key.

Verify:

```bash
curl https://<your-host>/.well-known/oauth-authorization-server
```

## Step 9 — Gate smoke test

In the SolvaPay sandbox, exhaust a test customer's balance by calling one of your paid tools repeatedly until gated. Confirm the gated response shape:

- `content[0].text` is a plain-text `Purchase required` narration naming the correct recovery tool (`upgrade` / `topup` / `activate_plan`).
- `structuredContent` carries a `gate` payload with `checkoutUrl`.
- **No iframe mounts** on the gate.

Then invoke the named recovery tool (e.g. `upgrade`) from the MCP client and confirm the widget mounts. This verifies the non-intrusive gate contract end-to-end.

## Troubleshooting

### `SOLVAPAY_SECRET_KEY is not set` at runtime

`.env` was missing or the value wasn't picked up at deploy time. `npm run deploy` reads `.env` and uploads the secret on the first deploy; verify `.env` has a real `sk_test_…` / `sk_live_…` value. If the Worker already has an older secret, run `npx wrangler secret put SOLVAPAY_SECRET_KEY`, then redeploy.

### OAuth discovery returns the placeholder `MCP_PUBLIC_BASE_URL`

Your `.env` wasn't sourced. Check that `.env` exists in the project root and that `scripts/deploy.mjs` printed no "not found" warning.

### Worker bundle size over 1MB on deploy

Cloudflare's free tier caps bundles at 1MB post-gzip. `@solvapay/mcp` + `@solvapay/server` + `@modelcontextprotocol/sdk` sit close to this ceiling. Upgrade to the paid tier (10MB cap) if you need more headroom.

### `Already connected to a transport` errors under load

You removed `mode: 'json-stateless'`. Put it back; Workers isolates don't pin sessions across requests.

### Tool calls succeed locally but fail from a browser MCP client

(ChatGPT Custom Connectors, Inspector web UI.) The browser-origin CORS helpers in `worker.ts` are what make this work. Don't remove `applyBrowserCors` or `browserCorsPreflight` — see [widget-templates-config.md](widget-templates-config.md#srcworkerts).

### Widget flashes empty on every silent tool success

You set `_meta.ui.resourceUri` on a merchant payable tool. Remove it; `resourceUri` belongs only on the three SolvaPay intent tools, which `createSolvaPayMcpFetch` registers for you.

### Gate returns a structured UI payload instead of text

You hand-rolled a paywall response or wrapped a virtual tool with `payable.mcp()`. Use `registerPayable` and let it emit the text-only narration.

### Widget doesn't mount when I call `upgrade`

Verify the MCP host supports iframe resources (Claude Desktop, ChatGPT Apps, MCP Inspector do; pure terminal clients don't). On unsupported hosts the intent tool returns the bootstrap payload in `structuredContent` for programmatic use.
