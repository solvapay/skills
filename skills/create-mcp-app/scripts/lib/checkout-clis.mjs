import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const CHECKOUT_CLIS = [
  { srcDir: 'tools/create-solvapay/src', distFile: 'tools/create-solvapay/dist/cli.js' },
  { srcDir: 'tools/cli/src', distFile: 'tools/cli/dist/cli.js' },
  { srcDir: 'tools/init/src', distFile: 'tools/init/dist/index.js' },
]

const BUILD_HINT = `Build the checkout CLIs:
  pnpm --filter create-solvapay --filter solvapay --filter @solvapay/init build`

/**
 * @param {string} dir
 * @returns {number}
 */
function newestMtimeMs(dir) {
  let newest = 0
  const walk = path => {
    const st = statSync(path)
    if (st.isDirectory()) {
      for (const name of readdirSync(path)) {
        walk(join(path, name))
      }
      return
    }
    if (st.mtimeMs > newest) newest = st.mtimeMs
  }
  walk(dir)
  return newest
}

/**
 * Require create-solvapay, solvapay, and @solvapay/init dists to exist and
 * be at least as new as their package `src/` trees.
 * @param {string} sdkRoot
 */
export function assertCheckoutClisCurrent(sdkRoot) {
  for (const entry of CHECKOUT_CLIS) {
    const distPath = join(sdkRoot, entry.distFile)
    const srcPath = join(sdkRoot, entry.srcDir)
    if (!existsSync(distPath)) {
      throw new Error(`Missing ${entry.distFile}.\n${BUILD_HINT}`)
    }
    if (!existsSync(srcPath)) {
      throw new Error(`Missing ${entry.srcDir}.\n${BUILD_HINT}`)
    }
    if (statSync(distPath).mtimeMs < newestMtimeMs(srcPath)) {
      throw new Error(`Stale ${entry.distFile} (older than ${entry.srcDir}).\n${BUILD_HINT}`)
    }
  }
}
