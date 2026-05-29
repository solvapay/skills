#!/usr/bin/env node
/**
 * Validate selections.json before scaffold.
 * Usage: node scripts/validate-selections.mjs <selections.json>
 * Exit 0 on pass; stderr field errors on fail.
 */
import { readFileSync } from 'node:fs'

const HELP = `Usage: node scripts/validate-selections.mjs <selections.json>

Validates required fields per references/from-openapi/selections-schema.md
before running scaffold.mjs.
`

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(HELP.trim())
  process.exit(0)
}

const path = process.argv[2]
if (!path) {
  console.error('Error: missing selections.json path\n')
  console.error(HELP.trim())
  process.exit(1)
}

let data
try {
  data = JSON.parse(readFileSync(path, 'utf8'))
} catch (e) {
  console.error(`Error: invalid JSON in ${path}: ${e.message}`)
  process.exit(1)
}

const errors = []

if (!data.workerName || typeof data.workerName !== 'string') {
  errors.push('workerName: required non-empty string (kebab-case)')
}
if (!data.mcpPublicBaseUrl || typeof data.mcpPublicBaseUrl !== 'string') {
  errors.push('mcpPublicBaseUrl: required string (e.g. http://localhost:8787)')
}
if (!data.upstreamAuth || typeof data.upstreamAuth !== 'object') {
  errors.push('upstreamAuth: required object with kind')
} else {
  const k = data.upstreamAuth.kind
  if (!['none', 'bearer', 'apiKey', 'oauth2-client-credentials'].includes(k)) {
    errors.push(`upstreamAuth.kind: invalid "${k}"`)
  }
  if (k === 'bearer' && !data.upstreamAuth.key) {
    errors.push('upstreamAuth.key: required for bearer')
  }
  if (k === 'apiKey' && (!data.upstreamAuth.name || !data.upstreamAuth.key)) {
    errors.push('upstreamAuth.name and key: required for apiKey')
  }
}

const mode = data.mode ?? 'one-to-one'
if (mode === 'one-to-one') {
  if (!Array.isArray(data.operations) || data.operations.length === 0) {
    errors.push('operations: required non-empty array for one-to-one mode')
  }
}

if (errors.length) {
  console.error(`selections.json validation failed (${path}):`)
  for (const err of errors) console.error(`  - ${err}`)
  process.exit(1)
}

console.log(JSON.stringify({ ok: true, path, mode }))
process.exit(0)
