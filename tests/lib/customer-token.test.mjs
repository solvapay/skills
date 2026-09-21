import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { afterEach, describe, it, mock } from 'node:test'
import {
  HARNESS_CUSTOMER_EMAIL,
  HARNESS_CUSTOMER_PASSWORD,
  HARNESS_PASSWORD_HASH,
  HARNESS_REDIRECT_URI,
  createPkcePair,
  mintCustomerToken,
} from './customer-token.mjs'

const API_BASE = 'http://localhost:3010'
const RESOURCE = 'http://127.0.0.1:13030/mcp'
const INPUT = {
  apiBase: `${API_BASE}/`,
  secretKey: 'sk_sandbox_test',
  productRef: 'prd_real',
  resource: RESOURCE,
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * @param {Partial<Record<string, () => Response>>} overrides
 */
function stubStack(overrides = {}) {
  const calls = []
  const routes = {
    'GET /v1/sdk/customers': () => new Response('{"message":"Customer not found"}', { status: 404 }),
    'POST /v1/sdk/customers': () => json({ reference: 'cus_HARNESS' }),
    'PATCH /v1/sdk/customers/cus_HARNESS': () => json({ reference: 'cus_HARNESS' }),
    'POST /v1/customer/auth/register': () =>
      json({ client_id: 'client-abc', client_secret: 'secret-abc' }),
    'POST /v1/customer/auth/logins': () =>
      json({ redirectUrl: 'https://web.example/auth/customer/consent?sid=sid-123' }),
    'POST /v1/customer/auth/consent': () =>
      json({ redirectUrl: `${HARNESS_REDIRECT_URI}?code=oauth_code_1&iss=http%3A%2F%2F127.0.0.1` }),
    'POST /v1/customer/auth/token': () => json({ access_token: 'jwt-token' }),
    ...overrides,
  }
  mock.method(globalThis, 'fetch', async (url, init) => {
    const parsed = new URL(url)
    const key = `${init.method ?? 'GET'} ${parsed.pathname}`
    calls.push({ key, url: String(url), init, body: init.body ? JSON.parse(init.body) : undefined })
    const route = routes[key]
    if (!route) throw new Error(`unstubbed request: ${key}`)
    return route()
  })
  return calls
}

describe('createPkcePair', () => {
  it('produces an S256 challenge for the verifier', () => {
    const { verifier, challenge } = createPkcePair()
    assert.match(verifier, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'))
  })
})

describe('mintCustomerToken', () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it('seeds the customer then walks DCR, login, consent and token', async () => {
    const calls = stubStack()

    const token = await mintCustomerToken(INPUT)

    assert.equal(token, 'jwt-token')
    assert.deepEqual(
      calls.map(call => call.key),
      [
        'GET /v1/sdk/customers',
        'POST /v1/sdk/customers',
        'PATCH /v1/sdk/customers/cus_HARNESS',
        'POST /v1/customer/auth/register',
        'POST /v1/customer/auth/logins',
        'POST /v1/customer/auth/consent',
        'POST /v1/customer/auth/token',
      ],
    )

    const [lookup, create, patch, register, login, consent, exchange] = calls
    assert.equal(
      lookup.url,
      `${API_BASE}/v1/sdk/customers?email=${encodeURIComponent(HARNESS_CUSTOMER_EMAIL)}`,
    )
    assert.equal(create.url, `${API_BASE}/v1/sdk/customers`)
    assert.equal(create.init.headers.Authorization, 'Bearer sk_sandbox_test')
    assert.equal(create.body.email, HARNESS_CUSTOMER_EMAIL)

    assert.equal(patch.init.headers.Authorization, 'Bearer sk_sandbox_test')
    assert.deepEqual(patch.body.metadata.oauth, {
      passwordHash: HARNESS_PASSWORD_HASH,
      authProvider: 'local',
      emailVerified: true,
    })

    assert.equal(register.url, `${API_BASE}/v1/customer/auth/register?product_ref=prd_real`)
    assert.deepEqual(register.body.redirect_uris, [HARNESS_REDIRECT_URI])

    assert.equal(login.body.client_id, 'client-abc')
    assert.equal(login.body.email, HARNESS_CUSTOMER_EMAIL)
    assert.equal(login.body.password, HARNESS_CUSTOMER_PASSWORD)
    assert.equal(login.body.code_challenge_method, 'S256')

    assert.deepEqual(consent.body, { sessionKey: 'sid-123', allow: true })

    assert.equal(exchange.body.grant_type, 'authorization_code')
    assert.equal(exchange.body.code, 'oauth_code_1')
    assert.equal(
      createHash('sha256').update(exchange.body.code_verifier).digest('base64url'),
      login.body.code_challenge,
    )
  })

  it('propagates the lane-scoped resource into login and token', async () => {
    const calls = stubStack()

    await mintCustomerToken(INPUT)

    const withResource = calls.filter(call => call.body?.resource !== undefined)
    assert.deepEqual(
      withResource.map(call => call.key),
      ['POST /v1/customer/auth/logins', 'POST /v1/customer/auth/token'],
    )
    for (const call of withResource) {
      assert.equal(call.body.resource, RESOURCE)
    }
  })

  it('surfaces method, URL, status and body when DCR rejects the product', async () => {
    stubStack({
      'POST /v1/customer/auth/register': () =>
        new Response('{"message":"Product not found"}', { status: 400 }),
    })

    await assert.rejects(() => mintCustomerToken(INPUT), error => {
      assert.match(
        String(error),
        /POST http:\/\/localhost:3010\/v1\/customer\/auth\/register\?product_ref=prd_real returned 400: \{"message":"Product not found"\}/,
      )
      return true
    })
  })

  it('reuses an existing harness customer instead of re-creating it', async () => {
    const calls = stubStack({
      'GET /v1/sdk/customers': () => json({ reference: 'cus_HARNESS', email: HARNESS_CUSTOMER_EMAIL }),
    })

    await mintCustomerToken(INPUT)

    assert.equal(calls.filter(call => call.key === 'POST /v1/sdk/customers').length, 0)
    assert.ok(calls.some(call => call.key === 'PATCH /v1/sdk/customers/cus_HARNESS'))
  })

  it('surfaces a failed customer seed before any OAuth call', async () => {
    const calls = stubStack({
      'GET /v1/sdk/customers': () => new Response('unauthorized', { status: 401 }),
    })

    await assert.rejects(() => mintCustomerToken(INPUT), /returned 401: unauthorized/)
    assert.deepEqual(
      calls.map(call => call.key),
      ['GET /v1/sdk/customers'],
    )
  })

  it('fails when login returns no consent session', async () => {
    stubStack({
      'POST /v1/customer/auth/logins': () => json({}),
    })

    await assert.rejects(() => mintCustomerToken(INPUT), /logins response is missing redirectUrl/)
  })

  it('fails when the consent redirect carries no code', async () => {
    stubStack({
      'POST /v1/customer/auth/consent': () => json({ redirectUrl: HARNESS_REDIRECT_URI }),
    })

    await assert.rejects(() => mintCustomerToken(INPUT), /consent URL is missing \?code/)
  })

  it('fails when the token response has no access_token', async () => {
    stubStack({
      'POST /v1/customer/auth/token': () => json({ token_type: 'Bearer' }),
    })

    await assert.rejects(() => mintCustomerToken(INPUT), /token response is missing access_token/)
  })
})
