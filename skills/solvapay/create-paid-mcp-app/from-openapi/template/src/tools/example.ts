/**
 * Example tool — removed by `scaffold.mjs` (listed in `skipPaths`).
 *
 * Exists so the template typechecks standalone before scaffolding has
 * run. The shape mirrors what `scaffold.mjs` emits for a paid
 * operation: paywalled via `ctx.registerPayable`, returns a dual
 * envelope via `c.respond(payload, { text })`. Replace this file with
 * your generated tools, or keep it as a reference when adding hand-
 * written tools after scaffolding.
 */

import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'
import type { Env } from '../worker'

export function registerExample(ctx: AdditionalToolsContext, _env: Env) {
  ctx.registerPayable('example', {
    title: 'Example tool',
    description: 'Returns a static payload. Replace with your generated tools.',
    schema: { name: z.string().default('world') },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    handler: async ({ name }, c) => {
      const data = { greeting: `Hello, ${name}!` }
      return c.respond(data, { text: `Hello, ${name}!` })
    },
  })
}
