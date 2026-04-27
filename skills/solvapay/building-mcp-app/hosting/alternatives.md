# Alternative Hosting for SolvaPay MCP

Decision matrix for deploying a SolvaPay MCP server on a runtime other than Cloudflare Workers. Cloudflare Workers is the recommended default with a full step-by-step in [cloudflare.md](cloudflare.md); this page routes you elsewhere when the runtime is constrained.

## Contents

- Matrix
- Shared wiring
- Runtime notes

## Matrix

| Runtime | SDK subpath | Factory | Route to |
| --- | --- | --- | --- |
| Cloudflare Workers | `@solvapay/mcp/fetch` | `createSolvaPayMcpFetch` | [cloudflare.md](cloudflare.md) (recommended, full inline templates) |
| Supabase Edge Functions | `@solvapay/mcp/fetch` | `createSolvaPayMcpFetch` | [../../sdk-integration/supabase-edge/guide.md](../../sdk-integration/supabase-edge/guide.md) |
| Deno | `@solvapay/mcp/fetch` | `createSolvaPayMcpFetch` | See Runtime notes below; Deno docs: https://docs.deno.com/runtime/fundamentals/http_server/ |
| Bun | `@solvapay/mcp/fetch` | `createSolvaPayMcpFetch` | See Runtime notes below; Bun docs: https://bun.sh/docs/api/http |
| Node + Express | `@solvapay/mcp/express` | `createSolvaPayMcpExpress` | [../../sdk-integration/express/guide.md](../../sdk-integration/express/guide.md) |
| Framework-neutral / custom transport | `@solvapay/mcp` | `createSolvaPayMcpServer` | [../../sdk-integration/mcp-server/guide.md](../../sdk-integration/mcp-server/guide.md) |

## Shared wiring

The factory call shape is identical across fetch-first runtimes. The only things that change between runtimes are:

1. How environment variables are read (`env` binding on Workers, `process.env` on Node/Bun, `Deno.env` on Deno/Supabase Edge).
2. How the widget HTML is loaded (inlined string via Wrangler Text rule on Workers; `Deno.readTextFile` on Deno/Supabase Edge; `fs.readFileSync` at build time on Node).
3. How the handler is mounted (`export default { fetch }` on Workers; `Deno.serve(handler)` on Deno; `Bun.serve({ fetch: handler })` on Bun; Express middleware on Node+Express).

Everything else — `createSolvaPay`, `createSolvaPayMcpFetch`, paywall wrapping, OAuth bridge, intent tools, widget resource — works the same way. See [../../sdk-integration/mcp-server/guide.md](../../sdk-integration/mcp-server/guide.md) for the runtime-neutral reference.

## Runtime notes

### Supabase Edge Functions

Deno-based. Use `@solvapay/mcp/fetch`. The `readHtml` callback reads a bundled widget HTML file via `Deno.readTextFile`. Full guide: [../../sdk-integration/supabase-edge/guide.md](../../sdk-integration/supabase-edge/guide.md).

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

Use `@solvapay/mcp/express` for first-class Express middleware. The factory mounts `/oauth/*`, `/.well-known/*`, and the MCP endpoint in one call. Full guide: [../../sdk-integration/express/guide.md](../../sdk-integration/express/guide.md).

### Framework-neutral

If you have a custom HTTP framework or need to mount the MCP server on a non-standard transport (stdio, WebSocket, SSE), use `createSolvaPayMcpServer` from `@solvapay/mcp`. It returns an `McpServer` instance pre-loaded with the SolvaPay tool surface; you mount it on whatever transport you already have. Full reference: [../../sdk-integration/mcp-server/guide.md](../../sdk-integration/mcp-server/guide.md).

## Session mode by runtime

| Runtime | Recommended `mode` |
| --- | --- |
| Cloudflare Workers | `'json-stateless'` (isolates don't pin) |
| Supabase Edge Functions | `'json-stateless'` |
| Deno deploy (serverless) | `'json-stateless'` |
| Deno / Bun (long-running process) | `'streaming'` or `'json-stateless'` depending on session needs |
| Node + Express (long-running) | `'streaming'` default; `'json-stateless'` for serverless deployments |

When in doubt, start with `'json-stateless'` — it works everywhere and only loses efficiency under high per-session streaming load.
