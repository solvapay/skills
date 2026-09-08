import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { assertCheckoutClisCurrent } from './checkout-clis.mjs'

const temps = []

const makeRoot = () => {
  const root = mkdtempSync(join(os.tmpdir(), 'checkout-clis-'))
  temps.push(root)
  return root
}

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop(), { recursive: true, force: true })
  }
})

const seedPackage = (root, pkgRel, distRel, srcNewerThanDist) => {
  const pkg = join(root, pkgRel)
  mkdirSync(join(pkg, 'src'), { recursive: true })
  mkdirSync(join(pkg, 'dist'), { recursive: true })
  const srcFile = join(pkg, 'src', 'index.ts')
  const distFile = join(root, distRel)
  writeFileSync(srcFile, 'export {}\n')
  writeFileSync(distFile, 'ok\n')
  const now = Date.now() / 1000
  if (srcNewerThanDist) {
    utimesSync(distFile, now - 60, now - 60)
    utimesSync(srcFile, now, now)
  } else {
    utimesSync(srcFile, now - 60, now - 60)
    utimesSync(distFile, now, now)
  }
}

const seedAllCurrent = root => {
  seedPackage(root, 'tools/create-solvapay', 'tools/create-solvapay/dist/cli.js', false)
  seedPackage(root, 'tools/cli', 'tools/cli/dist/cli.js', false)
  seedPackage(root, 'tools/init', 'tools/init/dist/index.js', false)
}

describe('assertCheckoutClisCurrent', () => {
  it('passes when all three dists exist and are newer than src', () => {
    const root = makeRoot()
    seedAllCurrent(root)
    assert.doesNotThrow(() => assertCheckoutClisCurrent(root))
  })

  it('throws when a dist is missing', () => {
    const root = makeRoot()
    seedPackage(root, 'tools/create-solvapay', 'tools/create-solvapay/dist/cli.js', false)
    seedPackage(root, 'tools/cli', 'tools/cli/dist/cli.js', false)
    mkdirSync(join(root, 'tools/init/src'), { recursive: true })
    writeFileSync(join(root, 'tools/init/src/index.ts'), 'export {}\n')

    assert.throws(() => assertCheckoutClisCurrent(root), /Build the checkout CLIs/)
    assert.throws(
      () => assertCheckoutClisCurrent(root),
      /pnpm --filter create-solvapay --filter solvapay --filter @solvapay\/init build/,
    )
  })

  it('throws when a dist is older than its src tree', () => {
    const root = makeRoot()
    seedAllCurrent(root)
    seedPackage(root, 'tools/cli', 'tools/cli/dist/cli.js', true)

    assert.throws(() => assertCheckoutClisCurrent(root), /Build the checkout CLIs/)
  })
})
