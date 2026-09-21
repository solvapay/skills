import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const name = 'scaffold-shape'
export const scope = 'lane'

const PLACEHOLDER = /__PLACEHOLDER__|__TOOL_NAME__|__SERVER_NAME__|__PYTHON_PACKAGE__|__RUBY_MODULE__|__GO_MODULE__|__CRATE_NAME__/

/**
 * @param {{ language: import('../../skills/create-mcp-app/scripts/lib/languages.mjs').LanguageRow, workspace: string, scaffoldLog: string }} ctx
 */
export async function run(ctx) {
  const { language, workspace } = ctx
  for (const rel of language.expectFiles) {
    const path = join(workspace, rel)
    if (!existsSync(path)) {
      throw new Error(`missing ${rel}`)
    }
  }

  const leftover = findPlaceholders(workspace)
  if (leftover.length > 0) {
    throw new Error(`unresolved placeholders: ${leftover.slice(0, 8).join(', ')}`)
  }

  const manifest = readFileSync(join(workspace, language.manifest), 'utf8')
  const hasPathDep = language.pathDepMarker.test(manifest)
  if (language.pathDepOnCheckout && !hasPathDep) {
    throw new Error(`${language.manifest} missing path-dep marker (checkout lane)`)
  }
  if (!language.pathDepOnCheckout && hasPathDep) {
    throw new Error(`${language.manifest} has unexpected path-dep marker`)
  }
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function findPlaceholders(dir) {
  const hits = []
  walk(dir, rel => {
    if (rel.includes('node_modules') || rel.includes('.venv') || rel.includes('target/')) return
    const path = join(dir, rel)
    if (!statSync(path).isFile()) return
    if (/\.(png|woff2?|lock)$/.test(rel)) return
    const raw = readFileSync(path, 'utf8')
    if (PLACEHOLDER.test(raw)) hits.push(rel)
  })
  return hits
}

/**
 * @param {string} root
 * @param {(rel: string) => void} visit
 */
function walk(root, visit, rel = '') {
  const here = rel ? join(root, rel) : root
  for (const entry of readdirSync(here)) {
    const child = rel ? join(rel, entry) : entry
    const path = join(root, child)
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules' || entry === '.venv' || entry === '.git' || entry === 'target') {
        continue
      }
      walk(root, visit, child)
    } else {
      visit(child)
    }
  }
}
