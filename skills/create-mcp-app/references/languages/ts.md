# TypeScript

The TypeScript API for a paid MCP server: `@solvapay/mcp` on Cloudflare Workers (or another fetch-first runtime). Read [../tool-design.md](../tool-design.md) first for the language-neutral contract; this file is the code.

## Install

The scaffolder installs everything:

```bash
npm create solvapay@latest my-mcp -- --type mcp --language ts --no-openapi
```

`--language` defaults to `ts`, so older commands without it still work. Adding SolvaPay to a project by hand: `@solvapay/mcp`, `@solvapay/mcp-core` and `@solvapay/server` at npm's latest, plus `zod`. `@solvapay/mcp` peers on `@modelcontextprotocol/server@^2` and `@modelcontextprotocol/core@^2`. `@solvapay` on its own is not a package: always import a subpath.

## Imports

```ts
import { z } from 'zod'
import { createSolvaPay } from '@solvapay/server'
import { createSolvaPayMcpFetch } from '@solvapay/mcp/fetch' // Workers, Deno, Bun, Supabase Edge
import { createSolvaPayMcpServer } from '@solvapay/mcp' // framework-neutral
import type { AdditionalToolsContext } from '@solvapay/mcp'
```

## Register a paid tool

Paid and free-capped tools are registered inside the `additionalTools` callback of the factory. `ctx.registerPayable(name, config)` takes **exactly two arguments**.

```ts
export function registerGetItem(ctx: AdditionalToolsContext): void {
  ctx.registerPayable('get_item', {
    title: 'Get item',
    description:
      'Returns the requested item. 1 credit per call; when the customer is out of balance, returns a text-only purchase-required narration naming the `account` viewer with the appropriate `view` — the widget iframe does not auto-open.',
    schema: { id: z.string().min(1) },
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async ({ id }, c) => {
      const data = await loadItem(id)
      return c.respond(data, { text: `Item ${id}: ${summarize(data)}. Render as a card with the key fields.` })
    },
  })
}
```

Wire the callback into the factory:

```ts
createSolvaPayMcpFetch({
  solvaPay,
  productRef,
  resourceUri: 'ui://your-worker/mcp-app.html',
  readHtml: async () => mcpAppHtml,
  publicBaseUrl,
  apiBaseUrl,
  responseMode: 'json',
  hideToolsByAudience: ['ui'],
  additionalTools: registerTools,
})
```

- `responseMode: 'json'` on stateless edge runtimes (Workers, Deno, Supabase Edge).
- `hideToolsByAudience: ['ui']` drops the widget's transport tools (`create_hosted_session`, `process_payment`, …) from `tools/list` on text-only hosts.
- `registerPayable` does not accept `resourceUri`. Do not reach for the lower-level `registerPayableTool` to set it.
- One tool per file: `src/tools/<intent>.ts` exports `register<Intent>(ctx, env)`; `src/tools/index.ts` only imports and calls them.

## Free tool

**Free-capped** (identity required, counted against a `free-*` meter):

```ts
ctx.registerFree('preview_item', {
  title: 'Preview item',
  description: 'Name and price preview. Shares the free-previews allowance.',
  schema: { id: z.string().min(1) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  limit: { meter: 'free-previews', cap: 5, scope: 'rolling_window', windowDays: 30 },
  handler: async ({ id }, c) => {
    const data = await previewItem(id)
    return c.respond(data, { text: `Preview of item ${id}. Render as a compact card.` })
  },
})
```

`scope` is `rolling_window` (with `windowDays`) or `lifetime`. Omitting `meter` uses `free-requests`. Tools naming the same meter must pass the same `limit` object or registration throws.

**Unlimited free** (no identity, no counting) uses the underlying server and hand-rolls the envelope, because `c.respond` is not on that signature:

```ts
ctx.server.registerTool(
  'list_categories',
  {
    title: 'List categories',
    description: "Returns the merchant catalogue's top-level categories. Unlimited, no identity required.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  },
  async () => {
    const data = await loadCategories()
    return {
      content: [{ type: 'text', text: `Returned ${data.length} categories. Render as a vertical list grouped by parent.` }],
      structuredContent: { categories: data },
    }
  },
)
```

Optional slash-command prompt for hosts with prompt UI (others ignore it):

```ts
ctx.server.registerPrompt(
  'get_item',
  { title: 'Get item', description: 'Fetch one item and render it as a card.', argsSchema: { id: z.string().optional() } },
  async ({ id }) => ({
    messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Get item "${id ?? ''}" and render it as a card.` } }],
  }),
)
```

## Respond and narration

`c.respond(data, { text })` on paid and free-capped handlers. `data` becomes `structuredContent`; `text` is the render instruction the host reads:

```ts
return c.respond(
  { items, total, currency: 'USD' },
  { text: `Returned ${items.length} matching items. Render this as a table with columns: name, price, stock. Show the total at the bottom.` },
)
```

Never return a raw `content` array from a paid or free-capped handler, and never return a custom iframe or `_meta.ui.*` on a gate: the factory writes the gate narration.

## Run locally

```bash
npm run dev          # wrangler dev on http://localhost:8787, MCP endpoint /mcp
```

`MCP_PUBLIC_BASE_URL` in `.env` must be the URL the MCP client uses. For a remote client, tunnel the port and set it to the tunnel URL.

## Test

```bash
node scripts/verify.mjs http://localhost:8787             # OAuth discovery, tools/list, paywall gate, account view
( cd scripts && npm install ) && node scripts/test.mjs <url>
npx tsc --noEmit
```

`verify.mjs` and `test.mjs` ship inside the scaffolded project, not in this skill.

## Deploy

Cloudflare Workers: [../hosting/cloudflare/README.md](../hosting/cloudflare/README.md). `npm run deploy` resolves the `workers.dev` URL, uploads secrets on first deploy and stops on outdated `@solvapay/*` packages. Other runtimes: [../hosting/alternatives.md](../hosting/alternatives.md).

## Existing server

Follow [../existing-server.md](../existing-server.md). Re-register paid tools with `ctx.registerPayable` inside `additionalTools` (or wrap a handler with `solvaPay.payable({ product }).mcp(handler)`), free-capped with `ctx.registerFree`, and remove any hand-rolled quota logic. On Workers, build the handler lazily inside `fetch()` because `env` is not available at module scope.

## Keep the SDK current

```bash
npx -y solvapay@latest doctor
```

Its `@solvapay/*` versions check compares each installed package with npm and prints an upgrade command with exact pins. Run it after scaffold, before every deploy and before reporting a bug. Scaffolded projects ship `.github/dependabot.yml` (npm), which moves all `@solvapay/*` packages together.

## Gotchas

- `registerPayable` / `registerFree` take two arguments, not `(toolDef, paymentConfig, handler)`.
- `free-capped` / `registerFree` need `@solvapay/mcp@latest`.
- `ctx.server.registerTool` is the only kind with no identity. Do not register a capped preview with it plus a hand-rolled counter.
- On Cloudflare Workers, never call `createSolvaPay(...)` or read `env.*` at module scope.
- Do not type 64-bit integer IDs as `z.number()`: values above 2^53 are rounded. Use the template's `int64` schema and `stringifyLossless` (see [../from-openapi/intent-driven-patterns.md#large-integer-ids](../from-openapi/intent-driven-patterns.md#large-integer-ids)).
