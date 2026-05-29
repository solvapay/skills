import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

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
    return dir
  }

  try {
    const pkg = require.resolve('create-solvapay/package.json')
    const dir = join(dirname(pkg), 'scripts/mcp')
    if (existsSync(join(dir, 'describe.mjs'))) return dir
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
