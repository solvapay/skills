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
 * Uniform gate: binaries present, then language probes (e.g. Ruby headers),
 * then a checkout wins, else the registry.
 *
 * Precedence is checkout-before-registry on purpose. A local solvapay-sdk
 * checkout is the local-only source of truth: when one is present the skill
 * must scaffold with `--dev` (path deps) against it, so the checkout has to
 * win the lane decision even when the registry is also reachable. Otherwise a
 * present, valid checkout would still print `ok registry` and the agent would
 * scaffold into the published lane (F2). An invalid `SOLVAPAY_SDK_ROOT` is a
 * hard error — never a silent fall-through to the registry.
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

  for (const probe of language.probes ?? []) {
    try {
      execFileSync(probe.command, [...probe.args], { stdio: 'ignore' })
    } catch {
      return {
        id: language.id,
        ok: false,
        source: 'none',
        line: `${language.id} fail missing-${probe.id} ${probe.install}`,
      }
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

  const published = await registryReachable(language.registry)
  if (published) {
    return {
      id: language.id,
      ok: true,
      source: 'registry',
      line: `${language.id} ok registry`,
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
