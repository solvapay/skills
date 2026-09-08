/**
 * Latest-core MCP tool table (core/solvapay-core/src/mcp/tool_names.rs).
 * The scaffolded verify.mjs still lists upgrade/topup/manage_account as
 * tools — that is upstream drift, flagged in the handoff, not copied here.
 */
export const VIEWER_TOOL = 'account'
export const MUTATOR_TOOLS = Object.freeze(['activate_plan'])
export const PROMPT_NAMES = Object.freeze(['upgrade', 'manage_account', 'topup', 'activate_plan'])
export const HIDDEN_UI_TOOLS = Object.freeze([
  'create_hosted_session',
  'set_renewal',
  'get_history',
  'create_payment_intent',
  'process_payment',
  'attach_business_details',
])

/**
 * @param {string[]} names
 * @param {{ assertHiddenUi?: boolean }} [opts]
 */
export function assertDiscoveryCatalog(names, opts = {}) {
  const required = opts.requiredTools ?? [VIEWER_TOOL, ...MUTATOR_TOOLS]
  for (const name of required) {
    if (!names.includes(name)) {
      throw new Error(`tools/list missing \`${name}\``)
    }
  }
  if (opts.assertHiddenUi === false) return
  const leaked = names.filter(name => HIDDEN_UI_TOOLS.includes(name))
  if (leaked.length > 0) {
    throw new Error(`UI-only tools leaked to text catalog: ${leaked.join(', ')}`)
  }
}

/**
 * @param {string[]} names
 */
export function assertPromptCatalog(names, expected = PROMPT_NAMES) {
  for (const name of expected) {
    if (!names.includes(name)) {
      throw new Error(`prompts/list missing \`${name}\``)
    }
  }
}

/**
 * @param {unknown} envelope
 */
export function assertPaywallGate(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('tools/call returned a non-object envelope')
  }
  const record = /** @type {Record<string, unknown>} */ (envelope)
  const content = record.content
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error('gate response missing content[0]')
  }
  const first = content[0]
  if (!first || typeof first !== 'object' || first.type !== 'text' || typeof first.text !== 'string') {
    throw new Error('gate narration must be text-only in content[0].text')
  }
  const structured = record.structuredContent
  if (!structured || typeof structured !== 'object' || !('gate' in structured)) {
    throw new Error('gate response missing structuredContent.gate')
  }
}
