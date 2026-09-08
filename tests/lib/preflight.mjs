import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertCheckoutClisCurrent } from '../../skills/create-mcp-app/scripts/lib/checkout-clis.mjs'
import { isValidSdkRoot } from '../../skills/create-mcp-app/scripts/lib/resolve-scaffolder.mjs'
import { probeLanguage } from '../../skills/create-mcp-app/scripts/lib/toolchain.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../..')
const ENV_LOCAL = join(REPO_ROOT, 'tests/.env.local')

const REQUIRED = [
  'SOLVAPAY_API_BASE_URL',
  'SOLVAPAY_SECRET_KEY',
  'SOLVAPAY_PRODUCT_REF',
  'SOLVAPAY_SDK_ROOT',
]

/**
 * @param {string} raw
 * @returns {Record<string, string>}
 */
function parseEnv(raw) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function loadEnvLocal() {
  if (!existsSync(ENV_LOCAL)) return
  const parsed = parseEnv(readFileSync(ENV_LOCAL, 'utf8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function requireEnv() {
  const missing = REQUIRED.filter(key => !process.env[key] || !process.env[key].trim())
  if (missing.length === 0) return
  throw new Error(
    `Missing required env: ${missing.join(', ')}.\n` +
      `Set them in the environment or create gitignored tests/.env.local.\n` +
      `Remediation:\n` +
      `  1. Start the local stack: (cd ../platform && ./scripts/dev.sh start)\n` +
      `  2. Open the provider console at http://localhost:3010 and create a sandbox secret key + product\n` +
      `  3. Write tests/.env.local:\n` +
      `       SOLVAPAY_API_BASE_URL=http://localhost:3010\n` +
      `       SOLVAPAY_SECRET_KEY=sk_sandbox_...\n` +
      `       SOLVAPAY_PRODUCT_REF=prd_...\n` +
      `       SOLVAPAY_SDK_ROOT=/absolute/path/to/solvapay-sdk`,
  )
}

export const PRODUCT_REF_PLACEHOLDER = '__SOLVAPAY_PRODUCT_REF__'

export const PRODUCT_REF_REMEDIATION =
  'Open the provider console at http://localhost:3010 and put a real `prd_…` in tests/.env.local.'

/**
 * @param {string} productRef
 */
export function assertProductRefNotPlaceholder(productRef) {
  const ref = productRef.trim()
  if (ref === PRODUCT_REF_PLACEHOLDER || /placeholder/i.test(ref)) {
    throw new Error(
      `SOLVAPAY_PRODUCT_REF=${ref} is a placeholder, not a product on the local API.\n` +
        PRODUCT_REF_REMEDIATION,
    )
  }
}

/**
 * @param {{ apiBase: string, productRef: string, secretKey: string }} opts
 */
export async function assertProductExistsOnApi({ apiBase, productRef, secretKey }) {
  const origin = apiBase.replace(/\/$/, '')
  const url = `${origin}/v1/sdk/products/${encodeURIComponent(productRef)}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secretKey}` },
    signal: AbortSignal.timeout(8_000),
  })
  if (response.ok) return
  const body = await response.text()
  throw new Error(
    `GET ${url} returned ${response.status}: ${body}\n` +
      `SOLVAPAY_PRODUCT_REF must resolve on the local stack.\n` +
      PRODUCT_REF_REMEDIATION,
  )
}

async function probeStack(baseUrl) {
  const url = baseUrl.replace(/\/$/, '')
  try {
    await fetch(url, { signal: AbortSignal.timeout(5_000) })
  } catch (error) {
    throw new Error(
      `Local stack is not reachable at ${baseUrl} (${error instanceof Error ? error.message : error}).\n` +
        `Start it with: (cd ../platform && ./scripts/dev.sh start)\n` +
        `SDK traffic must go through http://localhost:3010 — never :3001.`,
    )
  }
}

/**
 * @param {import('../../skills/create-mcp-app/scripts/lib/languages.mjs').LanguageRow[]} languages
 */
export async function preflight(languages) {
  loadEnvLocal()
  requireEnv()

  const sdkRoot = process.env.SOLVAPAY_SDK_ROOT
  if (!sdkRoot || !isValidSdkRoot(sdkRoot)) {
    throw new Error(
      `SOLVAPAY_SDK_ROOT=${sdkRoot ?? ''} is not a solvapay-sdk checkout.\n` +
        'Point it at the repo that contains contract/manifest/repo-paths.yaml.',
    )
  }
  assertCheckoutClisCurrent(sdkRoot)

  const apiBase = process.env.SOLVAPAY_API_BASE_URL
  const productRef = process.env.SOLVAPAY_PRODUCT_REF
  const secretKey = process.env.SOLVAPAY_SECRET_KEY
  assertProductRefNotPlaceholder(productRef)
  await probeStack(apiBase)
  await assertProductExistsOnApi({ apiBase, productRef, secretKey })

  for (const language of languages) {
    const gate = await probeLanguage(language)
    if (!gate.ok) {
      throw new Error(`Toolchain gate failed: ${gate.line}`)
    }
  }

  return {
    apiBase,
    secretKey,
    productRef,
    sdkRoot,
    credentialsFile: process.env.MCP_TEST_CREDENTIALS_FILE,
  }
}
