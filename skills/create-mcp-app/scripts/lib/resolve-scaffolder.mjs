import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

const SCAFFOLDER_REL = 'tools/create-solvapay/scripts/mcp'
const CLI_REL = 'tools/create-solvapay/dist/cli.js'

/**
 * Warn when a stable (`@latest`) create-solvapay is resolved while a dev
 * signal is present. Dev mode is meant to run the `@preview` dist-tag
 * (which carries preview-only features like `apiKey-multi`); a stable
 * build there fails deep in `validateSelections` with a confusing
 * "`upstreamAuth.kind` must be one of …" error. Catch the mismatch early.
 * @param {string} mcpDir Absolute path to create-solvapay/scripts/mcp
 */
function warnIfStableUnderDev(mcpDir) {
  const apiBase = process.env.SOLVAPAY_API_BASE_URL ?? ''
  const devSignal = /api-dev\.solvapay\.com/.test(apiBase)
  if (!devSignal) return
  try {
    const pkgPath = join(mcpDir, '../../package.json')
    if (!existsSync(pkgPath)) return
    const { version } = require(pkgPath)
    if (version && !/-preview/.test(version)) {
      console.warn(
        `⚠ create-solvapay@${version} is a stable build, but a dev backend ` +
          `(SOLVAPAY_API_BASE_URL=${apiBase}) is configured. Dev mode expects ` +
          `the preview dist-tag. Reinstall with: npm install create-solvapay@preview`,
      )
    }
  } catch {
    // best-effort advisory only — never block resolution on it
  }
}

/**
 * @param {string} root
 * @returns {boolean}
 */
export function isValidSdkRoot(root) {
  return (
    existsSync(join(root, 'contract/manifest/repo-paths.yaml')) &&
    existsSync(join(root, SCAFFOLDER_REL, 'describe.mjs'))
  )
}

/**
 * Resolve a solvapay-sdk checkout. `SOLVAPAY_SDK_ROOT` wins and fails
 * loudly when set but not a valid checkout — no silent fallback.
 * @returns {string | undefined}
 */
export function resolveSdkRoot() {
  const override = process.env.SOLVAPAY_SDK_ROOT
  if (override) {
    const root = resolve(override)
    if (!isValidSdkRoot(root)) {
      throw new Error(
        `SOLVAPAY_SDK_ROOT=${override} is not a solvapay-sdk checkout.\n` +
          `Expected ${join(root, 'contract/manifest/repo-paths.yaml')} and ` +
          `${join(root, SCAFFOLDER_REL, 'describe.mjs')}.`,
      )
    }
    return root
  }

  const sibling = join(__dirname, '../../../../../solvapay-sdk')
  if (isValidSdkRoot(sibling)) return sibling
  return undefined
}

/** @returns {string} Absolute path to create-solvapay/scripts/mcp */
export function resolveScaffolderDir() {
  if (process.env.SCAFFOLDER_SCRIPTS_DIR) {
    const dir = process.env.SCAFFOLDER_SCRIPTS_DIR
    if (!existsSync(join(dir, 'describe.mjs'))) {
      throw new Error(
        `SCAFFOLDER_SCRIPTS_DIR=${dir} does not contain describe.mjs.\n` +
          'Point it at create-solvapay/scripts/mcp (see scripts/README.md).',
      )
    }
    warnIfStableUnderDev(dir)
    return dir
  }

  try {
    const pkg = require.resolve('create-solvapay/package.json')
    const dir = join(dirname(pkg), 'scripts/mcp')
    if (existsSync(join(dir, 'describe.mjs'))) {
      warnIfStableUnderDev(dir)
      return dir
    }
  } catch {
    // create-solvapay not installed locally
  }

  const sdkRoot = resolveSdkRoot()
  if (sdkRoot) {
    const dir = join(sdkRoot, SCAFFOLDER_REL)
    warnIfStableUnderDev(dir)
    return dir
  }

  throw new Error(
    'Could not find create-solvapay scaffolder scripts (describe.mjs / scaffold.mjs).\n' +
      'Options:\n' +
      '  1. Set SOLVAPAY_SDK_ROOT to a solvapay-sdk checkout\n' +
      '  2. Set SCAFFOLDER_SCRIPTS_DIR to create-solvapay/scripts/mcp\n' +
      '  3. npm install create-solvapay in the skill or project directory\n' +
      '  4. Clone solvapay-sdk as a sibling of this skills repo\n' +
      'See scripts/README.md for details.',
  )
}

/**
 * CLI entry for from-scratch scaffolds. Prefers the SDK checkout build.
 * @returns {string}
 */
export function resolveCreateSolvapayCli() {
  const sdkRoot = resolveSdkRoot()
  if (sdkRoot) {
    const cli = join(sdkRoot, CLI_REL)
    if (!existsSync(cli)) {
      throw new Error(
        `create-solvapay CLI missing at ${cli}.\n` +
          `Build it: (cd ${join(sdkRoot, 'tools/create-solvapay')} && pnpm build)`,
      )
    }
    return cli
  }

  try {
    const pkg = require.resolve('create-solvapay/package.json')
    const cli = join(dirname(pkg), 'dist/cli.js')
    if (existsSync(cli)) return cli
  } catch {
    // not installed
  }

  throw new Error(
    'Could not find create-solvapay CLI (dist/cli.js).\n' +
      'Set SOLVAPAY_SDK_ROOT and build tools/create-solvapay, or npm install create-solvapay.',
  )
}
