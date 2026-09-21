import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { pathReinstallArgs, stubPackageSpec } from './scaffold.mjs'

const temps = []

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop(), { recursive: true, force: true })
  }
})

describe('stubPackageSpec', () => {
  it('uses the checkout package when checkoutRel is set', () => {
    const sdkRoot = mkdtempSync(join(os.tmpdir(), 'sdk-root-'))
    temps.push(sdkRoot)
    const wasmDir = join(sdkRoot, 'sdks/wasm')
    mkdirSync(wasmDir, { recursive: true })
    writeFileSync(join(wasmDir, 'package.json'), '{"name":"@solvapay/server-wasm"}\n')
    const spec = stubPackageSpec(
      { id: 'ts-server-wasm-stub', name: '@solvapay/server-wasm', checkoutRel: 'sdks/wasm' },
      sdkRoot,
    )
    assert.equal(spec, `file:${wasmDir}`)
  })
})

describe('pathReinstallArgs', () => {
  it('appends --reinstall-package for each checkout path dep', () => {
    assert.deepEqual(
      pathReinstallArgs({
        install: { command: 'uv', args: ['sync'] },
        reinstallPackages: ['solvapay-mcp', 'solvapay'],
      }),
      ['sync', '--reinstall-package', 'solvapay-mcp', '--reinstall-package', 'solvapay'],
    )
  })
})
