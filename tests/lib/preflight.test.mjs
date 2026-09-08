import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import {
  PRODUCT_REF_REMEDIATION,
  assertProductExistsOnApi,
  assertProductRefNotPlaceholder,
} from './preflight.mjs'

describe('assertProductRefNotPlaceholder', () => {
  it('rejects the scaffold token and any placeholder ref', () => {
    assert.throws(
      () => assertProductRefNotPlaceholder('__SOLVAPAY_PRODUCT_REF__'),
      /real `prd_…`/,
    )
    assert.throws(
      () => assertProductRefNotPlaceholder('prd_abc_harness_placeholder'),
      /placeholder/i,
    )
  })

  it('accepts a real-looking product ref', () => {
    assert.doesNotThrow(() => assertProductRefNotPlaceholder('prd_abc123'))
  })
})

describe('assertProductExistsOnApi', () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it('GETs /v1/sdk/products/:ref with the secret key', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }))

    await assertProductExistsOnApi({
      apiBase: 'http://localhost:3010/',
      productRef: 'prd_real',
      secretKey: 'sk_sandbox_test',
    })

    assert.equal(fetchMock.mock.calls.length, 1)
    const [url, init] = fetchMock.mock.calls[0].arguments
    assert.equal(url, 'http://localhost:3010/v1/sdk/products/prd_real')
    assert.equal(init.headers.Authorization, 'Bearer sk_sandbox_test')
  })

  it('throws with status body and remediation on non-2xx', async () => {
    mock.method(
      globalThis,
      'fetch',
      async () => new Response('{"message":"Product not found"}', { status: 404 }),
    )

    await assert.rejects(
      () =>
        assertProductExistsOnApi({
          apiBase: 'http://localhost:3010',
          productRef: 'prd_missing',
          secretKey: 'sk_sandbox_test',
        }),
      error => {
        assert.match(String(error), /404/)
        assert.match(String(error), /Product not found/)
        assert.ok(String(error).includes(PRODUCT_REF_REMEDIATION))
        return true
      },
    )
  })
})
