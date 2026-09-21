#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { basename, resolve } from 'node:path'
import { enableDevEnv, splitDevArgs } from './lib/dev-mode.mjs'
import { getLanguage, LANGUAGE_IDS } from './lib/languages.mjs'
import { resolveCreateSolvapayCli } from './lib/resolve-scaffolder.mjs'
import {
  assertToolNameForCli,
  buildCreateSolvapayArgs,
  probeCliLanguageSupport,
  resolveLanguageForward,
} from './lib/scaffold-cli.mjs'
import { probeLanguage } from './lib/toolchain.mjs'

const HELP = `Usage: node scripts/scaffold-app.mjs <target-dir> --language <id> [flags]

From-scratch paid MCP scaffold for every language. Same path for ts, python,
ruby, go, and rust. Refuses to run when the toolchain gate fails.

Flags:
  -l, --language <id>    ${LANGUAGE_IDS.join(', ')}
  --tool-name <name>     Placeholder tool (default: helloTool)
  --module <path>        Go module path
  --dev                  Path-depend on a solvapay-sdk checkout; seed api-dev
  --api-base <url>       Override the API origin. Does not replace --dev —
                         a checkout lane still needs both.
  --product <ref>        Seed SOLVAPAY_PRODUCT_REF (prd_...) so solvapay init
                         verifies it instead of skipping product selection on
                         a non-TTY / agent run.
  --skip-init            Skip solvapay init (harness / pre-seeded .env)
  --skip-install         Skip dependency install
  --yes                  Non-interactive (always on)
  --verbose              Forward the scaffolder per-file copy log
  --help                 This message
`

function parseArgs(argv) {
  const { dev, args } = splitDevArgs(argv)
  let language
  let toolName
  let modulePath
  let apiBaseUrl
  let productRef
  let skipInit = false
  let skipInstall = false
  let verbose = false
  const positionals = []

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') return { help: true }
    if (arg === '--language' || arg === '-l') {
      language = args[++i]
      continue
    }
    if (arg === '--tool-name') {
      toolName = args[++i]
      continue
    }
    if (arg === '--module') {
      modulePath = args[++i]
      continue
    }
    if (arg === '--api-base') {
      apiBaseUrl = args[++i]
      if (!apiBaseUrl || apiBaseUrl.startsWith('-')) {
        throw new Error('--api-base requires a URL')
      }
      continue
    }
    if (arg === '--product') {
      productRef = args[++i]
      if (!productRef || productRef.startsWith('-')) {
        throw new Error('--product requires a product reference')
      }
      continue
    }
    if (arg === '--skip-init') {
      skipInit = true
      continue
    }
    if (arg === '--skip-install') {
      skipInstall = true
      continue
    }
    if (arg === '--verbose') {
      verbose = true
      continue
    }
    if (arg === '--yes' || arg === '-y') continue
    if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`)
    }
    positionals.push(arg)
  }

  return {
    help: false,
    dev,
    apiBaseUrl,
    productRef,
    language,
    toolName,
    modulePath,
    skipInit,
    skipInstall,
    verbose,
    targetDir: positionals[0],
  }
}

const parsed = parseArgs(process.argv.slice(2))
if (parsed.help) {
  console.log(HELP.trim())
  process.exit(0)
}

if (!parsed.targetDir) {
  console.error('target-dir is required.\n')
  console.error(HELP.trim())
  process.exit(2)
}
if (!parsed.language) {
  console.error(`--language is required. Valid: ${LANGUAGE_IDS.join(', ')}`)
  process.exit(2)
}

const language = getLanguage(parsed.language)
const gate = await probeLanguage(language)
process.stdout.write(`${gate.line}\n`)
if (!gate.ok) {
  console.error(
    `Refusing to scaffold: toolchain gate failed for ${language.id}.\n` +
      'See references/languages/toolchain-gate.md.',
  )
  process.exit(1)
}

const useDev = parsed.dev || gate.source === 'checkout'

const cli = resolveCreateSolvapayCli()
const supportsLanguage = probeCliLanguageSupport(cli)
const languageForward = resolveLanguageForward({
  supportsLanguage,
  languageId: language.id,
})
if (languageForward.error) {
  console.error(languageForward.error)
  process.exit(1)
}
if (languageForward.omit && languageForward.message) {
  console.error(languageForward.message)
}

const toolNameCheck = assertToolNameForCli({
  supportsLanguage,
  toolName: parsed.toolName,
})
if (!toolNameCheck.ok) {
  console.error(toolNameCheck.error)
  process.exit(1)
}

const target = resolve(parsed.targetDir)
const projectName = basename(target)
const cliArgs = buildCreateSolvapayArgs({
  cli,
  projectName,
  languageId: language.id,
  supportsLanguage,
  toolName: parsed.toolName,
  modulePath: parsed.modulePath,
  useDev,
  apiBaseUrl: parsed.apiBaseUrl,
  productRef: parsed.productRef,
  skipInit: parsed.skipInit,
  skipInstall: parsed.skipInstall,
})

const env = enableDevEnv(useDev, parsed.apiBaseUrl)
const result = spawnSync(process.execPath, cliArgs, {
  cwd: resolve(target, '..'),
  env,
  encoding: 'utf8',
  stdio: parsed.verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
})

if (!parsed.verbose) {
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`
  for (const line of combined.split('\n')) {
    if (!line) continue
    if (/^\s*(copied|copying|wrote)\b/i.test(line)) continue
    process.stdout.write(`${line}\n`)
  }
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

if (combinedHasInstallWarning(result.stdout, result.stderr)) {
  console.error(
    'Install did not succeed (scaffolder printed ⚠️). Do not claim dependencies are installed.',
  )
  process.exit(1)
}

function combinedHasInstallWarning(stdout, stderr) {
  const text = `${stdout ?? ''}\n${stderr ?? ''}`
  return /⚠️/.test(text)
}
