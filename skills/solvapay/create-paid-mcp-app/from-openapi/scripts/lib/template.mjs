/* global console */
/**
 * Shared template-copy helpers for `scaffold.mjs`.
 *
 * Provides:
 *   - copyDir(src, dest, { substitutions, skipPaths }) — recursive copy
 *     with placeholder substitution applied to text files.
 *   - substitute(content, table) — straight string replacement using a
 *     `Map<placeholder, value>`.
 *   - PLACEHOLDERS — the literal strings the template ships with that
 *     scaffold replaces at copy time. The full list lives in
 *     `references/tool-template.md` and is the source of truth.
 *
 * Substitution is intentionally string-replace (not template-string
 * interpolation): the template files are valid TypeScript / JSON on
 * their own, so editors and CI lint them without scaffold ever having
 * run.
 */

import { mkdir, readdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

/**
 * Literal placeholder strings the template ships with. `scaffold.mjs`
 * substitutes these with values from `selections.json` while copying.
 *
 * Kept here so the template + scaffold contract is observable in code
 * (see also `references/tool-template.md`).
 */
export const PLACEHOLDERS = Object.freeze({
  WORKER_NAME: '__WORKER_NAME__',
  RESOURCE_URI_SLUG: '__RESOURCE_URI_SLUG__',
  PRODUCT_REF: '__SOLVAPAY_PRODUCT_REF__',
  PUBLIC_BASE_URL: '__MCP_PUBLIC_BASE_URL__',
})

/**
 * Recursively copy `src` to `dest`. Text files (any file whose
 * extension is in `TEXT_EXTENSIONS` or which has no extension) get
 * placeholder substitution. Binary / unknown files are byte-copied.
 *
 * `skipPaths` is a set of paths (relative to `src`, forward-slash) the
 * caller wants to omit — used to drop the template's example tool when
 * generating into a clean target.
 */
export async function copyDir(src, dest, { substitutions = new Map(), skipPaths = new Set() } = {}) {
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const relPath = relative(src, srcPath).replaceAll('\\', '/')
    if (skipPaths.has(relPath)) continue
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, {
        substitutions,
        skipPaths: scopeSkipPaths(skipPaths, relPath),
      })
      continue
    }
    if (isTextFile(entry.name)) {
      const content = await readFile(srcPath, 'utf8')
      await mkdir(dirname(destPath), { recursive: true })
      await writeFile(destPath, substitute(content, substitutions), 'utf8')
    } else {
      await mkdir(dirname(destPath), { recursive: true })
      await copyFile(srcPath, destPath)
    }
  }
}

/**
 * Straight string-replace for every entry in `table`. No regex, no
 * escape handling — placeholders are required to be uniquely shaped
 * (e.g. `__WORKER_NAME__`).
 */
export function substitute(content, table) {
  let out = content
  for (const [placeholder, value] of table) {
    if (typeof value !== 'string') continue
    out = out.split(placeholder).join(value)
  }
  return out
}

/**
 * Hard-fail if `target` exists. Scaffold is non-idempotent in v1 —
 * users iterate on `selections.json` and re-run into a fresh
 * directory. Idempotent regeneration is an open follow-up.
 */
export async function assertTargetDirAbsent(target) {
  try {
    await stat(target)
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'ENOENT') return
    throw err
  }
  throw new Error(
    `Refusing to write into existing directory: ${target}. Delete it or pick a fresh target path.`,
  )
}

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.md',
  '.txt',
  '.html',
  '.css',
  '.yaml',
  '.yml',
  '.toml',
  '.env',
  '.example',
])

function isTextFile(name) {
  if (!name.includes('.')) return true
  const lower = name.toLowerCase()
  if (lower.endsWith('.env.example')) return true
  if (lower.startsWith('.env')) return true
  if (lower === '.gitignore' || lower === '.gitattributes') return true
  const dot = lower.lastIndexOf('.')
  return TEXT_EXTENSIONS.has(lower.slice(dot))
}

function scopeSkipPaths(skipPaths, dirRelPath) {
  // Re-scope skipPaths to the subdirectory we're about to recurse into:
  // an entry `src/tools/example.ts` becomes `tools/example.ts` once we
  // step into `src/`.
  const scoped = new Set()
  const prefix = `${dirRelPath}/`
  for (const path of skipPaths) {
    if (path === dirRelPath) continue
    if (path.startsWith(prefix)) scoped.add(path.slice(prefix.length))
  }
  return scoped
}
