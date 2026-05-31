import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

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
    // mcpDir is <pkg>/scripts/mcp → package.json is two levels up.
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

  const sibling = join(
    __dirname,
    '../../../../../solvapay-sdk/packages/create-solvapay/scripts/mcp',
  )
  if (existsSync(join(sibling, 'describe.mjs'))) return sibling

  throw new Error(
    'Could not find create-solvapay scaffolder scripts (describe.mjs / scaffold.mjs).\n' +
      'Options:\n' +
      '  1. Set SCAFFOLDER_SCRIPTS_DIR to create-solvapay/scripts/mcp\n' +
      '  2. npm install create-solvapay in the skill or project directory\n' +
      '  3. Clone solvapay-sdk as a sibling of this skills repo\n' +
      'See scripts/README.md for details.',
  )
}
