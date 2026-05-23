# Cloudflare Workers Deploy (Default, Bulletproof)

Step-by-step deploy of a SolvaPay MCP server on Cloudflare Workers, with every file inline. Self-contained — no external templates, no repo cloning.

## Contents

- Guardrails
- Steps
  - 1. Prerequisites
  - 2. Scaffold
  - 3. Install
  - 4. Configure
  - 5. Env + secret
  - 6. Build the widget
  - 7. Local dev
  - 8. Deploy
  - 9. Gate smoke test
- Templates
  - `package.json`
  - `tsconfig.json`
  - `wrangler.jsonc`
  - `vite.config.ts`
  - `mcp-app.html`
  - `src/assets.d.ts`
  - `src/worker.ts`
  - `src/mcp-app.tsx`
  - `scripts/deploy.mjs`
  - `.env.example`
  - `.gitignore`
- Troubleshooting

## Guardrails

- Never commit `.env`. Only `.env.example` is tracked. The gitignore template below enforces this.
- Never put `SOLVAPAY_SECRET_KEY` in `wrangler.jsonc` `vars` or in a `--var` flag. Upload it once via `wrangler secret put SOLVAPAY_SECRET_KEY`; it persists across deploys.
- Never remove `mode: 'json-stateless'` from the `createSolvaPayMcpFetch` call. Workers isolates don't pin across requests — stateful MCP sessions break.
- Never set `_meta.ui.resourceUri` on merchant payable tools. `registerPayable` enforces this, but if you drop down to `registerPayableTool`, don't pass a `resourceUri`.
- Always keep `hideToolsByAudience: ['ui']` unless you have a specific reason not to.

## Steps

### 1. Prerequisites

- Node.js 20+.
- `pnpm` 9.6+ (examples use pnpm; `npm` and `yarn` also work with the same scripts).
- Cloudflare account with `wrangler` authenticated: `npx wrangler login`.
- SolvaPay secret key (`sk_...`) and product ref (`prd_...`) available.
- If using a custom domain, a Cloudflare zone you control.

### 2. Scaffold

Create the project directory and write each file from the **Templates** section below:

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
│   └── deploy.mjs
└── src/
    ├── assets.d.ts
    ├── worker.ts
    └── mcp-app.tsx
```

The dep versions in `package.json` are known-good at the time of writing. After scaffolding, run `pnpm outdated` (or `npm outdated`) and bump what needs bumping; SolvaPay packages follow semver.

### 3. Install

```bash
pnpm install
```

### 4. Configure

Edit in place:

- **`package.json`** — set `"name"` to your project slug.
- **`wrangler.jsonc`** — set `"name"` to your Worker slug (shows up in the `*.workers.dev` URL and must be URL-safe). Either set `routes[0].pattern` to your custom domain, or delete the entire `routes` block to serve on the default `*.workers.dev` URL.
- **`src/worker.ts`** — update the `resourceUri` string to `ui://<your-worker-slug>/mcp-app.html` (match the `name` in `wrangler.jsonc`).

### 5. Env + secret

```bash
cp .env.example .env
```

Edit `.env` with real values for `SOLVAPAY_SECRET_KEY`, `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL`. Keep `SOLVAPAY_API_BASE_URL` blank unless you're pointing at a non-production API origin.

Upload the secret to Cloudflare once (persists across deploys):

```bash
pnpm exec wrangler secret put SOLVAPAY_SECRET_KEY
```

Paste the `sk_...` value when prompted. The `.env` keeps the secret available to `wrangler dev` for local testing; the production Worker reads it from Cloudflare's secret store.

### 6. Build the widget

```bash
pnpm build
```

This runs Vite to bundle `src/mcp-app.tsx` into a single-file `dist/mcp-app.html`, then copies it to `src/assets/mcp-app.html`. Wrangler's Text module rule (covers `.html` by default) inlines that file into the Worker bundle via the `import mcpAppHtml from './assets/mcp-app.html'` line in `worker.ts`.

### 7. Local dev

```bash
pnpm serve:local
```

This runs `wrangler dev` on `http://localhost:8787`. Verify with an MCP client:

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

### 8. Deploy

```bash
pnpm run deploy
```

This runs `scripts/deploy.mjs`, which sources your local `.env` and forwards `SOLVAPAY_PRODUCT_REF` / `MCP_PUBLIC_BASE_URL` / `SOLVAPAY_API_BASE_URL` as `--var` overrides to `wrangler deploy`. `SOLVAPAY_SECRET_KEY` is deliberately **not** re-uploaded — it lives in the Cloudflare secret store from Step 5.

Verify:

```bash
curl https://<your-host>/.well-known/oauth-authorization-server
```

### 9. Gate smoke test

In the SolvaPay sandbox, exhaust a test customer's balance by calling one of your paid tools repeatedly until gated. Confirm the gated response shape:

- `content[0].text` is a plain-text `Purchase required` narration naming the correct recovery tool (`upgrade` / `topup` / `activate_plan`).
- `structuredContent` carries a `gate` payload with `checkoutUrl`.
- **No iframe mounts** on the gate.

Then invoke the named recovery tool (e.g. `upgrade`) from the MCP client and confirm the widget mounts. This verifies the non-intrusive gate contract end-to-end.

## Templates

Copy each of the following into a file with the matching path. All paths are relative to the project root created in Step 2.

### `package.json`

```json
{
  "name": "your-mcp-server-name",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "cross-env INPUT=mcp-app.html vite build && cp dist/mcp-app.html src/assets/mcp-app.html",
    "dev": "cross-env INPUT=mcp-app.html vite build --watch",
    "predeploy": "pnpm build",
    "deploy": "node scripts/deploy.mjs",
    "serve:local": "wrangler dev"
  },
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "^1.5.0",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "@solvapay/mcp": "^1.0.0",
    "@solvapay/react": "^1.0.0",
    "@solvapay/server": "^1.0.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20251124.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "cross-env": "^10.1.0",
    "typescript": "^5.9.2",
    "vite": "^8.0.6",
    "vite-plugin-singlefile": "^2.3.2",
    "wrangler": "^4.47.0"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "isolatedModules": true
  },
  "include": ["src/worker.ts", "src/assets.d.ts", "vite.config.ts"],
  "exclude": ["dist", ".wrangler", "src/assets", "src/mcp-app.tsx"]
}
```

The widget source (`src/mcp-app.tsx`) is transpiled by Vite during the iframe build and is intentionally excluded from Worker typechecking.

### `wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "your-worker-slug",
  "main": "src/worker.ts",
  "compatibility_date": "2026-04-26",
  "compatibility_flags": ["nodejs_compat"],
  // Optional: bind a custom domain. Replace with your zone, or delete
  // the entire `routes` block to serve on the default
  // `<worker-slug>.<subdomain>.workers.dev` URL.
  "routes": [
    {
      "pattern": "mcp.your-domain.com",
      "custom_domain": true
    }
  ],
  "vars": {
    // Your SolvaPay product ref. `scripts/deploy.mjs` overrides this
    // at deploy time from `.env` so the committed value can stay as a
    // placeholder.
    "SOLVAPAY_PRODUCT_REF": "prd_your_product_ref",
    // Canonical public URL this Worker answers at. OAuth `issuer`
    // reflects this. Override at deploy time from `.env`.
    "MCP_PUBLIC_BASE_URL": "https://your-worker.example.com"
    // `SOLVAPAY_API_BASE_URL` is intentionally not committed here —
    // src/worker.ts defaults to https://api.solvapay.com (production).
    // Set in `.env` if you need to point at a staging backend.
  },
  "observability": {
    "enabled": true
  }
}
```

### `vite.config.ts`

```ts
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import react from '@vitejs/plugin-react'

const input = process.env.INPUT
if (!input) {
  throw new Error('INPUT environment variable is not set')
}

// Zod v4 core probes `new Function('return true')` to detect eval
// support — harmless in Node, but a hard CSP violation in any
// browser / MCP iframe that forbids `unsafe-eval` (every SolvaPay
// iframe does). Replace the probe with an unconditional `return
// false` to keep the bundle CSP-clean.
function stripZodEvalCheck(): Plugin {
  return {
    name: 'strip-zod-eval-check',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/zod/') || !id.endsWith('/v4/core/util.js')) return null
      const nextCode = code.replace(/new F\(""\);\s*return true;/, 'return false;')
      if (nextCode === code) return null
      return { code: nextCode, map: null }
    },
  }
}

export default defineConfig({
  plugins: [stripZodEvalCheck(), react(), viteSingleFile()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  build: {
    rollupOptions: { input },
    outDir: 'dist',
    emptyOutDir: false,
  },
})
```

### `mcp-app.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SolvaPay checkout</title>
    <!--
      The MCP host chrome shows the merchant's mark next to the
      active tool name. `<McpApp>` upserts a `<link rel="icon"
      data-solvapay-favicon>` into `<head>` once the merchant
      bootstrap lands — hosts that read the iframe favicon pick up
      the same asset. The placeholder below prevents browser 404s
      during startup; the SDK replaces its `href` as soon as the
      bootstrap resolves.
    -->
    <link rel="icon" href="data:," data-solvapay-favicon />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/mcp-app.tsx"></script>
  </body>
</html>
```

### `src/assets.d.ts`

```ts
// Wrangler's built-in Text module rule turns `.html` imports into
// inlined string contents. This declaration gives TypeScript the
// matching type so `worker.ts` can pull in the built widget HTML
// without a red underline.
declare module '*.html' {
  const content: string
  export default content
}
```

### `src/worker.ts`

```ts
/**
 * SolvaPay MCP server — Cloudflare Workers entrypoint.
 *
 * Single call into `createSolvaPayMcpFetch` from `@solvapay/mcp/fetch`
 * gives us a paywalled MCP server over the Workers runtime with the
 * full `@modelcontextprotocol/sdk` wiring, `hideToolsByAudience` for
 * text-only hosts, and the stateless-JSON transport preset (correct
 * shape for Workers isolates, which don't pin across requests).
 *
 * The only extra plumbing on top of the SDK handler is browser-origin
 * CORS — native-scheme clients (Cursor / VS Code / Claude Desktop)
 * are handled by the SDK; we additionally mirror `Origin` back and
 * expose `WWW-Authenticate` + `Mcp-Session-Id` for browser MCP
 * clients (ChatGPT Custom Connectors, MCP Inspector web UI).
 */

import { createSolvaPay } from '@solvapay/server'
import { createSolvaPayMcpFetch } from '@solvapay/mcp/fetch'
import mcpAppHtml from './assets/mcp-app.html'

// import { registerMyTools } from './tools'

interface Env {
  SOLVAPAY_SECRET_KEY: string
  SOLVAPAY_PRODUCT_REF: string
  MCP_PUBLIC_BASE_URL: string
  SOLVAPAY_API_BASE_URL?: string
}

function requireEnv(env: Env, name: keyof Env): string {
  const value = env[name]
  if (!value) {
    throw new Error(
      `${name} is not set — check wrangler.jsonc \`vars\` block or run \`wrangler secret put ${name}\``,
    )
  }
  return value
}

function applyBrowserCors(req: Request, res: Response): Response {
  const origin = req.headers.get('origin')
  if (!origin) return res
  const headers = new Headers(res.headers)
  if (!headers.has('access-control-allow-origin')) {
    headers.set('Access-Control-Allow-Origin', origin)
    const vary = headers.get('vary')
    headers.set('Vary', vary ? `${vary}, Origin` : 'Origin')
  }
  const exposed = headers.get('access-control-expose-headers')
  if (!exposed || !/www-authenticate/i.test(exposed)) {
    headers.set(
      'Access-Control-Expose-Headers',
      exposed
        ? `${exposed}, WWW-Authenticate, Mcp-Session-Id`
        : 'WWW-Authenticate, Mcp-Session-Id',
    )
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

function browserCorsPreflight(req: Request): Response {
  const requestedMethod = req.headers.get('access-control-request-method') ?? 'POST'
  const requestedHeaders =
    req.headers.get('access-control-request-headers') ??
    'authorization, content-type, mcp-session-id, mcp-protocol-version'
  const headers = new Headers()
  headers.set('Access-Control-Allow-Methods', `${requestedMethod}, OPTIONS`)
  headers.set('Access-Control-Allow-Headers', requestedHeaders)
  headers.set('Access-Control-Max-Age', '600')
  return applyBrowserCors(req, new Response(null, { status: 204, headers }))
}

// Cache the handler at isolate scope so the `McpServer`, OAuth
// router, tool registrations, and internal caches only build once
// per Workers isolate (not once per request). Secret / var rotations
// trigger a new Worker version and a fresh isolate — so invalidation
// is free.
let cachedHandler: ((req: Request) => Promise<Response>) | undefined

function getHandler(env: Env): (req: Request) => Promise<Response> {
  if (cachedHandler) return cachedHandler

  const apiBaseUrl = env.SOLVAPAY_API_BASE_URL ?? 'https://api.solvapay.com'
  cachedHandler = createSolvaPayMcpFetch({
    solvaPay: createSolvaPay({
      apiKey: requireEnv(env, 'SOLVAPAY_SECRET_KEY'),
      apiBaseUrl,
    }),
    productRef: requireEnv(env, 'SOLVAPAY_PRODUCT_REF'),
    resourceUri: 'ui://your-worker-slug/mcp-app.html',
    readHtml: async () => mcpAppHtml,
    publicBaseUrl: requireEnv(env, 'MCP_PUBLIC_BASE_URL'),
    apiBaseUrl,
    mode: 'json-stateless',
    hideToolsByAudience: ['ui'],
    // Wire your paid tools here. See ../tool-design.md for the
    // `registerPayable` pattern. Create src/tools.ts with a
    // `registerMyTools(ctx)` function, import it at the top of this
    // file, then uncomment the line below.
    // additionalTools: registerMyTools,
  })
  return cachedHandler
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return browserCorsPreflight(req)
    const response = await getHandler(env)(req)
    return applyBrowserCors(req, response)
  },
} satisfies ExportedHandler<Env>
```

### `src/mcp-app.tsx`

```tsx
/**
 * MCP widget entry — bundled by Vite into a single-file
 * `dist/mcp-app.html`, then copied into `src/assets/mcp-app.html`
 * so Wrangler's Text module rule inlines it into the Worker
 * bundle (`import mcpAppHtml from './assets/mcp-app.html'` in
 * worker.ts).
 *
 * This widget renders only when the user deliberately invokes a
 * SolvaPay intent tool (`upgrade` / `topup` / `manage_account`).
 * Merchant payable tools do not mount an iframe — their gate
 * responses are text-only narrations.
 */

import { createRoot } from 'react-dom/client'
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps'
import { McpApp } from '@solvapay/react/mcp'
import '@solvapay/react/styles.css'
import '@solvapay/react/mcp/styles.css'

function applyContext(ctx: McpUiHostContext | undefined) {
  if (!ctx) return
  if (ctx.theme) applyDocumentTheme(ctx.theme)
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables)
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts)

  const root = document.getElementById('root')
  const insets = ctx.safeAreaInsets
  if (insets && root) {
    root.style.paddingTop = `${16 + insets.top}px`
    root.style.paddingRight = `${16 + insets.right}px`
    root.style.paddingBottom = `${16 + insets.bottom}px`
    root.style.paddingLeft = `${16 + insets.left}px`
  }
}

const app = new App({ name: 'SolvaPay checkout', version: '1.0.0' })

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('#root element missing from mcp-app.html')
}

createRoot(rootEl).render(<McpApp app={app} applyContext={applyContext} />)
```

### `scripts/deploy.mjs`

```js
#!/usr/bin/env node
/**
 * Deploy wrapper for the SolvaPay MCP Cloudflare Worker.
 *
 * `wrangler deploy` uploads the `vars` block from `wrangler.jsonc`
 * on every run. That file ships placeholder values so the config
 * can stay in git without leaking your real merchant / origin
 * settings. This script sources `.env` (gitignored) and passes the
 * overridable keys as `--var` flags to `wrangler deploy`.
 *
 * `SOLVAPAY_SECRET_KEY` is managed separately as a Worker secret
 * (`wrangler secret put SOLVAPAY_SECRET_KEY` — run once, persists
 * across deploys). It's listed in `.env` so `wrangler dev` can use
 * it for local testing; this script does NOT re-upload it on every
 * deploy.
 *
 * Pass-through: extra CLI args (e.g. `--dry-run`) are forwarded to
 * `wrangler deploy`.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const dotEnvPath = resolve(projectRoot, '.env')

const OVERRIDABLE_VARS = [
  'SOLVAPAY_PRODUCT_REF',
  'MCP_PUBLIC_BASE_URL',
  'SOLVAPAY_API_BASE_URL',
]

function parseDotEnv(contents) {
  const env = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i)
    if (!match) continue
    let [, key, value] = match
    value = value.trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    } else {
      const commentIdx = value.search(/\s+#/)
      if (commentIdx >= 0) value = value.slice(0, commentIdx).trim()
    }
    env[key] = value
  }
  return env
}

const localEnv = existsSync(dotEnvPath) ? parseDotEnv(readFileSync(dotEnvPath, 'utf8')) : {}

if (!existsSync(dotEnvPath)) {
  console.error(
    [
      '',
      `⚠  ${dotEnvPath} not found — deploying with placeholder vars from wrangler.jsonc.`,
      '   Copy .env.example to .env and fill in your SolvaPay values',
      '   to override the committed placeholders at deploy time.',
      '',
    ].join('\n'),
  )
}

const wranglerArgs = ['exec', 'wrangler', 'deploy']
for (const name of OVERRIDABLE_VARS) {
  const value = localEnv[name]
  if (value) wranglerArgs.push('--var', `${name}:${value}`)
}
wranglerArgs.push(...process.argv.slice(2))

const result = spawnSync('pnpm', wranglerArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
```

If you use `npm` or `yarn` instead of `pnpm`, replace `spawnSync('pnpm', ...)` with your package manager's CLI name.

### `.env.example`

```
# Local values for this Worker — used in two places:
#
#   1. `pnpm serve:local` / `wrangler dev` picks these up automatically
#      for local testing.
#   2. `pnpm deploy` (see scripts/deploy.mjs) sources this file and
#      passes SOLVAPAY_PRODUCT_REF / MCP_PUBLIC_BASE_URL /
#      SOLVAPAY_API_BASE_URL as `--var` overrides at deploy time.
#
# SOLVAPAY_SECRET_KEY is NOT re-uploaded on each deploy — it lives on
# the Worker as a proper secret via `wrangler secret put SOLVAPAY_SECRET_KEY`
# (run once; persists across deploys). Kept here so `wrangler dev`
# can read it for local testing.
#
# Copy this file to `.env` and fill in your real values. The copy is
# gitignored; keep secrets out of git.

# The SolvaPay secret key for your merchant account. Never commit.
# Dashboard -> API Keys -> secret key (sk_…).
SOLVAPAY_SECRET_KEY=sk_test_your_key_here

# Product ref the paywall gates on. Create one in the dashboard
# under Products and copy its `prd_…` ID.
SOLVAPAY_PRODUCT_REF=prd_your_product_ref

# Canonical public URL this Worker answers at. For `wrangler dev`,
# http://localhost:8787 is fine. For deployed runs, your custom
# domain (e.g. https://mcp.your-company.com).
MCP_PUBLIC_BASE_URL=http://localhost:8787

# SolvaPay API origin. Omit / leave blank to use production
# (https://api.solvapay.com — this is what src/worker.ts falls back
# to). Set explicitly if you need a different environment:
# SOLVAPAY_API_BASE_URL=https://api-staging.solvapay.com
```

### `.gitignore`

```
dist/
src/assets/mcp-app.html
node_modules/
.wrangler/
.env
.env.local
!.env.example
```

## Troubleshooting

- **`SOLVAPAY_SECRET_KEY is not set`** at runtime — you skipped `wrangler secret put SOLVAPAY_SECRET_KEY`. Run it once; it persists across deploys.
- **OAuth discovery returns the placeholder `MCP_PUBLIC_BASE_URL`** — your `.env` wasn't sourced. Check that `.env` exists in the project root and that `scripts/deploy.mjs` printed no "not found" warning.
- **Worker bundle size over 1MB** on deploy — Cloudflare's free tier caps bundles at 1MB post-gzip. `@solvapay/mcp` + `@solvapay/server` + `@modelcontextprotocol/sdk` sit close to this ceiling. Upgrade to the paid tier (10MB cap) if you need more headroom.
- **`Already connected to a transport` errors** under load — you removed `mode: 'json-stateless'`. Put it back; Workers isolates don't pin sessions across requests.
- **Tool calls succeed locally but fail from a browser MCP client (ChatGPT Custom Connectors, Inspector web UI)** — the browser-origin CORS helpers in `worker.ts` are what make this work. Don't remove `applyBrowserCors` or `browserCorsPreflight`.
- **Widget flashes empty on every silent tool success** — you set `_meta.ui.resourceUri` on a merchant payable tool. Remove it; `resourceUri` belongs only on the three SolvaPay intent tools, which `createSolvaPayMcpFetch` registers for you.
- **Gate returns a structured UI payload instead of text** — you hand-rolled a paywall response or wrapped a virtual tool with `payable.mcp()`. Use `registerPayable` and let it emit the text-only narration.
- **Widget doesn't mount when I call `upgrade`** — verify the MCP host supports iframe resources (Claude Desktop, ChatGPT Apps, MCP Inspector do; pure terminal clients don't). On unsupported hosts the intent tool returns the bootstrap payload in `structuredContent` for programmatic use.
- **Rotating `SOLVAPAY_SECRET_KEY`** — run `wrangler secret put SOLVAPAY_SECRET_KEY` with the new value and update `.env` for local dev. No deploy needed for the secret itself.
