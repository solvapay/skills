import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { writeWranglerLocalBindings } from './scaffold.mjs'

const temps = []

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop(), { recursive: true, force: true })
  }
})

describe('writeWranglerLocalBindings', () => {
  it('writes .dev.vars and replaces wrangler.jsonc placeholders', () => {
    const dir = mkdtempSync(join(os.tmpdir(), 'wrangler-bind-'))
    temps.push(dir)
    writeFileSync(
      join(dir, 'wrangler.jsonc'),
      `{
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "SOLVAPAY_PRODUCT_REF": "__SOLVAPAY_PRODUCT_REF__",
    "MCP_PUBLIC_BASE_URL": "http://localhost:8787"
  }
}
`,
    )
    writeWranglerLocalBindings(dir, {
      secretKey: 'sk_sandbox_test',
      productRef: 'prd_real',
      apiBase: 'http://localhost:3010',
      publicBaseUrl: 'http://127.0.0.1:8787',
    })
    const vars = readFileSync(join(dir, '.dev.vars'), 'utf8')
    assert.match(vars, /SOLVAPAY_SECRET_KEY=sk_sandbox_test/)
    assert.match(vars, /SOLVAPAY_PRODUCT_REF=prd_real/)
    const wrangler = readFileSync(join(dir, 'wrangler.jsonc'), 'utf8')
    assert.match(wrangler, /"SOLVAPAY_PRODUCT_REF": "prd_real"/)
    assert.match(wrangler, /"MCP_PUBLIC_BASE_URL": "http:\/\/127.0.0.1:8787"/)
    assert.match(wrangler, /"SOLVAPAY_API_BASE_URL": "http:\/\/localhost:3010"/)
    assert.match(wrangler, /"@solvapay\/server": "\.\/node_modules\/@solvapay\/server\/dist\/edge\.js"/)
    assert.doesNotMatch(wrangler, /__SOLVAPAY_PRODUCT_REF__/)
  })
})
