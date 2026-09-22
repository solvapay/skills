# Cloudflare Workers — Widget, scripts, and env templates

Continues from [widget-templates-config.md](widget-templates-config.md). Copy each block into the matching project path.

## Contents

- [`src/mcp-app.tsx`](#srcmcp-apptsx)
- [`scripts/deploy.mjs`](#scriptsdeploymjs)
- [`scripts/dev.mjs`](#scriptsdevmjs)
- [`.env.example`](#envexample)
- [`.gitignore`](#gitignore)

## `src/mcp-app.tsx`

```tsx
/**
 * MCP widget entry — bundled by Vite into a single-file
 * `dist/mcp-app.html`, then copied into `src/assets/mcp-app.html`
 * so Wrangler's Text module rule inlines it into the Worker
 * bundle (`import mcpAppHtml from './assets/mcp-app.html'` in
 * worker.ts).
 *
 * This widget renders only when the user deliberately invokes a
 * SolvaPay billing viewer (`account` with optional `view`).
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
import { McpApp, SOLVAPAY_MCP_APP_CAPABILITIES } from '@solvapay/react/mcp'
import '@solvapay/react/styles.css'
import '@solvapay/react/mcp/styles.css'

function applyContext(ctx: McpUiHostContext | undefined) {
  if (!ctx) return
  if (ctx.theme) applyDocumentTheme(ctx.theme)
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables)
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts)
}

// The second argument advertises which display modes this surface can
// handle (`inline` + `fullscreen`, never `pip`). The host owns the
// expand affordance — never call `app.requestDisplayMode`.
const app = new App(
  { name: 'SolvaPay checkout', version: '1.0.0' },
  { availableDisplayModes: [...SOLVAPAY_MCP_APP_CAPABILITIES.availableDisplayModes] },
)

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('#root element missing from mcp-app.html')
}

createRoot(rootEl).render(<McpApp app={app} applyContext={applyContext} />)
```

## `scripts/deploy.mjs`

Copy the scaffolder's deploy script. Do not paste a shorter one. It is the only deploy story: auth preflight before the widget build, workers.dev subdomain check, `npx wrangler deploy` (so `--var` is not swallowed the way `pnpm exec` / `npm exec` swallow it on npm 11), and `SOLVAPAY_SECRET_KEY` upload after the first successful deploy.

```bash
npm install create-solvapay
cp node_modules/create-solvapay/templates/mcp/_base/scripts/deploy.mjs scripts/deploy.mjs
```

The same file in the sdk repo is `packages/create-solvapay/templates/mcp/_base/scripts/deploy.mjs` ([solvapay-sdk](https://github.com/solvapay/solvapay-sdk/blob/main/packages/create-solvapay/templates/mcp/_base/scripts/deploy.mjs)).

On the first successful deploy the script uploads `SOLVAPAY_SECRET_KEY` from `.env` after the Worker exists. Later deploys skip that upload when the secret is already set. Rotate a key with `npx wrangler secret put SOLVAPAY_SECRET_KEY`, then redeploy.

## `scripts/dev.mjs`

```js
#!/usr/bin/env node
/**
 * `pnpm dev` — runs the widget watcher and `wrangler dev` together
 * under one process, mirrors the built widget into `src/assets/` so
 * worker rebuilds pick it up, and prints the local URLs you need
 * (Worker endpoint, OAuth discovery, Inspector command).
 *
 * Run with `--no-banner` to suppress the URL banner (CI / scripted use).
 */

import { spawn } from 'node:child_process'
import { copyFile, mkdir, stat } from 'node:fs/promises'
import { watch } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'

const NO_BANNER = process.argv.includes('--no-banner')
const WORKER_URL = 'http://localhost:8787'
const VITE_OUT = 'dist/mcp-app.html'
const WORKER_INPUT = 'src/assets/mcp-app.html'

function printBanner() {
  if (NO_BANNER) return
  process.stdout.write(
    [
      '',
      '┌─ SolvaPay MCP — local dev ─────────────────────────────────',
      `│  Worker MCP endpoint  ${WORKER_URL}/mcp`,
      `│  OAuth discovery       ${WORKER_URL}/.well-known/oauth-protected-resource`,
      `│  OAuth metadata        ${WORKER_URL}/.well-known/oauth-authorization-server`,
      '│',
      '│  Inspect tools         npx @modelcontextprotocol/inspector',
      `│                        (set the server URL to ${WORKER_URL}/mcp)`,
      '└────────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  )
}

function tag(name, color) {
  const reset = '\x1b[0m'
  return (chunk) => {
    const lines = chunk.toString('utf8').split(/\r?\n/)
    if (lines[lines.length - 1] === '') lines.pop()
    for (const line of lines) process.stdout.write(`${color}[${name}]${reset} ${line}\n`)
  }
}

function start(name, command, args, color, extraEnv) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: { ...process.env, ...(extraEnv ?? {}) },
  })
  child.stdout.on('data', tag(name, color))
  child.stderr.on('data', tag(name, color))
  child.once('exit', (code, signal) => {
    process.stdout.write(`[${name}] exited ${signal ? 'via ' + signal : 'with code ' + (code ?? 0)}\n`)
    shutdown(code ?? 0)
  })
  return child
}

let shuttingDown = false
const children = []
function shutdown(exitCode) {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) if (!c.killed) try { c.kill('SIGTERM') } catch {}
  setTimeout(() => process.exit(exitCode), 250)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

printBanner()
children.push(
  start('vite', 'npx', ['vite', 'build', '--watch'], '\x1b[36m', { INPUT: 'mcp-app.html' }),
  start('wrangler', 'npx', ['wrangler', 'dev'], '\x1b[35m'),
)

async function mirrorAsset() {
  try {
    await mkdir(dirname(WORKER_INPUT), { recursive: true })
    await copyFile(VITE_OUT, WORKER_INPUT)
  } catch (err) {
    if (err && err.code !== 'ENOENT') process.stdout.write(`[dev] mirror failed: ${err.message}\n`)
  }
}

;(async () => {
  for (let i = 0; i < 40; i++) {
    try { await stat(VITE_OUT); break } catch { await new Promise(r => setTimeout(r, 250)) }
  }
  await mirrorAsset()
  const w = watch(VITE_OUT, async (eventType) => {
    if (eventType === 'change' || eventType === 'rename') await mirrorAsset()
  })
  w.on('error', () => {})
})().catch(() => {})

if (!NO_BANNER) setTimeout(() => { process.stdout.write('\n'); printBanner() }, 4000)
```

## `.env.example`

```
# Local values for this Worker — used in two places:
#
#   1. `pnpm serve:local` / `wrangler dev` picks these up automatically
#      for local testing.
#   2. `pnpm deploy` (see scripts/deploy.mjs) sources this file and
#      passes SOLVAPAY_PRODUCT_REF / MCP_PUBLIC_BASE_URL /
#      SOLVAPAY_API_BASE_URL as `--var` overrides at deploy time.
#
# scripts/deploy.mjs uploads SOLVAPAY_SECRET_KEY on the first successful
# deploy and skips the upload when the Worker already has it. If you later
# edit this value, run `npx wrangler secret put SOLVAPAY_SECRET_KEY` before
# redeploying.
# Kept here so `wrangler dev` can read it for local testing.
#
# Copy this file to `.env` and fill in your real values. The copy is
# gitignored; keep secrets out of git.

# The SolvaPay secret key for your merchant account. Never commit.
# Dashboard -> API Keys -> secret key (sk_…).
SOLVAPAY_SECRET_KEY=sk_sand_your_key_here

# Product ref the paywall gates on. Create one in the dashboard
# under Products and copy its `prd_…` ID.
SOLVAPAY_PRODUCT_REF=prd_your_product_ref

# Canonical public URL this Worker answers at. For `wrangler dev`,
# http://localhost:8787 is fine. For deployed runs, your custom
# domain (e.g. https://mcp.your-company.com).
MCP_PUBLIC_BASE_URL=http://localhost:8787

# SolvaPay API origin. Omit / leave blank to use production
# (https://api.solvapay.com — this is what src/worker.ts falls back
# to). Set explicitly if you need a different environment. The
# recommended way to populate this for internal testing is to use preview
# tooling and pass `--dev` to `npm create solvapay@preview` /
# `npx -y solvapay@preview init`, which writes the dev URL here for you.
# SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com
```

## `.gitignore`

```
dist/
src/assets/mcp-app.html
node_modules/
.wrangler/
.env
.env.local
!.env.example
```
