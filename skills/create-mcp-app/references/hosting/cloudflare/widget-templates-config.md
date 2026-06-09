# Cloudflare Workers — Config templates

Project config files for a SolvaPay MCP Worker scaffold. Copy each block into the matching path relative to the project root from the [Cloudflare deploy guide](README.md) (Step 2).

Widget, scripts, and env templates: [widget-templates-widget-and-scripts.md](widget-templates-widget-and-scripts.md)

## Contents

- [`package.json`](#packagejson)
- [`tsconfig.json`](#tsconfigjson)
- [`wrangler.jsonc`](#wranglerjsonc)
- [`vite.config.ts`](#viteconfigts)
- [`mcp-app.html`](#mcp-apphtml)
- [`src/assets.d.ts`](#srcassetsdts)
- [`src/worker.ts`](#srcworkerts)

## `package.json`

```json
{
  "name": "your-mcp-server-name",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "cross-env INPUT=mcp-app.html vite build && mkdir -p src/assets && cp dist/mcp-app.html src/assets/mcp-app.html",
    "dev": "pnpm build && node scripts/dev.mjs",
    "dev:widget": "cross-env INPUT=mcp-app.html vite build --watch",
    "predeploy": "pnpm build",
    "deploy": "node scripts/deploy.mjs",
    "serve:local": "wrangler dev"
  },
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "^1.7.1",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "@solvapay/mcp": "^0.2.5",
    "@solvapay/react": "^1.2.0",
    "@solvapay/server": "^1.1.0",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
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

## `tsconfig.json`

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

## `wrangler.jsonc`

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

## `vite.config.ts`

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

## `mcp-app.html`

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

## `src/assets.d.ts`

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

## `src/worker.ts`

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
      `${name} is not set — check wrangler.jsonc \`vars\` block or run \`npx wrangler secret put ${name}\``,
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
    // `serverName` brands the MCP handshake (`server.info.name`) so
    // clients show your project name instead of the default
    // `solvapay-mcp-server`. Match the value to your wrangler `name`.
    serverName: 'your-worker-slug',
    resourceUri: 'ui://your-worker-slug/mcp-app.html',
    readHtml: async () => mcpAppHtml,
    publicBaseUrl: requireEnv(env, 'MCP_PUBLIC_BASE_URL'),
    apiBaseUrl,
    mode: 'json-stateless',
    hideToolsByAudience: ['ui'],
    // Wire your paid tools here. See ../../tool-design.md for the
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

