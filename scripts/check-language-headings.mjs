#!/usr/bin/env node
/**
 * Fails when the per-language reference files of a skill drift apart.
 *
 * For every skills/<skill>/references/languages/ folder, the `##` headings of
 * each *.md file must be the same list, in the same order. A skill's SKILL.md
 * tells the agent to read exactly one of these files, so each must answer the
 * same questions in the same place.
 *
 * Usage: node scripts/check-language-headings.mjs [repo-root]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] ?? process.cwd()
const skillsDir = join(root, 'skills')

/** `##` headings outside fenced code blocks. @param {string} text */
export function headings(text) {
  const found = []
  let fence = null
  for (const line of text.split('\n')) {
    const marker = /^\s*(```+|~~~+)/.exec(line)
    if (marker) {
      if (fence === null) fence = marker[1][0]
      else if (marker[1][0] === fence) fence = null
      continue
    }
    if (fence !== null) continue
    const match = /^## (.+?)\s*$/.exec(line)
    if (match) found.push(match[1])
  }
  return found
}

let failed = false
let checked = 0
for (const skill of readdirSync(skillsDir, { withFileTypes: true })) {
  if (!skill.isDirectory()) continue
  const dir = join(skillsDir, skill.name, 'references', 'languages')
  if (!existsSync(dir)) continue
  const files = readdirSync(dir).filter(name => name.endsWith('.md')).sort()
  if (files.length < 2) continue
  checked += 1
  const lists = files.map(name => ({ name, list: headings(readFileSync(join(dir, name), 'utf8')) }))
  const [first, ...rest] = lists
  for (const other of rest) {
    const same =
      other.list.length === first.list.length && other.list.every((heading, i) => heading === first.list[i])
    if (same) continue
    failed = true
    console.error(`✗ ${relative(root, dir)}: ${other.name} headings differ from ${first.name}`)
    const width = Math.max(first.list.length, other.list.length)
    for (let i = 0; i < width; i += 1) {
      const a = first.list[i] ?? '(none)'
      const b = other.list[i] ?? '(none)'
      console.error(`  ${a === b ? ' ' : '≠'} ${String(i + 1).padStart(2)}. ${a.padEnd(28)} | ${b}`)
    }
  }
  if (!failed) console.log(`✓ ${relative(root, dir)}: ${files.join(', ')} share ${first.list.length} headings`)
}

if (checked === 0) {
  console.error('No skills/*/references/languages/ folder with two or more files found.')
  process.exit(1)
}
process.exit(failed ? 1 : 0)
