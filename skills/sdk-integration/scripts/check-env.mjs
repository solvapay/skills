#!/usr/bin/env node
/**
 * Scan project for SolvaPay secret leaks in client/public env.
 * Usage: node scripts/check-env.mjs [project-root]
 * stdout: JSON { ok, violations[] }
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const HELP = `Usage: node scripts/check-env.mjs [project-root]

Detects SOLVAPAY_SECRET_KEY, SOLVAPAY_WEBHOOK_SECRET, sk_*, or whsec_
in NEXT_PUBLIC_* / VITE_* patterns across env files and Next/Vite configs.
`

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(HELP.trim())
  process.exit(0)
}

const root = process.argv[2] ?? process.cwd()
const violations = []
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
for (const name of configFiles) {
  const p = join(root, name)
  if (existsSync(p)) scanFile(p)
}

const ok = violations.length === 0
const out = { ok, violations }
console.log(JSON.stringify(out, null, 2))
process.exit(ok ? 0 : 1)
