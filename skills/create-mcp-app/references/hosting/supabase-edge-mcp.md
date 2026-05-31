# Supabase Edge Functions — MCP server

Deploy a SolvaPay MCP server on Supabase Edge Functions using `@solvapay/mcp/fetch`. Deno-based; same factory as Cloudflare Workers with `Deno.readTextFile` for widget HTML.

## Prerequisites

- Supabase CLI installed
- `SOLVAPAY_SECRET_KEY`, `SOLVAPAY_PRODUCT_REF`, `MCP_PUBLIC_BASE_URL` set via `supabase secrets set`
- Widget built to a path readable at runtime (e.g. `./dist/mcp-app.html` after `vite build`)

## Import map

Create `supabase/functions/deno.json`:

```json
{
  "imports": {
    "@solvapay/server": "npm:@solvapay/server",
    "@solvapay/server/": "npm:/@solvapay/server/",
    "@solvapay/mcp": "npm:@solvapay/mcp",
    "@solvapay/mcp/": "npm:/@solvapay/mcp/",
    "@solvapay/auth": "npm:@solvapay/auth",
    "@solvapay/core": "npm:@solvapay/core"
  }
}
```

The trailing-slash entries are required for Deno subpath exports (`/fetch`).

## Handler

```typescript
// supabase/functions/mcp/index.ts
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

Register paid tools via `additionalTools` and `registerPayable` — see [mcp-server-wiring.md](../mcp-server-wiring.md).

## Secrets

```bash
supabase secrets set SOLVAPAY_SECRET_KEY=sk_sandbox_...
supabase secrets set SOLVAPAY_PRODUCT_REF=prd_...
supabase secrets set MCP_PUBLIC_BASE_URL=https://<project-ref>.supabase.co/functions/v1/mcp
```

Never put `SOLVAPAY_SECRET_KEY` in client code or `VITE_*` env vars.

## Widget build

Reuse the widget templates from [cloudflare/](cloudflare/) (`src/mcp-app.tsx`, `mcp-app.html`, `vite.config.ts`). Bundle HTML into the function deployment path that `readHtml` reads.

## Verification

- [ ] `deno.json` import map resolves `@solvapay/mcp/fetch`
- [ ] `GET /.well-known/oauth-protected-resource` returns expected JSON
- [ ] Paid tool gates with text-only narration; intent tools mount widget when invoked
- [ ] `mode: 'json-stateless'` (required on serverless Deno isolates)

## Troubleshooting

- **Subpath import fails**: ensure `"@solvapay/mcp/": "npm:/@solvapay/mcp/"` is present in `deno.json`.
- **readHtml path wrong**: use a path relative to the function cwd after deploy; test locally with `supabase functions serve`.
- **401 on tools/call**: OAuth bridge and bearer token resolution — see [mcp-server-wiring.md](../mcp-server-wiring.md#oauth-bridge-setup).

Example: [`supabase-edge-mcp`](https://github.com/solvapay/solvapay-sdk/tree/main/examples/supabase-edge-mcp).
