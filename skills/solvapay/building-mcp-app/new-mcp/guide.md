# Scaffold a New MCP Server with SolvaPay

Create a fresh MCP server with SolvaPay paywall + intent tools baked in, targeting Cloudflare Workers. Every template is inline — no cloning, no external repo dependency.

## Contents

- Prerequisites
- Pre-read
- File-creation order
- Handoff to deploy

## Prerequisites

- Node.js 20+, `pnpm` 9.6+ (or `npm` / `yarn` — examples use `pnpm`).
- Cloudflare account with `wrangler` CLI authenticated: `npx wrangler login`.
- SolvaPay account with:
  - A secret key (`sk_...`). Dashboard -> **API Keys** -> secret key.
  - A product ref (`prd_...`). Dashboard -> **Products** -> create one if none exists.

If the SolvaPay product doesn't exist yet, pause and route to [../../provider-onboarding/guide.md](../../provider-onboarding/guide.md) to create it.

## Pre-read

Before writing any tool code, read [../tool-design.md](../tool-design.md). It covers the three response modes, intent composition, annotations, and the rule that payable tools return data for the host to render — not iframes. This is load-bearing for the success of the scaffolded server.

## File-creation order

Create a new project directory, then write each file from the **Templates** section of [../hosting/cloudflare.md](../hosting/cloudflare.md) into it. Follow this order so each file has the context it depends on before it's referenced:

1. **`package.json`** — set `name` to your project slug. Keep `dependencies`, `devDependencies`, and `scripts` verbatim from the template.
2. **`tsconfig.json`** — paste verbatim.
3. **`wrangler.jsonc`** — set `name` to your Worker slug. Set `routes[0].pattern` to your custom hostname, or remove the `routes` block entirely to serve on the default `*.workers.dev` URL. Keep `vars` placeholders — they're overridden at deploy time.
4. **`vite.config.ts`** — paste verbatim.
5. **`mcp-app.html`** — paste verbatim.
6. **`src/assets.d.ts`** — paste verbatim.
7. **`src/mcp-app.tsx`** — paste verbatim. This is the default SolvaPay checkout / account / topup widget and usually needs no edits. Remember: the widget renders only when the user deliberately invokes an intent tool (`upgrade` / `topup` / `manage_account`); it is not a gate surface.
8. **`src/worker.ts`** — paste verbatim, then update the `resourceUri` string to `ui://<your-worker-slug>/mcp-app.html` (match the `name` in `wrangler.jsonc`).
9. **`scripts/deploy.mjs`** — paste verbatim.
10. **`.env.example`** — paste verbatim.
11. **`.gitignore`** — paste verbatim.

## Add your tools

Create `src/tools.ts` with your paid tools:

```ts
import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'

export function registerMyTools(ctx: AdditionalToolsContext): void {
  const { registerPayable } = ctx

  registerPayable('get_item', {
    title: 'Get item',
    description:
      'Returns the requested item. 1 credit per call; when the customer is out of balance, returns a text-only purchase-required narration naming the `upgrade` or `topup` recovery tool.',
    schema: { id: z.string().min(1) },
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async ({ id }, ctx) => {
      const data = await loadItem(id)
      const narration = `Item ${id}: ${summarize(data)}. Render as a card with the key fields.`
      return ctx.respond(data, { text: narration })
    },
  })
}
```

Then wire it into `src/worker.ts` by adding the import and the `additionalTools` field to the `createSolvaPayMcpFetch` call:

```ts
import { registerMyTools } from './tools'

// inside createSolvaPayMcpFetch({...}):
additionalTools: registerMyTools,
```

For the full tool design rules (response modes, narration shape, annotations, naming), see [../tool-design.md](../tool-design.md).

## Handoff to deploy

With all files written, jump to [../hosting/cloudflare.md](../hosting/cloudflare.md) **Step 3 (Install)** onward for install, env, secret, build, local dev, deploy, and gate smoke test.

## Task progress

- [ ] Verify prerequisites (Node, pnpm, `wrangler login`, SolvaPay product ref)
- [ ] Read [../tool-design.md](../tool-design.md)
- [ ] Create project directory
- [ ] Write all files from [../hosting/cloudflare.md](../hosting/cloudflare.md) templates
- [ ] Add `src/tools.ts` with your paid tools
- [ ] Wire `additionalTools: registerMyTools` into `src/worker.ts`
- [ ] Continue to [../hosting/cloudflare.md](../hosting/cloudflare.md) Step 3 for install + deploy
