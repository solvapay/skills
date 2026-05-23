/**
 * Generated tool registry.
 *
 * `scaffold.mjs` rewrites this file when generating from an OpenAPI
 * spec: imports + `registerXxx(ctx, env)` calls land here, one per
 * non-skipped operation. The template's `registerExample` import +
 * call is removed wholesale.
 *
 * `worker.ts` invokes this via `additionalTools: ctx => registerTools(ctx, env)`
 * so each handler can close over `env.UPSTREAM_API_KEY` (the SolvaPay
 * SDK's `AdditionalToolsContext` does not carry the Workers `env`).
 *
 * When the OpenAPI spec has no supported security scheme (or
 * `selections.json.upstreamAuth.kind === 'none'`), scaffold drops the
 * `env` parameter from both the signature and each `registerXxx` call.
 */

import type { AdditionalToolsContext } from '@solvapay/mcp'
import type { Env } from '../worker'
import { registerExample } from './example'

export function registerTools(ctx: AdditionalToolsContext, env: Env) {
  registerExample(ctx, env)
}
