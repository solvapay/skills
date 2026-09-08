import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveCreateSolvapayCli } from '../../skills/create-mcp-app/scripts/lib/resolve-scaffolder.mjs'
import { waiversFor } from './waivers.mjs'

/**
 * @param {object} input
 * @param {import('./surfaces.mjs').TestSurface & import('../../skills/create-mcp-app/scripts/lib/languages.mjs').LanguageRow} input.language
 * @param {string} input.workspace
 * @param {string} input.secretKey
 * @param {string} input.productRef
 * @param {string} input.apiBase
 * @param {string} input.logDir
 */
export function scaffoldLane(input) {
  const { language, workspace, secretKey, productRef, apiBase, logDir } = input
  mkdirSync(dirname(workspace), { recursive: true })
  mkdirSync(logDir, { recursive: true })

  const cli = resolveCreateSolvapayCli()
  const parent = dirname(workspace)
  const name = workspace.slice(parent.length + 1)
  const args = [
    cli,
    name,
    '--type',
    'mcp',
    '--no-openapi',
    '--language',
    language.id,
    '--yes',
    '--dev',
    '--skip-init',
    '--tool-name',
    'helloTool',
    ...language.extraScaffoldArgs,
  ]

  const result = spawnSync(process.execPath, args, {
    cwd: parent,
    encoding: 'utf8',
    env: { ...process.env, SOLVAPAY_API_BASE_URL: apiBase },
  })
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`
  writeFileSync(join(logDir, 'scaffold.log'), log)

  if (result.status !== 0) {
    throw new Error(`scaffold ${language.id} failed (exit ${result.status}). See ${join(logDir, 'scaffold.log')}`)
  }

  writeFileSync(
    join(workspace, '.env'),
    [
      `SOLVAPAY_SECRET_KEY=${secretKey}`,
      `SOLVAPAY_PRODUCT_REF=${productRef}`,
      `SOLVAPAY_API_BASE_URL=${apiBase}`,
      `MCP_PUBLIC_BASE_URL=http://localhost:${language.e2ePort}`,
      `MCP_PORT=${language.e2ePort}`,
      '',
    ].join('\n'),
  )

  applySeedFiles(workspace, language)
  applyFileDeps(workspace, language, process.env.SOLVAPAY_SDK_ROOT)

  const applied = new Set()

  /**
   * @param {string} caseName
   * @returns {import('./surfaces.mjs').Waiver[]}
   */
  function applyWaivers(caseName) {
    const pending = waiversFor(language, caseName).filter(waiver => !applied.has(waiver.id))
    const patches = pending.filter(waiver => waiver.kind === 'patch')
    const stubs = pending.filter(waiver => waiver.kind === 'stub')
    const unknown = pending.filter(waiver => waiver.kind !== 'patch' && waiver.kind !== 'stub')
    if (unknown.length > 0) {
      throw new Error(`unknown waiver kind: ${unknown.map(waiver => waiver.kind).join(', ')}`)
    }
    for (const patch of patches) {
      applyPatch(workspace, patch)
      applied.add(patch.id)
    }
    if (stubs.length > 0) {
      applyStubs(workspace, language, stubs)
      for (const stub of stubs) applied.add(stub.id)
    }
    return pending
  }

  return { log, workspace, applyWaivers }
}

/**
 * @param {string} workspace
 * @param {{ seedFiles: readonly { path: string, contents: string }[] }} language
 */
function applySeedFiles(workspace, language) {
  for (const file of language.seedFiles) {
    const path = join(workspace, file.path)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, file.contents)
  }
}

/**
 * @param {string} workspace
 * @param {import('./surfaces.mjs').Waiver[]} stubs
 * @param {{ manifest: string, install: { command: string, args: readonly string[] } }} language
 */
function applyStubs(workspace, language, stubs) {
  const manifestPath = join(workspace, language.manifest)
  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'))
  pkg.dependencies = pkg.dependencies ?? {}
  for (const stub of stubs) {
    if (!stub.name || !stub.version) {
      throw new Error(`stub waiver ${stub.id} is missing name or version`)
    }
    const dir = join(workspace, '.e2e-stubs', stub.name.replace(/^@/, '').replace('/', '-'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      `${JSON.stringify(
        {
          name: stub.name,
          version: stub.version,
          type: 'module',
          exports: { './browser-js': './browser-js.js', '.': './browser-js.js' },
        },
        null,
        2,
      )}\n`,
    )
    writeFileSync(
      join(dir, 'browser-js.js'),
      [
        "export const SOLVAPAY_BROWSER_JS_CORE = 'solvapay-browser-js-core'",
        "export function resolveDisplayMode() { return JSON.stringify({ ok: true, value: { mode: 'inline' } }) }",
        '',
      ].join('\n'),
    )
    pkg.dependencies[stub.name] = `file:${dir}`
  }
  writeFileSync(manifestPath, `${JSON.stringify(pkg, null, 2)}\n`)
  const install = spawnSync(language.install.command, [...language.install.args], {
    cwd: workspace,
    encoding: 'utf8',
  })
  if (install.status !== 0) {
    throw new Error(`stub waiver reinstall failed: ${install.stderr || install.stdout}`)
  }
}

/**
 * @param {string} workspace
 * @param {import('./surfaces.mjs').Waiver} patch
 */
function applyPatch(workspace, patch) {
  if (!patch.file || patch.find === undefined || patch.replace === undefined) {
    throw new Error(`patch waiver ${patch.id} is missing file/find/replace`)
  }
  const path = join(workspace, patch.file)
  const raw = readFileSync(path, 'utf8')
  if (!raw.includes(patch.find)) {
    throw new Error(`waiver ${patch.id} missed ${patch.file}: find string absent`)
  }
  writeFileSync(path, raw.replace(patch.find, patch.replace))
}

/**
 * @param {string} workspace
 * @param {{ fileDeps: readonly { name: string, rel: string }[], manifest: string, install: { command: string, args: readonly string[] } }} language
 * @param {string | undefined} sdkRoot
 */
function applyFileDeps(workspace, language, sdkRoot) {
  if (language.fileDeps.length === 0) return
  if (!sdkRoot) {
    throw new Error('fileDeps require SOLVAPAY_SDK_ROOT')
  }
  const manifestPath = join(workspace, language.manifest)
  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const dep of language.fileDeps) {
    const spec = `file:${join(sdkRoot, dep.rel)}`
    if (pkg.dependencies?.[dep.name]) pkg.dependencies[dep.name] = spec
    if (pkg.devDependencies?.[dep.name]) pkg.devDependencies[dep.name] = spec
  }
  writeFileSync(manifestPath, `${JSON.stringify(pkg, null, 2)}\n`)
  const install = spawnSync(language.install.command, [...language.install.args], {
    cwd: workspace,
    encoding: 'utf8',
  })
  if (install.status !== 0) {
    throw new Error(`fileDeps reinstall failed: ${install.stderr || install.stdout}`)
  }
}
