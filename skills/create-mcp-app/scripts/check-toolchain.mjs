#!/usr/bin/env node
/**
 * Toolchain gate before `create-solvapay --type mcp --language <l>`.
 *
 * Checks the language's toolchain (Node + npm for ts, Python >= 3.10 + uv for
 * python, Go >= 1.26 for go) and that the create-solvapay CLI npx resolves
 * lists --language in its --help. Prints one line per check; exit 0 when all
 * pass, 1 when any fail, 2 on bad arguments.
 */
import { spawnSync } from 'node:child_process'

const HELP = `Usage: node scripts/check-toolchain.mjs --language <ts|python|go> [--skip-cli]

Checks, one line each:
  node      Node.js >= 20 (the SolvaPay CLI runs on it in every language)
  npm       ts only
  python    Python >= 3.10 (python3, else python)            python only
  uv        uv on PATH                                       python only
  go        Go >= 1.26                                       go only
  cli       npx -y create-solvapay@latest --help lists --language
            (skip with --skip-cli, for example offline)

Exit 0 when every check passes, 1 when any fails, 2 on bad arguments.
`

const LANGUAGES = ['ts', 'python', 'go']

/** @param {string} text */
export function parseVersion(text) {
  const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(text ?? '')
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)]
}

/** @param {number[] | null} version @param {number[]} minimum */
export function atLeast(version, minimum) {
  if (!version) return false
  for (let i = 0; i < minimum.length; i += 1) {
    if ((version[i] ?? 0) > minimum[i]) return true
    if ((version[i] ?? 0) < minimum[i]) return false
  }
  return true
}

/** @param {string} helpText */
export function cliHelpMentionsLanguage(helpText) {
  return /--language\b/.test(helpText ?? '')
}

/** @param {string} command @param {string[]} args */
function run(command, args, timeout = 15_000) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout })
  if (result.error) return { ok: false, out: '' }
  return { ok: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

function parseArgs(argv) {
  let language
  let skipCli = false
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') return { help: true }
    if (arg === '--language' || arg === '-l') {
      language = argv[i + 1]
      i += 1
    } else if (arg.startsWith('--language=')) {
      language = arg.slice('--language='.length)
    } else if (arg === '--skip-cli') {
      skipCli = true
    } else {
      return { error: `Unknown argument: ${arg}` }
    }
  }
  if (!language) return { error: '--language is required' }
  if (!LANGUAGES.includes(language)) {
    return { error: `Unknown language '${language}'. Valid: ${LANGUAGES.join(', ')}` }
  }
  return { language, skipCli }
}

function checks(language, skipCli) {
  const lines = []
  const add = (name, ok, detail) => lines.push({ name, ok, detail })

  const node = parseVersion(process.versions.node)
  add('node', atLeast(node, [20, 0]), `Node.js ${process.versions.node} (need >= 20, https://nodejs.org)`)

  if (language === 'ts') {
    const npm = run('npm', ['--version'])
    add('npm', npm.ok, npm.ok ? `npm ${npm.out.trim()}` : 'npm not found (ships with Node.js)')
  }

  if (language === 'python') {
    const uv = run('uv', ['--version'])
    add('uv', uv.ok, uv.ok ? uv.out.trim() : 'uv not found (https://docs.astral.sh/uv/getting-started/installation/)')
    // uv runs the project on any interpreter it can find or manage, so ask uv
    // first; the system python3 only counts when uv is missing.
    const found = uv.ok ? run('uv', ['python', 'find', '>=3.10']) : { ok: false, out: '' }
    const interpreter = found.ok ? found.out.trim().split('\n').pop() : null
    let python = interpreter ? run(interpreter, ['--version']) : run('python3', ['--version'])
    if (!python.ok && !interpreter) python = run('python', ['--version'])
    const version = python.ok ? parseVersion(python.out) : null
    const ok = atLeast(version, [3, 10])
    add(
      'python',
      ok,
      ok
        ? `Python ${version.join('.')}${interpreter ? ` (${interpreter})` : ''}`
        : `${version ? `Python ${version.join('.')}` : 'No Python'} found; need >= 3.10. ${uv.ok ? 'Run `uv python install 3.12`.' : 'Install uv, then `uv python install 3.12`.'}`,
    )
  }

  if (language === 'go') {
    const go = run('go', ['version'])
    const version = go.ok ? parseVersion(go.out.replace(/^go version go/, '')) : null
    add(
      'go',
      atLeast(version, [1, 26]),
      version ? `Go ${version.join('.')} (need >= 1.26)` : 'Go not found (need >= 1.26, https://go.dev/dl/)',
    )
  }

  if (!skipCli) {
    const cli = run('npx', ['-y', 'create-solvapay@latest', '--help'], 120_000)
    const supports = cliHelpMentionsLanguage(cli.out)
    if (supports) {
      add('cli', true, 'create-solvapay lists --language')
    } else if (language === 'ts') {
      add('cli', true, 'create-solvapay does not list --language; omit the flag (TypeScript is the default)')
    } else {
      add(
        'cli',
        false,
        cli.out
          ? `create-solvapay does not support --language, so it cannot scaffold ${language}. Run \`npx clear-npx-cache\` and retry; if it still lacks the flag, stop and tell the user this release cannot scaffold ${language} yet.`
          : 'could not run `npx -y create-solvapay@latest --help` (network?). Retry, or pass --skip-cli and check the flag yourself.',
      )
    }
  }
  return lines
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.help) {
    console.log(HELP.trim())
    process.exit(0)
  }
  if (parsed.error) {
    console.error(`${parsed.error}\n\n${HELP.trim()}`)
    process.exit(2)
  }
  const results = checks(parsed.language, parsed.skipCli)
  for (const r of results) console.log(`${r.ok ? 'ok  ' : 'fail'} ${r.name.padEnd(6)} ${r.detail}`)
  const failed = results.filter(r => !r.ok)
  if (failed.length > 0) {
    console.error(`\nToolchain check failed for ${parsed.language}: ${failed.map(r => r.name).join(', ')}. Fix these before scaffolding.`)
    process.exit(1)
  }
}
