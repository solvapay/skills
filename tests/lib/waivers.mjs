import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @param {import('./surfaces.mjs').TestSurface} surface
 * @param {string} caseName
 * @returns {import('./surfaces.mjs').Waiver[]}
 */
export function waiversFor(surface, caseName) {
  return [...surface.waivers.filter(waiver => waiver.provesAt === caseName)]
}

/**
 * @param {{ status: string, error?: string }} unpatchedResult
 * @param {import('./surfaces.mjs').Waiver[]} waivers
 * @returns {{ kind: 'stale' } | { kind: 'unknown', text: string } | { kind: 'expected', matched: import('./surfaces.mjs').Waiver[] }}
 */
export function classifyProbe(unpatchedResult, waivers) {
  if (unpatchedResult.status !== 'failed') {
    return { kind: 'stale' }
  }
  const text = unpatchedResult.error ?? ''
  const matched = waivers.filter(waiver => waiver.failureMatch.test(text))
  if (matched.length === 0) {
    return { kind: 'unknown', text }
  }
  return { kind: 'expected', matched }
}

/**
 * @param {string} workspace
 * @param {import('./surfaces.mjs').Waiver[]} waivers
 * @returns {{ id: string, version: string | null }[]}
 */
export function probeVersions(workspace, waivers) {
  return waivers.map(waiver => ({
    id: waiver.id,
    version: waiver.versionProbe ? readVersion(workspace, waiver.versionProbe) : null,
  }))
}

/**
 * Self-expire waivers whose claimed gap is gone. Runs on every lane, not only
 * `--probe-waivers`, so a published package or newly shipped export fails the
 * case instead of staying patched forever.
 *
 * @param {string} workspace
 * @param {import('./surfaces.mjs').Waiver[]} waivers
 */
export async function evaluateWaiverExpiry(workspace, waivers) {
  for (const waiver of waivers) {
    if (waiver.registryProbe) {
      await assertRegistryStillMissing(waiver)
    }
    if (waiver.exportProbe) {
      assertExportStillMissing(workspace, waiver)
    }
  }
}

/**
 * @param {import('./surfaces.mjs').Waiver} waiver
 */
async function assertRegistryStillMissing(waiver) {
  const probe = waiver.registryProbe
  if (!probe?.url || probe.expectMissing !== true) {
    throw new Error(`waiver ${waiver.id} registryProbe needs url and expectMissing: true`)
  }
  let response
  try {
    response = await fetch(probe.url, {
      headers: { accept: 'application/json', 'user-agent': 'solvapay-skills-e2e' },
    })
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    throw new Error(`waiver ${waiver.id} registryProbe failed: ${text}`)
  }
  if (response.status === 404) return
  if (response.ok) {
    throw new Error(
      `waiver stale: the package now publishes — delete the waiver and the stub`,
    )
  }
  throw new Error(
    `waiver ${waiver.id} registryProbe unexpected HTTP ${response.status} from ${probe.url}`,
  )
}

/**
 * @param {string} workspace
 * @param {import('./surfaces.mjs').Waiver} waiver
 */
function assertExportStillMissing(workspace, waiver) {
  const probe = waiver.exportProbe
  if (!probe?.file || !probe.subpath || probe.expectMissing !== true) {
    throw new Error(
      `waiver ${waiver.id} exportProbe needs file, subpath, and expectMissing: true`,
    )
  }
  const path = join(workspace, probe.file)
  if (!existsSync(path)) {
    throw new Error(`exportProbe file missing: ${probe.file}`)
  }
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  const exportsField = pkg && typeof pkg === 'object' ? pkg.exports : undefined
  const present =
    exportsField !== null &&
    typeof exportsField === 'object' &&
    Object.prototype.hasOwnProperty.call(exportsField, probe.subpath)
  if (present) {
    throw new Error(
      `waiver stale: ${probe.file} now exports ${probe.subpath} — delete the waiver`,
    )
  }
}

/**
 * @param {string} workspace
 * @param {import('./surfaces.mjs').VersionProbe} probe
 * @returns {string}
 */
function readVersion(workspace, probe) {
  const path = join(workspace, probe.file)
  if (!existsSync(path)) {
    throw new Error(`versionProbe file missing: ${probe.file}`)
  }
  const raw = readFileSync(path, 'utf8')
  if (probe.json) {
    const data = JSON.parse(raw)
    const value = probe.json.split('.').reduce((acc, key) => {
      if (acc === null || acc === undefined || typeof acc !== 'object') return undefined
      return acc[key]
    }, data)
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`versionProbe json path '${probe.json}' missing in ${probe.file}`)
    }
    return value
  }
  if (probe.regex) {
    const match = raw.match(probe.regex)
    const value = match?.[1]
    if (!value) {
      throw new Error(`versionProbe regex did not match ${probe.file}`)
    }
    return value
  }
  throw new Error(`versionProbe on ${probe.file} needs json or regex`)
}

/**
 * @param {string} resolved
 * @param {string} observedAgainst
 * @returns {boolean}
 */
export function versionMayBeStale(resolved, observedAgainst) {
  const a = parseSemver(resolved)
  const b = parseSemver(observedAgainst)
  if (!a || !b) return resolved !== observedAgainst
  if (a[0] !== b[0]) return a[0] > b[0]
  if (a[1] !== b[1]) return a[1] > b[1]
  return a[2] > b[2]
}

/**
 * @param {string} raw
 * @returns {[number, number, number] | null}
 */
function parseSemver(raw) {
  const match = raw.trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}
