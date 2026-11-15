#!/usr/bin/env node
/**
 * Scan project for SolvaPay secret leaks in client/public env.
 * Usage: node scripts/check-env.mjs [project-root]
 * stdout: JSON { ok, language, violations[], note? }
 *
 * Python and Go backends bundle nothing for a browser. Without a package.json
 * at the root, the Next/Vite config scan is skipped and only the env files are
 * checked (a NEXT_PUBLIC_ / VITE_ secret there still leaks to any frontend
 * that shares them).
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const HELP = `Usage: node scripts/check-env.mjs [project-root]

Detects SOLVAPAY_SECRET_KEY, SOLVAPAY_WEBHOOK_SECRET, sk_*, or whsec_
in NEXT_PUBLIC_* / VITE_* patterns across env files and Next/Vite configs.

Python (pyproject.toml, uv.lock, poetry.lock, requirements.txt) and Go (go.mod)
projects with no package.json: the config scan is skipped and only the env
files are checked. The JSON says so in "note".
`

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(HELP.trim())
  process.exit(0)
}

const root = process.argv[2] ?? process.cwd()
const violations = []

// The same markers as the SolvaPay CLI.
const has = name => existsSync(join(root, name))
const language = has('go.mod')
  ? 'go'
  : ['uv.lock', 'poetry.lock', 'pyproject.toml', 'requirements.txt'].some(has)
    ? 'python'
    : has('package.json')
      ? 'ts'
      : 'unknown'
const jsFrontend = has('package.json')
const secretPattern =
  /SOLVAPAY_SECRET_KEY|SOLVAPAY_WEBHOOK_SECRET|sk_(test|live|sandbox)_|whsec_/i
const publicPattern = /NEXT_PUBLIC_|VITE_/

function scanFile(file) {
  let content
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    return
  }
  if (!secretPattern.test(content)) return
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    if (secretPattern.test(line) && publicPattern.test(line)) {
      violations.push({ file, line: i + 1, detail: 'secret pattern in public env var' })
    }
  })
}

const envFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
]
for (const name of envFiles) {
  const p = join(root, name)
  if (existsSync(p)) scanFile(p)
}

const configFiles = [
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
]
if (jsFrontend) {
  for (const name of configFiles) {
    const p = join(root, name)
    if (existsSync(p)) scanFile(p)
  }
}

const ok = violations.length === 0
const out = { ok, language, violations }
if (!jsFrontend && (language === 'python' || language === 'go')) {
  out.note = `${language === 'go' ? 'Go' : 'Python'} project with no package.json: Next/Vite config scan skipped, env files checked. Run this again in the frontend folder if there is one.`
}
console.log(JSON.stringify(out, null, 2))
process.exit(ok ? 0 : 1)
