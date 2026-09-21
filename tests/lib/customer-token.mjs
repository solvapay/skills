import { createHash, randomBytes } from 'node:crypto'

/**
 * Mints a customer OAuth bearer for a lane server.
 *
 * The scaffolded servers verify no signature locally: they hand the token to
 * `GET /v1/customer/auth/userinfo` and then re-check the decoded claims, so the
 * token must carry `iss = {lane origin}` and `aud = {lane origin}/mcp`. Platform
 * derives both from the OAuth `resource` parameter, which is why every step below
 * that accepts `resource` gets the lane-scoped value.
 */

export const HARNESS_CUSTOMER_EMAIL = 'harness+e2e@solvapay.test'
export const HARNESS_CUSTOMER_PASSWORD = 'solvapay-harness-password'
const HARNESS_CUSTOMER_NAME = 'SolvaPay skills harness'
const HARNESS_CUSTOMER_EXTERNAL_REF = 'solvapay-skills-e2e-harness'

/**
 * bcrypt cost-10 digest of HARNESS_CUSTOMER_PASSWORD. Customer login compares
 * against `metadata.oauth.passwordHash` and there is no public customer-signup
 * API, so the harness plants a known digest rather than depending on bcrypt.
 */
export const HARNESS_PASSWORD_HASH =
  '$2b$10$BgHEGmwb8tCFXD/GZqZh8OnSF1wWv4HOSt0wXNL42U/3KaP6r.mga'

/**
 * Fixed loopback callback. It is never fetched — the harness reads the code out
 * of the consent redirect — but DCR merges every new URI onto the provider's MCP
 * client, so one constant keeps that list from growing per lane.
 */
export const HARNESS_REDIRECT_URI = 'http://127.0.0.1:8765/solvapay-harness-callback'

/**
 * @param {string} apiBase
 */
function origin(apiBase) {
  return apiBase.replace(/\/$/, '')
}

/**
 * @param {string} url
 * @param {RequestInit} init
 * @param {{ nullOn404?: boolean }} [options]
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function requestJson(url, init, options = {}) {
  const method = init.method ?? 'GET'
  let response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  } catch (error) {
    throw new Error(
      `${method} ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (options.nullOn404 && response.status === 404) return null
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${method} ${url} returned ${response.status}: ${text}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${method} ${url} returned ${response.status} with non-JSON body: ${text}`)
  }
}

/**
 * @param {Record<string, unknown>} body
 */
function jsonInit(method, body, headers = {}) {
  return {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} key
 * @param {string} label
 * @returns {string}
 */
function requireString(payload, key, label) {
  const value = payload[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} response is missing ${key}: ${JSON.stringify(payload)}`)
  }
  return value
}

/**
 * @param {string} rawUrl
 * @param {string} param
 * @param {string} label
 * @returns {string}
 */
function requireUrlParam(rawUrl, param, label) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error(`${label} returned an unparseable URL: ${rawUrl}`)
  }
  const value = parsed.searchParams.get(param)
  if (!value) {
    throw new Error(`${label} URL is missing ?${param}: ${rawUrl}`)
  }
  return value
}

/**
 * Get-or-create. Looking the customer up by email first keeps the harness usable
 * on a stack that already holds a harness record whose `externalRef` predates the
 * current constant — `createOrLinkForSdk` 409s on that mismatch forever.
 *
 * @param {{ apiBase: string, secretKey: string }} input
 * @returns {Promise<string>} customer reference
 */
export async function seedHarnessCustomer({ apiBase, secretKey }) {
  const base = origin(apiBase)
  const auth = { Authorization: `Bearer ${secretKey}` }
  const lookupUrl = `${base}/v1/sdk/customers?email=${encodeURIComponent(HARNESS_CUSTOMER_EMAIL)}`
  const existing = await requestJson(
    lookupUrl,
    { method: 'GET', headers: auth },
    { nullOn404: true },
  )
  const customer =
    existing ??
    (await requestJson(
      `${base}/v1/sdk/customers`,
      jsonInit(
        'POST',
        {
          email: HARNESS_CUSTOMER_EMAIL,
          name: HARNESS_CUSTOMER_NAME,
          externalRef: HARNESS_CUSTOMER_EXTERNAL_REF,
        },
        auth,
      ),
    ))
  const reference = requireString(
    customer,
    'reference',
    `customer lookup for ${HARNESS_CUSTOMER_EMAIL}`,
  )

  // Metadata writes deep-merge through dot-notation, so sibling keys survive.
  await requestJson(
    `${base}/v1/sdk/customers/${encodeURIComponent(reference)}`,
    jsonInit(
      'PATCH',
      {
        metadata: {
          oauth: {
            passwordHash: HARNESS_PASSWORD_HASH,
            authProvider: 'local',
            emailVerified: true,
          },
        },
      },
      auth,
    ),
  )
  return reference
}

/**
 * Dynamic client registration for the harness. Loopback redirect URIs are
 * explicitly allowed by `isMcpDcrRedirectUriAllowed`.
 *
 * @param {{ apiBase: string, productRef: string }} input
 * @returns {Promise<{ clientId: string, clientSecret: string }>}
 */
export async function registerHarnessClient({ apiBase, productRef }) {
  const url = `${origin(apiBase)}/v1/customer/auth/register?product_ref=${encodeURIComponent(productRef)}`
  const registered = await requestJson(
    url,
    jsonInit('POST', {
      client_name: 'solvapay-skills-harness',
      redirect_uris: [HARNESS_REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }),
  )
  return {
    clientId: requireString(registered, 'client_id', 'POST /v1/customer/auth/register'),
    clientSecret: requireString(registered, 'client_secret', 'POST /v1/customer/auth/register'),
  }
}

/**
 * @returns {{ verifier: string, challenge: string }}
 */
export function createPkcePair() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/**
 * @param {{ apiBase: string, secretKey: string, productRef: string, resource: string }} input
 * @returns {Promise<string>} access token bound to `resource`
 */
export async function mintCustomerToken({ apiBase, secretKey, productRef, resource }) {
  const base = origin(apiBase)
  await seedHarnessCustomer({ apiBase, secretKey })
  const { clientId, clientSecret } = await registerHarnessClient({ apiBase, productRef })
  const { verifier, challenge } = createPkcePair()

  const login = await requestJson(
    `${base}/v1/customer/auth/logins`,
    jsonInit('POST', {
      client_id: clientId,
      redirect_uri: HARNESS_REDIRECT_URI,
      email: HARNESS_CUSTOMER_EMAIL,
      password: HARNESS_CUSTOMER_PASSWORD,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource,
    }),
  )
  const sessionKey = requireUrlParam(
    requireString(login, 'redirectUrl', 'POST /v1/customer/auth/logins'),
    'sid',
    'POST /v1/customer/auth/logins',
  )

  const consent = await requestJson(
    `${base}/v1/customer/auth/consent`,
    jsonInit('POST', { sessionKey, allow: true }),
  )
  const code = requireUrlParam(
    requireString(consent, 'redirectUrl', 'POST /v1/customer/auth/consent'),
    'code',
    'POST /v1/customer/auth/consent',
  )

  const token = await requestJson(
    `${base}/v1/customer/auth/token`,
    jsonInit('POST', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: HARNESS_REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: verifier,
      resource,
    }),
  )
  return requireString(token, 'access_token', 'POST /v1/customer/auth/token')
}
