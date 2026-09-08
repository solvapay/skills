#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { preflight } from './lib/preflight.mjs'
import { scaffoldLane } from './lib/scaffold.mjs'
import { startServer, stopServer } from './lib/server.mjs'
import { getSurface, LANGUAGE_IDS } from './lib/surfaces.mjs'
import {
  classifyProbe,
  evaluateWaiverExpiry,
  probeVersions,
  versionMayBeStale,
  waiversFor,
} from './lib/waivers.mjs'
import * as installCase from './cases/install.test.mjs'
import * as handshakeCase from './cases/mcp-handshake.test.mjs'
import * as parityCase from './cases/language-parity.test.mjs'
import * as paywallCase from './cases/paywall-gate.test.mjs'
import * as shapeCase from './cases/scaffold-shape.test.mjs'
import * as buildCase from './cases/build.test.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACES = join(__dirname, 'workspaces')

const HELP = `Usage: node tests/run.mjs --lang <id> | --all [flags]

  --lang <id>        One language (${LANGUAGE_IDS.join(', ')})
  --all              Every language
  --keep             Leave tests/workspaces/<id>/
  --json             Machine-readable summary
  --verbose          Stream scaffold + server logs
  --bail             Stop on first failure
  --probe-waivers    Run each waived case unpatched first (self-expire stale waivers)
  --strict           Non-zero exit on any xfail or skipped result
`

function parseArgs(argv) {
  let lang
  let all = false
  let keep = false
  let json = false
  let verbose = false
  let bail = false
  let probeWaivers = false
  let strict = false
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') return { help: true }
    if (arg === '--all') {
      all = true
      continue
    }
    if (arg === '--keep') {
      keep = true
      continue
    }
    if (arg === '--json') {
      json = true
      continue
    }
    if (arg === '--verbose') {
      verbose = true
      continue
    }
    if (arg === '--bail') {
      bail = true
      continue
    }
    if (arg === '--probe-waivers') {
      probeWaivers = true
      continue
    }
    if (arg === '--strict') {
      strict = true
      continue
    }
    if (arg === '--lang' || arg === '--language') {
      lang = argv[++i]
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }
  return { help: false, lang, all, keep, json, verbose, bail, probeWaivers, strict }
}

/**
 * @param {{ name: string, fn: () => Promise<unknown> }} spec
 */
async function runCase(spec) {
  try {
    const result = await spec.fn()
    if (result && typeof result === 'object' && result.status === 'skipped') {
      return { name: spec.name, status: 'skipped', reason: result.reason }
    }
    return { name: spec.name, status: 'passed' }
  } catch (error) {
    return {
      name: spec.name,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * @param {object} spec
 * @param {object} ctx
 * @param {object} lane
 */
async function runCaseWithWaivers(spec, ctx, lane) {
  const waivers = waiversFor(ctx.language, spec.name)
  const specRun = () => runCase({ name: spec.name, fn: () => spec.run(ctx) })
  if (waivers.length === 0) {
    return specRun()
  }

  try {
    await evaluateWaiverExpiry(ctx.workspace, waivers)
  } catch (error) {
    return {
      name: spec.name,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }

  if (!lane.probeWaivers) {
    lane.applyWaivers(spec.name)
    const result = await specRun()
    if (result.status === 'failed') return result
    return xfailResult(spec.name, waivers, { probed: false, versions: [] })
  }

  const unpatched = await specRun()
  const verdict = classifyProbe(unpatched, waivers)
  if (verdict.kind === 'stale') {
    return {
      name: spec.name,
      status: 'failed',
      error: `waiver stale: ${ids(waivers)} — unpatched ${spec.name} passed; delete the waiver`,
    }
  }
  if (verdict.kind === 'unknown') {
    return {
      name: spec.name,
      status: 'failed',
      error: `unknown breakage behind waiver (${ids(waivers)}): ${unpatched.error}`,
    }
  }

  let versions = []
  try {
    versions = probeVersions(ctx.workspace, waivers)
  } catch (error) {
    return {
      name: spec.name,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }

  lane.applyWaivers(spec.name)
  if (lane.restartServer) {
    await lane.restartServer()
  }
  const recheck = await specRun()
  if (recheck.status === 'failed') {
    return {
      name: spec.name,
      status: 'failed',
      error: `waiver does not fix its own claim (${ids(waivers)}): ${recheck.error}`,
    }
  }
  return xfailResult(spec.name, waivers, { probed: true, versions, unpatchedError: unpatched.error })
}

/**
 * @param {string} name
 * @param {import('./lib/surfaces.mjs').Waiver[]} waivers
 * @param {{ probed: boolean, versions: { id: string, version: string | null }[], unpatchedError?: string }} extra
 */
function xfailResult(name, waivers, extra) {
  return {
    name,
    status: 'xfail',
    probed: extra.probed,
    waivers: waivers.map(waiver => {
      const resolved = extra.versions.find(row => row.id === waiver.id)?.version ?? null
      return {
        id: waiver.id,
        ref: waiver.ref,
        reason: waiver.reason,
        provesAt: waiver.provesAt,
        observedAgainst: waiver.observedAgainst ?? null,
        resolved,
        maybeStale:
          resolved && waiver.observedAgainst
            ? versionMayBeStale(resolved, waiver.observedAgainst)
            : false,
      }
    }),
    unpatchedError: extra.unpatchedError,
  }
}

function ids(waivers) {
  return waivers.map(waiver => waiver.id).join(', ')
}

function printLane(id, results) {
  const bits = results.map(result => {
    if (result.status === 'passed') return `${result.name}=pass`
    if (result.status === 'skipped') return `${result.name}=skip`
    if (result.status === 'xfail') return `${result.name}=xfail`
    return `${result.name}=FAIL`
  })
  process.stdout.write(`${id}  ${bits.join('  ')}\n`)
  for (const result of results) {
    if (result.status === 'failed') {
      process.stdout.write(`  ${result.error}\n`)
    }
    if (result.status === 'xfail') {
      const tag = result.probed === false ? ' (unprobed)' : ''
      for (const waiver of result.waivers) {
        const stale =
          waiver.maybeStale && waiver.resolved
            ? `  [observed ${waiver.observedAgainst}, resolved ${waiver.resolved} -- may be stale]`
            : ''
        process.stdout.write(
          `    xfail${tag} ${waiver.id} (${waiver.ref}): ${waiver.reason}${stale}\n`,
        )
      }
    }
  }
}

const parsed = parseArgs(process.argv.slice(2))
if (parsed.help) {
  console.log(HELP.trim())
  process.exit(0)
}
if (!parsed.all && !parsed.lang) {
  console.error(HELP.trim())
  process.exit(2)
}

const selected = parsed.all ? LANGUAGE_IDS.map(getSurface) : [getSurface(parsed.lang)]
const summary = { lanes: /** @type {Record<string, unknown>} */ ({}), waivers: [] }

try {
  const env = await preflight(selected)
  const once = await runCase({ name: parityCase.name, fn: () => parityCase.run() })
  summary.parity = once
  if (!parsed.json) printLane('parity', [once])
  if (once.status === 'failed' && parsed.bail) {
    process.exit(1)
  }

  for (const language of selected) {
    const workspace = join(WORKSPACES, language.id)
    const logDir = workspace
    if (existsSync(workspace)) {
      rmSync(workspace, { recursive: true, force: true })
    }
    mkdirSync(WORKSPACES, { recursive: true })

    let scaffoldLog = ''
    let applyWaivers = () => []
    const laneResults = []
    try {
      const scaffolded = scaffoldLane({
        language,
        workspace,
        secretKey: env.secretKey,
        productRef: env.productRef,
        apiBase: env.apiBase,
        logDir,
      })
      scaffoldLog = scaffolded.log
      applyWaivers = scaffolded.applyWaivers
      if (parsed.verbose) process.stdout.write(scaffoldLog)
    } catch (error) {
      laneResults.push({
        name: 'scaffold',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      })
      summary.lanes[language.id] = laneResults
      if (!parsed.json) printLane(language.id, laneResults)
      if (parsed.bail) process.exit(1)
      continue
    }

    const ctx = {
      language,
      workspace,
      scaffoldLog,
      credentialsFile: env.credentialsFile,
    }
    const lane = {
      probeWaivers: parsed.probeWaivers,
      applyWaivers,
      restartServer: null,
    }

    for (const spec of [shapeCase, installCase, buildCase]) {
      laneResults.push(await runCaseWithWaivers(spec, ctx, lane))
      if (laneResults.some(result => result.status === 'failed')) break
    }

    const earlyFail = laneResults.some(result => result.status === 'failed')
    if (!earlyFail) {
      const serverCases = [handshakeCase, paywallCase]
      if (!parsed.probeWaivers) {
        for (const spec of serverCases) {
          if (waiversFor(language, spec.name).length > 0) applyWaivers(spec.name)
        }
      }

      let server
      const boot = async () => {
        server = await startServer({ language, cwd: workspace, logDir })
        ctx.serverUrl = server.url
      }
      const shutdown = async () => {
        if (!server) return
        server.flush()
        await stopServer(server.child)
        server = undefined
      }

      try {
        try {
          await boot()
        } catch (error) {
          const bootError = error instanceof Error ? error.message : String(error)
          const firstWaived = serverCases.find(spec => waiversFor(language, spec.name).length > 0)
          if (!parsed.probeWaivers || !firstWaived) {
            laneResults.push({ name: 'server', status: 'failed', error: bootError })
            throw error
          }
          const waivers = waiversFor(language, firstWaived.name)
          const verdict = classifyProbe({ status: 'failed', error: bootError }, waivers)
          if (verdict.kind !== 'expected') {
            laneResults.push({
              name: firstWaived.name,
              status: 'failed',
              error:
                verdict.kind === 'stale'
                  ? `waiver stale: ${ids(waivers)}`
                  : `unknown breakage behind waiver (${ids(waivers)}): ${bootError}`,
            })
            throw error
          }
          applyWaivers(firstWaived.name)
          await boot()
          const recheck = await runCase({
            name: firstWaived.name,
            fn: () => firstWaived.run(ctx),
          })
          if (recheck.status === 'failed') {
            laneResults.push({
              name: firstWaived.name,
              status: 'failed',
              error: `waiver does not fix its own claim (${ids(waivers)}): ${recheck.error}`,
            })
            throw new Error(recheck.error)
          }
          laneResults.push(
            xfailResult(firstWaived.name, waivers, {
              probed: true,
              versions: probeVersions(workspace, waivers),
              unpatchedError: bootError,
            }),
          )
        }

        lane.restartServer = async () => {
          await shutdown()
          await boot()
        }

        for (const spec of serverCases) {
          if (laneResults.some(result => result.name === spec.name)) continue
          laneResults.push(await runCaseWithWaivers(spec, ctx, lane))
        }
      } catch (error) {
        if (!laneResults.some(result => result.status === 'failed')) {
          laneResults.push({
            name: 'server',
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          })
        }
      } finally {
        lane.restartServer = null
        await shutdown()
      }
    }

    summary.lanes[language.id] = laneResults
    for (const result of laneResults) {
      if (result.status === 'xfail') {
        for (const waiver of result.waivers) {
          summary.waivers.push({ ...waiver, language: language.id })
        }
      }
    }
    if (!parsed.json) printLane(language.id, laneResults)
    if (parsed.bail && laneResults.some(result => result.status === 'failed')) {
      process.exit(1)
    }
    if (!parsed.keep) {
      if (!laneResults.some(result => result.status === 'failed')) {
        rmSync(workspace, { recursive: true, force: true })
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

if (parsed.json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

const results = [summary.parity, ...Object.values(summary.lanes).flat()]
const failed = results.some(result => result && result.status === 'failed')
const blocked = results.some(
  result => result && (result.status === 'xfail' || result.status === 'skipped'),
)
if (failed || (parsed.strict && blocked)) {
  process.exit(1)
}
process.exit(0)
