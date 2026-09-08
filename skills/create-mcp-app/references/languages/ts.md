# TypeScript paid MCP app

Delta only. Shared paywall contract lives in [../tool-design.md](../tool-design.md). Do not open another `languages/*.md`.

Host: Cloudflare Workers via `wrangler` on **8787**. Extra TypeScript runtimes (Express, Deno, Bun, Supabase Edge): [../hosting/alternatives.md](../hosting/alternatives.md).

OpenAPI codegen is available on this row (`inputModes: scratch, openapi`).

## Imports

```ts
import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'
```

Free tools also use `ctx.server.registerTool` from that same context. Factory: `createSolvaPayMcpFetch` from `@solvapay/mcp/fetch`.

## Registration

`ctx.registerPayable` takes **exactly two arguments** — a snake_case name and one config object:

```ts
export function registerGetItem(ctx: AdditionalToolsContext): void {
  ctx.registerPayable('get_item', {
    title: 'Get item',
    description:
      'Returns the requested item. 1 credit per call; when gated, text-only narration names `account`.',
    schema: { id: z.string().min(1) },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async ({ id }, c) => {
      const data = await loadItem(id)
      return c.respond(data, {
        text: `Item ${id}: ${summarize(data)}. Render as a card with the key fields.`,
      })
    },
  })
}
```

Wire `additionalTools: registerMyTools` on `createSolvaPayMcpFetch`. Pass `mode: 'json-stateless'` and `hideToolsByAudience: ['ui']`.

## Respond

Paid handlers return `c.respond(data, { text: narration })`. Never a raw `content` array from a paid handler.

Free tools (`ctx.server.registerTool`) return `{ content: [{ type: 'text', text: narration }], structuredContent }`. Do not call `c.respond` there.

## File layout

```
src/worker.ts            createSolvaPayMcpFetch — do not edit on deploy-existing
src/tools/<name>.ts      one paid tool; export register<Name>(ctx)
src/tools/index.ts       aggregator
wrangler.jsonc
package.json
```

`--tool-name` is the MCP identifier and the file stem. Use snake_case (`generate_haiku`), not camelCase.

## Install and run

```bash
node scripts/check-toolchain.mjs --language ts
node scripts/scaffold-app.mjs ./my-mcp --language ts --tool-name generate_haiku
npm create solvapay@latest my-mcp -- --type mcp --language ts --no-openapi --tool-name generate_haiku
npx -y solvapay@latest init --language ts
npm install
npm run dev          # :8787
```

OpenAPI (this row only): `scripts/describe.mjs` + `scripts/scaffold.mjs` per [../from-openapi/guide.md](../from-openapi/guide.md).

## Environment

| Variable | Role |
| --- | --- |
| `SOLVAPAY_SECRET_KEY` | Server secret. `wrangler secret put` on deploy; `.env` for local only |
| `SOLVAPAY_PRODUCT_REF` | `prd_…` |
| `MCP_PUBLIC_BASE_URL` | Public origin (`http://localhost:8787` locally) |
| `SOLVAPAY_API_BASE_URL` | Optional. Local stack: `http://localhost:3010` |

## Troubleshooting

- `@solvapay` is not a package — import `@solvapay/mcp` / `@solvapay/mcp/fetch`.
- `registerPayable` is two args, not `(toolDef, paymentConfig, handler)`.
- Deploy pre-flight: `npx wrangler whoami` (not just `wrangler login`).
- Scaffolder `⚠️` means install failed — do not continue.
- Extra hosts: [../hosting/alternatives.md](../hosting/alternatives.md). Custom widget: [../mcp-apps-ui.md](../mcp-apps-ui.md).
