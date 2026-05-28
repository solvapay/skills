#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { resolveScaffolderDir } from './lib/resolve-scaffolder.mjs'

const dir = resolveScaffolderDir()
const script = join(dir, 'describe.mjs')
const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})
process.exit(result.status ?? 1)
