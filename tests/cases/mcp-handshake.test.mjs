import { initialize, listPrompts, listTools, RpcError } from '../lib/mcp-client.mjs'
import { assertDiscoveryCatalog, assertPromptCatalog } from '../lib/verify-contract.mjs'

export const name = 'mcp-handshake'
export const scope = 'server'

/**
 * @param {{ serverUrl: string }} ctx
 */
export async function run(ctx) {
  const options = { headers: ctx.language.discoveryHeaders }
  if (ctx.language.anonymousDiscovery === false) {
    try {
      await initialize(ctx.serverUrl, options)
      throw new Error('expected initialize to require auth when anonymousDiscovery is false')
    } catch (error) {
      if (!(error instanceof RpcError) || error.info?.httpStatus !== 401) {
        throw error
      }
    }
    const meta = await fetch(`${ctx.serverUrl.replace(/\/$/, '')}/.well-known/oauth-protected-resource`)
    if (!meta.ok) {
      throw new Error(`oauth-protected-resource HTTP ${meta.status}`)
    }
    return
  }
  const init = await initialize(ctx.serverUrl, options)
  if (!init || typeof init !== 'object') {
    throw new Error('initialize returned no result')
  }
  const tools = await listTools(ctx.serverUrl, options)
  assertDiscoveryCatalog(
    tools.map(tool => tool.name),
    { assertHiddenUi: ctx.language.assertHiddenUi, requiredTools: ctx.language.requiredTools },
  )
  const prompts = await listPrompts(ctx.serverUrl, options)
  assertPromptCatalog(prompts.map(prompt => prompt.name), ctx.language.promptNames)
}
