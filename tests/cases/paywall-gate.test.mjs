import { readFileSync } from 'node:fs'
import { callTool, listTools } from '../lib/mcp-client.mjs'
import { assertPaywallGate, HIDDEN_UI_TOOLS, MUTATOR_TOOLS, VIEWER_TOOL } from '../lib/verify-contract.mjs'

export const name = 'paywall-gate'
export const scope = 'server'

/**
 * @param {{ serverUrl: string, credentialsFile?: string }} ctx
 * @returns {Promise<{ status: 'passed' | 'skipped', reason?: string }>}
 */
export async function run(ctx) {
  if (!ctx.credentialsFile) {
    return {
      status: 'skipped',
      reason: 'MCP_TEST_CREDENTIALS_FILE unset; tools/call needs a customer bearer',
    }
  }
  const raw = JSON.parse(readFileSync(ctx.credentialsFile, 'utf8'))
  const bearerToken = typeof raw.accessToken === 'string' ? raw.accessToken : undefined
  if (!bearerToken) {
    throw new Error(`${ctx.credentialsFile} is missing accessToken`)
  }
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
