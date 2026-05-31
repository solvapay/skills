#!/usr/bin/env node
/**
 * Validate Supabase Deno import map for Lovable @preview packages.
 * Usage: node scripts/check-import-map.mjs [path-to-deno.json]
 * stdout: JSON { ok, missing[], path }
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const HELP = `Usage: node scripts/check-import-map.mjs [deno.json-path]

Default: supabase/functions/deno.json under cwd.
Expects @solvapay/server@preview and trailing-slash server/ entry.
`

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(HELP.trim())
  process.exit(0)
}

const defaultPath = join(process.cwd(), 'supabase/functions/deno.json')
const path = process.argv[2] ?? defaultPath

if (!existsSync(path)) {
  console.log(JSON.stringify({ ok: false, path, missing: ['file not found'] }))
  process.exit(1)
}

let json
try {
  json = JSON.parse(readFileSync(path, 'utf8'))
} catch (e) {
  console.log(JSON.stringify({ ok: false, path, error: e.message }))
  process.exit(1)
}

const imports = json.imports ?? {}
const missing = []
const required = [
  ['@solvapay/server', /@preview|@solvapay\/server@preview/],
  ['@solvapay/server/', /@preview|@solvapay\/server@preview/],
]

for (const [key, pattern] of required) {
  const val = imports[key]
  if (!val || !pattern.test(String(val))) missing.push(key)
}

const ok = missing.length === 0
console.log(JSON.stringify({ ok, missing, path }))
process.exit(ok ? 0 : 1)
