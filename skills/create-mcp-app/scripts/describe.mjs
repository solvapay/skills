#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { enableDevEnv, splitDevArgs } from './lib/dev-mode.mjs'
import { resolveScaffolderDir } from './lib/resolve-scaffolder.mjs'

const { dev, args } = splitDevArgs(process.argv.slice(2))
const HELP = `Usage: node scripts/describe.mjs [--dev] <openapi.json|openapi.yaml> [--no-probe]

Thin wrapper around create-solvapay/scripts/mcp/describe.mjs.
Use --dev only for internal testing against https://api-dev.solvapay.com.
`

if (args.includes('--help') || args.includes('-h')) {
  console.log(HELP.trim())
  process.exit(0)
}

const env = enableDevEnv(dev)
const dir = resolveScaffolderDir()
const script = join(dir, 'describe.mjs')
const result = spawnSync(process.execPath, [script, ...args], {
  stdio: 'inherit',
  env,
})
process.exit(result.status ?? 1)
