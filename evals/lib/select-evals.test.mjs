import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { evalIsRunnable, expandEvalParams, selectEvals } from './select-evals.mjs'

const evalsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../create-mcp-app/evals.json',
)
const suite = JSON.parse(readFileSync(evalsPath, 'utf8'))

describe('evalIsRunnable', () => {
  it('runs evals with no requires', () => {
    assert.equal(evalIsRunnable({ id: 1 }, {}), true)
  })

  it('skips when a required env var is absent', () => {
    assert.equal(
      evalIsRunnable({ id: 14, requires: ['EVAL_REQUIRES_SDK_CHECKOUT'] }, {}),
      false,
    )
  })

  it('runs when every required env var is set', () => {
    assert.equal(
      evalIsRunnable(
        { id: 14, requires: ['EVAL_REQUIRES_SDK_CHECKOUT'] },
        { EVAL_REQUIRES_SDK_CHECKOUT: '1' },
      ),
      true,
    )
  })
})

describe('expandEvalParams', () => {
  it('returns the case unchanged when params is absent', () => {
    const one = { id: 9, slug: 'apikey-multi-one-to-one', prompt: 'fixed' }
    assert.deepEqual(expandEvalParams(one), [one])
  })

  it('expands {{placeholders}} once per params row', () => {
    const expanded = expandEvalParams({
      id: 11,
      slug: 'upstream-auth-one-to-one',
      prompt: 'generate from {{spec}} into {{target}} kind {{kind}}',
      params: [
        { kind: 'bearer', spec: 'widgets-bearer.openapi.json', target: './acme-bearer-mcp' },
        { kind: 'apiKey', spec: 'widgets-apikey.openapi.json', target: './acme-apikey-mcp' },
      ],
    })
    assert.equal(expanded.length, 2)
    assert.match(expanded[0].prompt, /widgets-bearer/)
    assert.match(expanded[1].prompt, /widgets-apikey/)
    assert.equal(expanded[0].param.kind, 'bearer')
  })
})

describe('create-mcp-app evals.json contract', () => {
  it('gates 14-17 behind EVAL_REQUIRES_SDK_CHECKOUT and skips them by default', () => {
    const gated = suite.evals.filter(item => [14, 15, 16, 17].includes(item.id))
    assert.equal(gated.length, 4)
    for (const item of gated) {
      assert.deepEqual(item.requires, ['EVAL_REQUIRES_SDK_CHECKOUT'])
      assert.ok(item.assertions.some(line => line.includes('registry-404 no-checkout')))
      assert.ok(item.assertions.some(line => /did not hand-write a substitute/i.test(line)))
    }
    const selected = selectEvals(suite.evals, {})
    assert.equal(
      selected.some(item => [14, 15, 16, 17].includes(item.id)),
      false,
    )
  })

  it('expands eval 11 across bearer, apiKey, and oauth2-client-credentials', () => {
    const auth = suite.evals.find(item => item.id === 11)
    assert.ok(auth)
    const kinds = (auth.params ?? []).map(row => row.kind)
    assert.deepEqual(kinds, ['bearer', 'apiKey', 'oauth2-client-credentials'])
    const expanded = expandEvalParams(auth)
    assert.equal(expanded.length, 3)
    assert.match(expanded[0].prompt, /widgets-bearer/)
    assert.match(expanded[1].prompt, /widgets-apikey/)
    assert.match(expanded[2].prompt, /widgets-oauth2/)
  })
})
