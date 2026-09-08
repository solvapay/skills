import { execFileSync } from 'node:child_process'
import { LANGUAGES } from './languages.mjs'
import { resolveSdkRoot } from './resolve-scaffolder.mjs'

/**
 * @param {string} bin
 * @returns {boolean}
 */
export function hasBin(bin) {
  try {
    execFileSync('sh', ['-c', `command -v ${bin}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function registryReachable(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Uniform gate: binaries present, then registry or checkout fallback.
 * @param {import('./languages.mjs').LanguageRow} language
 * @returns {Promise<{ id: string, ok: boolean, source: 'registry' | 'checkout' | 'none', line: string }>}
 */
export async function probeLanguage(language) {
  const missing = language.requires.filter(req => !hasBin(req.bin))
  if (missing.length > 0) {
    const detail = missing.map(req => `${req.bin} (${req.install})`).join(', ')
    return {
      id: language.id,
      ok: false,
      source: 'none',
      line: `${language.id} fail missing-bin ${detail}`,
    }
  }

  const published = await registryReachable(language.registry)
  if (published) {
    return {
      id: language.id,
      ok: true,
      source: 'registry',
      line: `${language.id} ok registry`,
    }
  }

  let sdkRoot
  try {
    sdkRoot = resolveSdkRoot()
  } catch (error) {
    return {
      id: language.id,
      ok: false,
      source: 'none',
      line: `${language.id} fail ${error instanceof Error ? error.message.split('\n')[0] : error}`,
    }
  }

  if (sdkRoot) {
    return {
      id: language.id,
      ok: true,
      source: 'checkout',
      line: `${language.id} ok checkout`,
    }
  }

  return {
    id: language.id,
    ok: false,
    source: 'none',
    line: `${language.id} fail registry-404 no-checkout`,
  }
}

/**
 * @param {string | undefined} onlyId
 * @returns {Promise<Awaited<ReturnType<typeof probeLanguage>>[]>}
 */
export async function probeLanguages(onlyId) {
  const rows = onlyId ? LANGUAGES.filter(row => row.id === onlyId) : [...LANGUAGES]
  if (onlyId && rows.length === 0) {
    throw new Error(`Unknown language '${onlyId}'`)
  }
  return Promise.all(rows.map(probeLanguage))
}
