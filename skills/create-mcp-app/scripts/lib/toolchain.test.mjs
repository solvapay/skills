import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getLanguage } from './languages.mjs'
import { probeLanguage } from './toolchain.mjs'

describe('ruby header probe', () => {
  it('declares a rubyhdrdir probe on the ruby row', () => {
    const ruby = getLanguage('ruby')
    assert.ok(Array.isArray(ruby.probes))
    const headers = ruby.probes.find(probe => probe.id === 'ruby-headers')
    assert.ok(headers, 'ruby row must probe interpreter headers, not just bundle')
    assert.equal(headers.command, 'ruby')
    assert.ok(headers.args.some(arg => String(arg).includes('rubyhdrdir')))
    assert.match(headers.install, /ruby-dev|ruby-devel/)
  })

  it('fails the gate when a language probe command fails', async () => {
    const result = await probeLanguage({
      id: 'ruby',
      requires: [],
      probes: [
        {
          id: 'ruby-headers',
          install: 'ruby-dev (Debian/Ubuntu) or ruby-devel (Fedora/RHEL)',
          command: 'false',
          args: [],
        },
      ],
      registry: 'https://example.invalid/solvapay',
    })
    assert.equal(result.ok, false)
    assert.equal(result.source, 'none')
    assert.match(result.line, /ruby fail missing-ruby-headers/)
    assert.match(result.line, /ruby-dev/)
  })

  it('other language rows ship an empty probes list (identical keys)', () => {
    for (const id of ['ts', 'python', 'go', 'rust']) {
      const row = getLanguage(id)
      assert.ok(Array.isArray(row.probes))
      assert.equal(row.probes.length, 0)
    }
  })
})
