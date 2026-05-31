#!/usr/bin/env node
// Toggle local development of the SolvaPay skills on/off by symlinking the
// repo's skill directories into the agent skill search paths.
//
//   node scripts/dev-link.mjs link     # point agent skills at this repo
//   node scripts/dev-link.mjs unlink   # remove the symlinks (restore backups)
//   node scripts/dev-link.mjs status   # show what is linked where
//
// Canonical install location is ~/.agents/skills/<name> (a real symlink into
// this repo). ~/.claude/skills/<name> mirrors it with a relative symlink
// (../../.agents/skills/<name>) so AGENTS.md / Claude-aware tools resolve the
// same source. Any pre-existing real directory (e.g. a stale standalone copy
// of the umbrella `solvapay` skill) is moved aside to <name>.local-backup on
// link and restored on unlink.

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const SKILLS_DIR = join(REPO_ROOT, 'skills')
const BACKUP_SUFFIX = '.local-backup'

// Canonical agent skill root (real symlinks into the repo live here).
const PRIMARY_ROOT = join(homedir(), '.agents', 'skills')
// Mirror roots: relative symlinks pointing back at PRIMARY_ROOT/<name>.
const MIRROR_ROOTS = [join(homedir(), '.claude', 'skills')]

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

/** @returns {string[]} skill directory names that contain a SKILL.md */
function discoverSkills() {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => existsSync(join(SKILLS_DIR, name, 'SKILL.md')))
    .sort()
}

/** @returns {boolean} true if any filesystem entry exists, including broken symlinks */
function entryExists(path) {
  return Boolean(lstatSync(path, { throwIfNoEntry: false }))
}

/** @returns {boolean} true if the path is a symlink (even a broken one) */
function isSymlink(path) {
  return lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() ?? false
}

/** @returns {string | null} resolved symlink target, or null if not a (valid) symlink */
function symlinkTarget(path) {
  try {
    if (!isSymlink(path)) return null
    return realpathSync(path)
  } catch {
    return null
  }
}

function isLinkedToRepo(path, repoPath) {
  const target = symlinkTarget(path)
  if (!target) return false
  try {
    return target === realpathSync(repoPath)
  } catch {
    return false
  }
}

function removeEntry(path) {
  rmSync(path, { recursive: true, force: true })
}

/** Move a real directory/file aside so it can be restored on unlink. */
function backupEntry(path) {
  const backup = path + BACKUP_SUFFIX
  if (existsSync(backup)) {
    // A backup already exists — the original is safe. Drop the current entry.
    removeEntry(path)
    return `dropped (backup already present)`
  }
  renameSync(path, backup)
  return `backed up → ${backup.replace(homedir(), '~')}`
}

function link() {
  const skills = discoverSkills()
  mkdirSync(PRIMARY_ROOT, { recursive: true })
  for (const root of MIRROR_ROOTS) mkdirSync(root, { recursive: true })

  console.log(`Linking ${skills.length} skills from ${REPO_ROOT.replace(homedir(), '~')}\n`)

  for (const name of skills) {
    const repoPath = join(SKILLS_DIR, name)
    const primary = join(PRIMARY_ROOT, name)

    if (isLinkedToRepo(primary, repoPath)) {
      console.log(`${DIM}= ${name}${RESET} already linked`)
    } else {
      if (entryExists(primary)) {
        if (isSymlink(primary)) {
          removeEntry(primary)
        } else {
          const note = backupEntry(primary)
          console.log(`  ${YELLOW}${name}${RESET}: ${note}`)
        }
      }
      symlinkSync(repoPath, primary)
      console.log(`${GREEN}+ ${name}${RESET} → ~/.agents/skills/${name}`)
    }

    // Mirror roots: relative symlink → primary.
    for (const root of MIRROR_ROOTS) {
      const mirror = join(root, name)
      const rel = relative(root, primary)
      if (symlinkTarget(mirror) === realpathSync(primary)) continue
      if (entryExists(mirror)) {
        if (isSymlink(mirror)) removeEntry(mirror)
        else backupEntry(mirror)
      }
      symlinkSync(rel, mirror)
    }
  }

  console.log(`\n${GREEN}Done.${RESET} Local development is ON.`)
}

function unlink() {
  const skills = discoverSkills()
  console.log('Removing local-dev symlinks\n')

  for (const name of skills) {
    const repoPath = join(SKILLS_DIR, name)
    const primary = join(PRIMARY_ROOT, name)

    if (isLinkedToRepo(primary, repoPath)) {
      removeEntry(primary)
      const backup = primary + BACKUP_SUFFIX
      if (existsSync(backup)) {
        renameSync(backup, primary)
        console.log(`${GREEN}- ${name}${RESET} unlinked, restored backup`)
      } else {
        console.log(`${GREEN}- ${name}${RESET} unlinked`)
      }
    } else {
      console.log(`${DIM}= ${name}${RESET} not linked to repo, skipped`)
    }

    for (const root of MIRROR_ROOTS) {
      const mirror = join(root, name)
      if (isSymlink(mirror)) {
        removeEntry(mirror)
        const backup = mirror + BACKUP_SUFFIX
        if (existsSync(backup)) renameSync(backup, mirror)
      }
    }
  }

  console.log(`\n${GREEN}Done.${RESET} Local development is OFF.`)
}

function status() {
  const skills = discoverSkills()
  console.log(`SolvaPay skills in ${REPO_ROOT.replace(homedir(), '~')}\n`)

  const roots = [PRIMARY_ROOT, ...MIRROR_ROOTS]
  for (const name of skills) {
    const repoPath = join(SKILLS_DIR, name)
    console.log(`${name}`)
    for (const root of roots) {
      const path = join(root, name)
      const label = root.replace(homedir(), '~')
      if (!entryExists(path)) {
        console.log(`  ${RED}✗${RESET} ${label}/${name} ${DIM}(missing)${RESET}`)
        continue
      }
      const target = symlinkTarget(path)
      if (target && isLinkedToRepo(path, repoPath)) {
        console.log(`  ${GREEN}✓${RESET} ${label}/${name} → repo`)
      } else if (target) {
        console.log(`  ${YELLOW}~${RESET} ${label}/${name} → ${target.replace(homedir(), '~')}`)
      } else {
        console.log(`  ${YELLOW}●${RESET} ${label}/${name} ${DIM}(standalone copy)${RESET}`)
      }
    }
  }
}

const cmd = process.argv[2]
switch (cmd) {
  case 'link':
  case 'on':
    link()
    break
  case 'unlink':
  case 'off':
    unlink()
    break
  case 'status':
  case undefined:
    status()
    break
  default:
    console.error(`Unknown command: ${cmd}\nUsage: dev-link.mjs <link|unlink|status>`)
    process.exit(1)
}
