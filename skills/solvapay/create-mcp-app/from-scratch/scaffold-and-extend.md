# Scaffold and extend a hand-written paid MCP server

This guide picks up **after** the scaffolder finishes. It covers orienting on what `npm create solvapay@latest -- --type mcp --no-openapi` produced, replacing the placeholder paid tool, adding more paid tools by hand, and handing off to deploy.

## When to read this

- You ran (or are about to run) `npm create solvapay@latest <name> -- --type mcp --no-openapi` and want to know what's in the project.
- You want to replace the placeholder paid tool with real business logic.
- You want to add another paid tool to a scaffolded hand-written project.
- If you have an OpenAPI / Swagger spec for the API you want to wrap, stop and route to [../from-openapi/guide.md](../from-openapi/guide.md) instead — the OpenAPI flow auto-generates tools.
- If you have an MCP server that already exists and want to add SolvaPay paywall to it, stop and route to [../existing-server/guide.md](../existing-server/guide.md).

## Scaffolder shortcut

If you haven't scaffolded yet:

```bash
npm create solvapay@latest my-mcp -- --type mcp --no-openapi
# or: pnpm create solvapay@latest my-mcp -- --type mcp --no-openapi
# or: yarn create solvapay@latest my-mcp -- --type mcp --no-openapi
```

The scaffolder asks for a project name + a camelCase tool name (default `helloTool`), then drops you into a working Cloudflare Workers MCP shell with one placeholder paid tool, the SolvaPay paywall wired up, and `.env` populated by the browser-based `solvapay init` flow. The first deploy works without writing any code.

## What the scaffolder produced

A typical from-scratch tree:

```
my-mcp/
  package.json           wrangler / vite / @solvapay/mcp / @solvapay/react / zod
  wrangler.jsonc
  tsconfig.json
  vite.config.ts
  mcp-app.html
  .env                   SOLVAPAY_SECRET_KEY / SOLVAPAY_PRODUCT_REF / MCP_PUBLIC_BASE_URL
  .env.example
  .gitignore             excludes .env
  scripts/
    deploy.mjs
    test.mjs             one-time `( cd scripts && npm install )` required
    verify.mjs
  src/
    worker.ts            createSolvaPayMcpFetch wrapper; do not edit unless you need different CSP/CORS
    mcp-app.tsx          default checkout/account/topup widget
    assets.d.ts
    lib/upstreamFetch.ts
    lib/upstreamOAuth.ts opt-in helper for OAuth 2.0 client_credentials upstreams
    tools/
      <toolName>.ts      placeholder paid tool with TODO body
      index.ts           registerTools aggregator wired into worker.ts
```

`SOLVAPAY_SECRET_KEY` and `SOLVAPAY_PRODUCT_REF` are already filled by `solvapay init` — the project is sandbox-ready before you write any business logic.

## Pre-read

Before writing any tool code, read [../tool-design.md](../tool-design.md). It covers the three response modes, intent composition, annotations, and the rule that payable tools return data for the host to render — not iframes. This is load-bearing for the success of the scaffolded server.

## Add another paid tool

1. Create `src/tools/<newTool>.ts`:

   ```ts
   import { z } from 'zod'
   import type { AdditionalToolsContext } from '@solvapay/mcp'

   export function registerGetItem(ctx: AdditionalToolsContext): void {
     ctx.registerPayable('get_item', {
       title: 'Get item',
       description:
         'Returns the requested item. 1 credit per call; when the customer is out of balance, returns a text-only purchase-required narration naming the `upgrade` or `topup` recovery tool.',
       schema: { id: z.string().min(1) },
       annotations: { readOnlyHint: true, idempotentHint: true },
       handler: async ({ id }, c) => {
         const data = await loadItem(id)
         const narration = `Item ${id}: ${summarize(data)}. Render as a card with the key fields.`
         return c.respond(data, { text: narration })
       },
     })

     // Optional: surface the tool as a slash-command for hosts with
     // prompt UI (Claude Desktop). Hosts without prompt support silently
     // ignore it. Skip this block for tools the LLM should discover on
     // its own without chrome.
     ctx.server.registerPrompt(
       'get_item',
       {
         title: 'Get item',
         description: 'Fetch a single item by id and render it as a card.',
         argsSchema: { id: z.string().optional() },
       },
       async ({ id }) => ({
         messages: [
           {
             role: 'user' as const,
             content: {
               type: 'text' as const,
               text: `Get the item with id "${id ?? ''}" and render it as a card.`,
             },
           },
         ],
       }),
     )
   }
   ```

2. Import and call it from `src/tools/index.ts`:

   ```ts
   import { registerGetItem } from './getItem'

   export function registerTools(ctx: AdditionalToolsContext, _env: Env): void {
     register__TOOL_NAME_PASCAL__(ctx)
     registerGetItem(ctx)
   }
   ```

   Drop the underscore prefix on `_env` if your tool reads `env.UPSTREAM_API_KEY` or another binding.

3. If the tool needs upstream HTTP calls, use the shipped helper:

   ```ts
   import { upstreamFetchJson } from '../lib/upstreamFetch'
   ```

   It sends `Accept: application/json`, throws `UpstreamError` on non-2xx / non-JSON, and carries `{ status, contentType, bodySnippet }` on the thrown error so the MCP `isError` envelope tells the LLM exactly why upstream rejected the call.

4. If the upstream uses OAuth 2.0 client_credentials, use the OAuth helper alongside `upstreamFetchJson`:

   ```ts
   import { getAccessToken } from '../lib/upstreamOAuth'
   import { upstreamFetchJson } from '../lib/upstreamFetch'

   // …inside the handler:
   const token = await getAccessToken(env)
   const data = await upstreamFetchJson<MyShape>(url, {
     method: 'GET',
     headers: { authorization: `Bearer ${token}` },
   })
   ```

   Populate `UPSTREAM_OAUTH_TOKEN_URL`, `UPSTREAM_OAUTH_CLIENT_ID`, `UPSTREAM_OAUTH_CLIENT_SECRET` (and optional `UPSTREAM_OAUTH_SCOPE` / `UPSTREAM_OAUTH_AUDIENCE`) in `.env`. `scripts/deploy.mjs` uploads them as Worker Secrets on the first deploy. The helper caches the exchanged token in the Workers isolate until ~30s before expiry — every tool in the same isolate reuses it.

For the full tool design rules (response modes, narration shape, annotations, naming), see [../tool-design.md](../tool-design.md).

## Replace the placeholder

The scaffolder left a working echo tool inside `src/tools/<toolName>.ts` so the paywall is verifiable on first deploy. Treat it as a starting point:

- Rename the function and tool name if you picked a generic placeholder during scaffold.
- Replace the sample `respond({ ok: true, echoed: ... })` body with your real business logic.
- Replace the placeholder `description` (currently flags itself as a demo echo) with what the LLM needs to decide *when* to invoke this tool. The description is the only signal the model gets.
- Update the matching `server.registerPrompt(...)` description and `argsSchema` to match the new tool, or delete it entirely if you don't want the slash-command surface.

## Handoff to deploy

With your tools written, deploy:

```bash
npm run deploy   # uses scripts/deploy.mjs; auto-resolves the workers.dev URL
```

Then verify and smoke-test (see [../hosting/cloudflare.md](../hosting/cloudflare.md) Step 5 onward for `verify.mjs` / `test.mjs` usage).

## Task progress

- [ ] Run `npm create solvapay@latest <name> -- --type mcp --no-openapi` (or equivalent for pnpm/yarn)
- [ ] Read [../tool-design.md](../tool-design.md)
- [ ] Replace the placeholder tool body in `src/tools/<toolName>.ts`
- [ ] Add additional paid tools under `src/tools/` and wire them into `src/tools/index.ts`
- [ ] `npm run deploy` — verify the worker boots
- [ ] `node scripts/verify.mjs <url>` — confirm MCP contract
- [ ] `( cd scripts && npm install ) && node scripts/test.mjs` — exercise each tool
