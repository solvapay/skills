import { readFileSync } from 'node:fs'
import { mintCustomerToken } from '../lib/customer-token.mjs'
import { callTool, listTools } from '../lib/mcp-client.mjs'
import { assertPaywallGate, HIDDEN_UI_TOOLS, MUTATOR_TOOLS, VIEWER_TOOL } from '../lib/verify-contract.mjs'

export const name = 'paywall-gate'
export const scope = 'server'

/**
 * @param {string} credentialsFile
 * @returns {string}
 */
function readAccessToken(credentialsFile) {
  const raw = JSON.parse(readFileSync(credentialsFile, 'utf8'))
  if (typeof raw.accessToken !== 'string' || raw.accessToken.length === 0) {
    throw new Error(`${credentialsFile} is missing accessToken`)
  }
  return raw.accessToken
}

/**
 * @param {{ serverUrl: string, apiBase: string, secretKey: string, productRef: string, credentialsFile?: string }} ctx
 * @returns {Promise<{ status: 'passed' | 'skipped', reason?: string }>}
 */
export async function run(ctx) {
  // The token's audience is the lane's own origin, so it is minted per lane.
  const bearerToken = ctx.credentialsFile
    ? readAccessToken(ctx.credentialsFile)
    : await mintCustomerToken({
        apiBase: ctx.apiBase,
        secretKey: ctx.secretKey,
        productRef: ctx.productRef,
        resource: `${ctx.serverUrl}/mcp`,
      })
  const tools = await listTools(ctx.serverUrl, { bearerToken })
  const reserved = new Set([VIEWER_TOOL, ...MUTATOR_TOOLS, ...HIDDEN_UI_TOOLS])
  const paid = tools.map(tool => tool.name).filter(name => !reserved.has(name))
  if (paid.length === 0) {
    return { status: 'skipped', reason: 'no merchant paid tool in tools/list' }
  }
  const envelope = await callTool(ctx.serverUrl, paid[0], {}, { bearerToken })
  assertPaywallGate(envelope)
  return { status: 'passed' }
}
