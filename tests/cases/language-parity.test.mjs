import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LANGUAGES } from '../../skills/create-mcp-app/scripts/lib/languages.mjs'
import {
  LANGUAGE_H2_SKELETON,
  LANGUAGE_IDS,
  LANE_CASES,
  SURFACES,
} from '../lib/surfaces.mjs'
import { classifyProbe, evaluateWaiverExpiry } from '../lib/waivers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../..')
const LANG_DIR = join(REPO_ROOT, 'skills/create-mcp-app/references/languages')
const SCAN_DIRS = [join(REPO_ROOT, 'tests/lib'), join(REPO_ROOT, 'tests/cases')]
const SKIP_FILES = new Set(['surfaces.mjs'])

const LANE_BRANCH =
  /(?:language\.id|lane\.id|surface\.id)\s*===?\s*['"](?:ts|python|ruby|go|rust)['"]|===\s*['"](?:ts|python|ruby|go|rust)['"]/

const WAIVER_FIELDS = ['id', 'kind', 'reason', 'ref', 'provesAt', 'failureMatch']

export const name = 'language-parity'
export const scope = 'once'

export async function run() {
  assertIdenticalKeys(LANGUAGES, 'language')
  assertIdenticalKeys(SURFACES, 'surface')

  const shippedIds = [...LANGUAGES.map(row => row.id)].sort().join(',')
  const surfaceIds = [...SURFACES.map(row => row.id)].sort().join(',')
  const declaredIds = [...LANGUAGE_IDS].sort().join(',')
  if (shippedIds !== declaredIds) {
    throw new Error(`LANGUAGE_IDS [${declaredIds}] != shipped LANGUAGES [${shippedIds}]`)
  }
  if (surfaceIds !== declaredIds) {
    throw new Error(`LANGUAGE_IDS [${declaredIds}] != test SURFACES [${surfaceIds}]`)
  }

  const seenWaiverIds = new Set()
  for (const surface of SURFACES) {
    for (const waiver of surface.waivers) {
      for (const field of WAIVER_FIELDS) {
        if (waiver[field] === undefined || waiver[field] === '') {
          throw new Error(`waiver on ${surface.id} is missing ${field}`)
        }
      }
      if (waiver.kind !== 'patch' && waiver.kind !== 'stub') {
        throw new Error(`waiver ${waiver.id} has unknown kind '${waiver.kind}'`)
      }
      if (!(waiver.failureMatch instanceof RegExp)) {
        throw new Error(`waiver ${waiver.id} failureMatch must be a RegExp`)
      }
      if (!LANE_CASES.includes(waiver.provesAt)) {
        throw new Error(
          `waiver ${waiver.id} provesAt '${waiver.provesAt}' is not a lane case (${LANE_CASES.join(', ')})`,
        )
      }
      if (seenWaiverIds.has(waiver.id)) {
        throw new Error(`duplicate waiver id '${waiver.id}'`)
      }
      seenWaiverIds.add(waiver.id)
      if (waiver.registryProbe) {
        if (!waiver.registryProbe.url || waiver.registryProbe.expectMissing !== true) {
          throw new Error(`waiver ${waiver.id} registryProbe needs url and expectMissing: true`)
        }
      }
      if (waiver.exportProbe) {
        if (
          !waiver.exportProbe.file ||
          !waiver.exportProbe.subpath ||
          waiver.exportProbe.expectMissing !== true
        ) {
          throw new Error(
            `waiver ${waiver.id} exportProbe needs file, subpath, and expectMissing: true`,
          )
        }
      }
    }
  }

  const probeWaivers = [{ id: 'sample', failureMatch: /declared-breakage/ }]
  if (classifyProbe({ status: 'passed' }, probeWaivers).kind !== 'stale') {
    throw new Error('classifyProbe must report stale when the unpatched case passes')
  }
  if (classifyProbe({ status: 'failed', error: 'other boom' }, probeWaivers).kind !== 'unknown') {
    throw new Error('classifyProbe must report unknown when failureMatch misses')
  }
  if (
    classifyProbe({ status: 'failed', error: 'declared-breakage here' }, probeWaivers).kind !==
    'expected'
  ) {
    throw new Error('classifyProbe must report expected when failureMatch hits')
  }

  const exportDir = mkdtempSync(join(tmpdir(), 'waiver-export-'))
  try {
    mkdirSync(join(exportDir, 'pkg'), { recursive: true })
    writeFileSync(
      join(exportDir, 'pkg', 'package.json'),
      JSON.stringify({ exports: { '.': './index.js' } }),
    )
    await evaluateWaiverExpiry(exportDir, [
      {
        id: 'export-missing',
        exportProbe: { file: 'pkg/package.json', subpath: './absent', expectMissing: true },
      },
    ])
    writeFileSync(
      join(exportDir, 'pkg', 'package.json'),
      JSON.stringify({ exports: { './absent': './gone.js' } }),
    )
    let expired = false
    try {
      await evaluateWaiverExpiry(exportDir, [
        {
          id: 'export-present',
          exportProbe: { file: 'pkg/package.json', subpath: './absent', expectMissing: true },
        },
      ])
    } catch (error) {
      expired = error instanceof Error && error.message.includes('now exports')
    }
    if (!expired) {
      throw new Error('evaluateWaiverExpiry must fail when exportProbe finds the subpath')
    }
  } finally {
    rmSync(exportDir, { recursive: true, force: true })
  }

  for (const id of LANGUAGE_IDS) {
    const raw = readFileSync(join(LANG_DIR, `${id}.md`), 'utf8')
    const headings = [...raw.matchAll(/^## (.+)$/gm)].map(match => match[1])
    if (headings.join('\0') !== LANGUAGE_H2_SKELETON.join('\0')) {
      throw new Error(
        `${id}.md H2s are [${headings.join(', ')}]; expected [${LANGUAGE_H2_SKELETON.join(', ')}]`,
      )
    }
  }

  for (const dir of SCAN_DIRS) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.mjs') || SKIP_FILES.has(file)) continue
      const raw = readFileSync(join(dir, file), 'utf8')
      if (LANE_BRANCH.test(raw)) {
        throw new Error(`lane-id branch in ${file}`)
      }
    }
  }
}

/**
 * @param {readonly object[]} rows
 * @param {string} label
 */
function assertIdenticalKeys(rows, label) {
  const fieldSets = rows.map(row => Object.keys(row).sort().join(','))
  const expected = fieldSets[0]
  for (let i = 1; i < fieldSets.length; i += 1) {
    if (fieldSets[i] !== expected) {
      throw new Error(`${label} ${rows[i].id} fields differ from ${rows[0].id}`)
    }
  }
}
