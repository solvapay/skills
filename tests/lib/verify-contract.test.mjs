import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assertPaywallGate } from './verify-contract.mjs'

/**
 * Trimmed from a real `hello_tool` gate on the ts lane.
 */
function gateEnvelope(overrides = {}) {
  return {
    isError: false,
    content: [{ type: 'text', text: "You don't have an active plan for this tool." }],
    structuredContent: {
      kind: 'payment_required',
      product: 'prd_6IAAQKHH',
      checkoutUrl: 'https://web.example/customer/checkout?id=abc',
      message: "You don't have an active plan for this tool.",
      shortMessage: 'Payment required',
      reason: 'upgrade_required',
      nextAction: 'checkout',
      ...overrides,
    },
  }
}

describe('assertPaywallGate', () => {
  it('accepts a payment_required gate', () => {
    assert.doesNotThrow(() => assertPaywallGate(gateEnvelope()))
  })

  it('accepts an activation_required gate', () => {
    assert.doesNotThrow(() =>
      assertPaywallGate(
        gateEnvelope({ kind: 'activation_required', shortMessage: 'Activation required' }),
      ),
    )
  })

  it('rejects a successful tool result that never hit the paywall', () => {
    assert.throws(
      () =>
        assertPaywallGate({
          content: [{ type: 'text', text: 'hello_tool ran' }],
          structuredContent: { ok: true, echoed: 'hello' },
        }),
      /structuredContent.kind must be one of payment_required, activation_required/,
    )
  })

  it('rejects a gate missing required recovery fields', () => {
    const envelope = gateEnvelope()
    delete envelope.structuredContent.checkoutUrl
    delete envelope.structuredContent.shortMessage
    assert.throws(
      () => assertPaywallGate(envelope),
      /missing required string fields: checkoutUrl, shortMessage/,
    )
  })

  it('rejects non-text narration', () => {
    const envelope = gateEnvelope()
    envelope.content = [{ type: 'resource', resource: {} }]
    assert.throws(() => assertPaywallGate(envelope), /text-only in content\[0\].text/)
  })
})
