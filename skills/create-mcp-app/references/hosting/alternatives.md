# Alternative Hosting for SolvaPay MCP

Decision matrix for deploying a SolvaPay MCP server on a runtime other than Cloudflare Workers. Cloudflare Workers is the recommended default with a full step-by-step in [cloudflare/](cloudflare/); this page routes you elsewhere when the runtime is constrained.

## Contents

- Matrix
- Shared wiring
- Runtime notes

## Matrix

| Runtime | SDK subpath | Factory | Route to |
| --- | --- | --- | --- |
| Cloudflare Workers | `@solvapay/mcp/fetch` | `createSolvaPayMcpFetch` | [cloudflare/](cloudflare/) (recommended, full inline templates) |
| Supabase Edge Functions | `@solvapay/mcp/fetch` | `createSolvaPayMcpFetch` | [supabase-edge-mcp.md](supabase-edge-mcp.md) |
| Deno | `@solvapay/mcp/fetch` | `createSolvaPayMcpFetch` | See Runtime notes below; Deno docs: https://docs.deno.com/runtime/fundamentals/http_server/ |
| Bun | `@solvapay/mcp/fetch` | `createSolvaPayMcpFetch` | See Runtime notes below; Bun docs: https://bun.sh/docs/api/http |
| Node + Express | `@solvapay/mcp` + `@solvapay/mcp/express` | `createSolvaPayMcpServer` + `createMcpOAuthBridge` | See Node + Express below |
| Framework-neutral / custom transport | `@solvapay/mcp` | `createSolvaPayMcpServer` | [mcp-server-wiring.md](../mcp-server-wiring.md) |

## Shared wiring

The factory call shape is identical across fetch-first runtimes. The only things that change between runtimes are:

1. How environment variables are read (`env` binding on Workers, `process.env` on Node/Bun, `Deno.env` on Deno/Supabase Edge).
2. How the widget HTML is loaded (inlined string via Wrangler Text rule on Workers; `Deno.readTextFile` on Deno/Supabase Edge; `fs.readFileSync` at build time on Node).
3. How the handler is mounted (`export default { fetch }` on Workers; `Deno.serve(handler)` on Deno; `Bun.serve({ fetch: handler })` on Bun).

Everything else — `createSolvaPay`, `createSolvaPayMcpFetch`, paywall wrapping, OAuth bridge, intent tools, widget resource — works the same way. See [mcp-server-wiring.md](../mcp-server-wiring.md) for the runtime-neutral reference.

## Runtime notes

### Supabase Edge Functions

Deno-based. Use `@solvapay/mcp/fetch`. The `readHtml` callback reads a bundled widget HTML file via `Deno.readTextFile`. Full guide: [supabase-edge-mcp.md](supabase-edge-mcp.md).

### Deno

```ts
import { createSolvaPay } from '@solvapay/server'
import { createSolvaPayMcpFetch } from '@solvapay/mcp/fetch'

const handler = createSolvaPayMcpFetch({
  solvaPay: createSolvaPay({ apiKey: Deno.env.get('SOLVAPAY_SECRET_KEY')! }),
  productRef: Deno.env.get('SOLVAPAY_PRODUCT_REF')!,
  publicBaseUrl: Deno.env.get('MCP_PUBLIC_BASE_URL')!,
  resourceUri: 'ui://your-server/mcp-app.html',
  readHtml: async () => await Deno.readTextFile('./dist/mcp-app.html'),
  mode: 'json-stateless',
  hideToolsByAudience: ['ui'],
})

Deno.serve(handler)
```

Build the widget the same way as the Cloudflare template (`vite build`); point `readHtml` at the output. Deno HTTP docs: https://docs.deno.com/runtime/fundamentals/http_server/.

### Bun

```ts
import { createSolvaPay } from '@solvapay/server'
import { createSolvaPayMcpFetch } from '@solvapay/mcp/fetch'

const mcpAppHtml = await Bun.file('./dist/mcp-app.html').text()

const handler = createSolvaPayMcpFetch({
  solvaPay: createSolvaPay({ apiKey: process.env.SOLVAPAY_SECRET_KEY! }),
  productRef: process.env.SOLVAPAY_PRODUCT_REF!,
  publicBaseUrl: process.env.MCP_PUBLIC_BASE_URL!,
  resourceUri: 'ui://your-server/mcp-app.html',
  readHtml: async () => mcpAppHtml,
  mode: 'json-stateless',
  hideToolsByAudience: ['ui'],
})

Bun.serve({ fetch: handler, port: 8787 })
```

Bun HTTP docs: https://bun.sh/docs/api/http.

### Node + Express

No `createSolvaPayMcpExpress` turnkey factory exists yet. Use `createSolvaPayMcpServer` (framework-neutral) + `StreamableHTTPServerTransport` (from `@modelcontextprotocol/sdk`) + `createMcpOAuthBridge` (from `@solvapay/mcp/express`).

> **Import subpaths — do not use bare `@solvapay`:** `createSolvaPayMcpServer` comes from `@solvapay/mcp` (not bare `@solvapay`, which is not a valid package). `createMcpOAuthBridge` comes from `@solvapay/mcp/express`. These are two separate subpaths of the same package.

```ts
import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createSolvaPay } from '@solvapay/server'
import { createSolvaPayMcpServer } from '@solvapay/mcp'       // NOT '@solvapay' (bare)
import { createMcpOAuthBridge } from '@solvapay/mcp/express'

const solvaPay = createSolvaPay({ apiKey: process.env.SOLVAPAY_SECRET_KEY! })

const mcpServer = createSolvaPayMcpServer({
  solvaPay,
  productRef: process.env.SOLVAPAY_PRODUCT_REF!,
  publicBaseUrl: process.env.MCP_PUBLIC_BASE_URL!,
  mode: 'json-stateless',
  additionalTools: (ctx) => {
    ctx.registerPayable('my_tool', {
      title: 'My tool',
      description: '...',
      schema: { /* zod shape */ },
      handler: async (input, c) => c.respond(data, { text: narration }),
    })
  },
})

export const app = express()
app.use(express.json())
app.use(...createMcpOAuthBridge({
  publicBaseUrl: process.env.MCP_PUBLIC_BASE_URL!,
  productRef: process.env.SOLVAPAY_PRODUCT_REF!,
  apiBaseUrl: process.env.SOLVAPAY_API_BASE_URL ?? 'https://api.solvapay.com',
}))

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await mcpServer.connect(transport)
  await transport.handleRequest(req, res, req.body)
})
```

Required deps: `@solvapay/mcp`, `@solvapay/server`, `@modelcontextprotocol/sdk`, `express`, `zod`. No `wrangler.jsonc`. Read env via `process.env` (not Workers `Env` interface).

### Framework-neutral

If you have a custom HTTP framework or need to mount the MCP server on a non-standard transport (stdio, WebSocket, SSE), use `createSolvaPayMcpServer` from `@solvapay/mcp`. It returns an `McpServer` instance pre-loaded with the SolvaPay tool surface; you mount it on whatever transport you already have. Full reference: [mcp-server-wiring.md](../mcp-server-wiring.md).

## Session mode by runtime

| Runtime | Recommended `mode` |
| --- | --- |
| Cloudflare Workers | `'json-stateless'` (isolates don't pin) |
| Supabase Edge Functions | `'json-stateless'` |
| Deno deploy (serverless) | `'json-stateless'` |
| Deno / Bun (long-running process) | `'streaming'` or `'json-stateless'` depending on session needs |

When in doubt, start with `'json-stateless'` — it works everywhere and only loses efficiency under high per-session streaming load.

