#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  enableDevEnv,
  getScaffoldTargetDir,
  seedDevApiBase,
  splitDevArgs,
} from './lib/dev-mode.mjs'
import { resolveScaffolderDir } from './lib/resolve-scaffolder.mjs'

const { dev, args } = splitDevArgs(process.argv.slice(2))
const HELP = `Usage: node scripts/scaffold.mjs [--dev] <openapi.json|openapi.yaml> <target-dir> --selections <selections.json>

Thin wrapper around create-solvapay/scripts/mcp/scaffold.mjs.
Use --dev only for internal testing against https://api-dev.solvapay.com.
`

if (args.includes('--help') || args.includes('-h')) {
  console.log(HELP.trim())
  process.exit(0)
}

const env = enableDevEnv(dev)
const dir = resolveScaffolderDir()
const script = join(dir, 'scaffold.mjs')
const result = spawnSync(process.execPath, [script, ...args], {
  stdio: 'inherit',
  env,
})

if (dev && result.status === 0) {
  seedDevApiBase(getScaffoldTargetDir(args))
}

process.exit(result.status ?? 1)
