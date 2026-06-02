import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const DEV_API_BASE_URL = 'https://api-dev.solvapay.com'

export function splitDevArgs(argv) {
  const args = []
  let dev = false
  for (const arg of argv) {
    if (arg === '--dev') {
      dev = true
    } else {
      args.push(arg)
    }
  }
  return { dev, args }
}

export function enableDevEnv(dev) {
  if (dev && !process.env.SOLVAPAY_API_BASE_URL) {
    process.env.SOLVAPAY_API_BASE_URL = DEV_API_BASE_URL
  }
  return process.env
}

function parsePositionalArgs(args) {
  const positionals = []
  const optionsWithValues = new Set([
    '--selections',
    '--output',
    '--out',
    '--config',
  ])
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      if (optionsWithValues.has(arg)) i++
      continue
    }
    positionals.push(arg)
  }
  return positionals
}

export function getScaffoldTargetDir(args) {
  const [, targetDir] = parsePositionalArgs(args)
  return targetDir ? resolve(targetDir) : null
}

export function seedDevApiBase(targetDir) {
  if (!targetDir) return
  const dotEnvPath = resolve(targetDir, '.env')
  if (!existsSync(dotEnvPath)) return

  const contents = readFileSync(dotEnvPath, 'utf8')
  const line = `SOLVAPAY_API_BASE_URL=${DEV_API_BASE_URL}`
  const next = /^\s*SOLVAPAY_API_BASE_URL\s*=/m.test(contents)
    ? contents.replace(/^\s*SOLVAPAY_API_BASE_URL\s*=.*$/m, line)
    : `${contents.replace(/\s*$/, '')}\n${line}\n`

  if (next !== contents) writeFileSync(dotEnvPath, next)
}
