#!/usr/bin/env node
// Build one release asset per skill and write an Agent Skills discovery index
// (https://schemas.agentskills.io/discovery/0.2.0/schema.json) next to them,
// then verify the result the way a client would.
//
//   node scripts/build-skill-release.mjs --dry-run
//   node scripts/build-skill-release.mjs --tag v1.2.0 --repo solvapay/skills
//   node scripts/build-skill-release.mjs --verify dist/release --tag v1.2.0
//
// Options:
//   --tag <tag>        release tag the asset URLs point at (default v0.0.0-dry-run)
//   --repo <owner/n>   GitHub repo for asset URLs (default $GITHUB_REPOSITORY or solvapay/skills)
//   --base-url <url>   override the asset base URL (e.g. a local server for testing)
//   --out <dir>        output directory (default dist/release)
//   --verify <dir>     skip the build and only verify an existing directory
//   --dry-run          build into the output directory with the default tag
//
// The index type is picked per skill, as the spec's "Distribution Guidance"
// recommends:
//   - skill-md: the folder holds only SKILL.md, published as <name>.md (release
//     assets share one flat namespace, so the file can't be called SKILL.md).
//   - archive: anything else, published as <name>.tar.gz.
//
// Archives follow the spec's "Archive Structure": the skill folder's contents
// sit at the archive root (SKILL.md at the root, no wrapper directory). That is
// also what `npx skills add <archive-url>` accepts: it extracts and uses the
// root (or a single top-level directory). Archives hold regular files only,
// because the skills CLI rejects any symlink or hard link in a well-known
// archive, so any symlink under skills/ fails the build.
//
// Archives are deterministic for a given commit: sorted entries, fixed
// owner/mode, mtime from the skill's last commit, and a fixed gzip header.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { parse as parseYaml } from 'yaml'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json'
// Index order. The router goes first so a client listing skills sees it first.
const SKILLS = ['solvapay', 'pay-with-solvapay', 'create-mcp-app', 'app-integration']
// Release asset extension per index type.
const EXT = { 'skill-md': '.md', archive: '.tar.gz' }
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DIGEST_RE = /^sha256:[a-f0-9]{64}$/
const MAX_DESCRIPTION = 1024

const args = parseArgs(process.argv.slice(2))
const tag = args.tag ?? 'v0.0.0-dry-run'
const repo = args.repo ?? process.env.GITHUB_REPOSITORY ?? 'solvapay/skills'
const baseUrl = (args['base-url'] ?? `https://github.com/${repo}/releases/download/${tag}`).replace(/\/$/, '')

const errors = []
const fail = (msg) => errors.push(msg)

if (args.verify) {
  verify(resolve(args.verify))
} else {
  const out = resolve(args.out ?? join(ROOT, 'dist', 'release'))
  build(out)
  verify(out)
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('\n✓ assets and index verified')

// ---------------------------------------------------------------------------

function build(out) {
  checkSkillList()
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })

  const dirty = git(['status', '--porcelain', '--', 'skills']).trim()
  if (dirty) console.warn(`! skills/ has uncommitted changes; assets reflect the working tree:\n${dirty}\n`)

  const index = { $schema: SCHEMA, skills: [] }
  for (const name of SKILLS) {
    const files = skillFiles(name)
    const type = artifactType(files)
    // Last commit touching this skill, so an unchanged skill keeps its digest
    // from release to release and clients can skip the download.
    const mtime = Number(process.env.SOURCE_DATE_EPOCH || git(['log', '-1', '--format=%ct', '--', `skills/${name}`]).trim())
    const asset = `${name}${EXT[type]}`
    const bytes = type === 'skill-md' ? files[0].content : gzip(makeTar(files.map((f) => ({ ...f, mtime }))))
    writeFileSync(join(out, asset), bytes)

    const { description } = frontmatter(readFileSync(join(ROOT, 'skills', name, 'SKILL.md'), 'utf8'), `skills/${name}/SKILL.md`)
    index.skills.push({
      name,
      type,
      description,
      url: `${baseUrl}/${asset}`,
      digest: sha256(bytes),
    })
    console.log(`wrote ${asset.padEnd(24)} ${type.padEnd(8)}  ${files.length} files  ${bytes.length} bytes`)
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 2) + '\n')
  console.log(`wrote ${join(out, 'index.json')}`)
}

function verify(dir) {
  console.log(`\nverifying ${dir}`)
  const indexPath = join(dir, 'index.json')
  if (!existsSync(indexPath)) return fail(`missing ${indexPath}`)
  const index = JSON.parse(readFileSync(indexPath, 'utf8'))

  if (index.$schema !== SCHEMA) fail(`$schema is ${JSON.stringify(index.$schema)}, expected ${SCHEMA}`)
  if (!Array.isArray(index.skills)) return fail('skills is not an array')
  const listed = index.skills.map((s) => s.name)
  if (JSON.stringify(listed) !== JSON.stringify(SKILLS)) fail(`index lists [${listed}], expected [${SKILLS}]`)
  // Exactly one asset per index entry, nothing else.
  const assets = readdirSync(dir).filter((f) => f !== 'index.json').sort()
  const expectedAssets = index.skills.map((s) => `${s.name}${EXT[s.type] ?? ''}`).sort()
  if (JSON.stringify(assets) !== JSON.stringify(expectedAssets)) fail(`assets on disk [${assets}], expected [${expectedAssets}]`)

  for (const entry of index.skills) {
    const where = `skill ${JSON.stringify(entry.name)}`
    for (const key of ['name', 'type', 'description', 'url', 'digest']) {
      if (typeof entry[key] !== 'string' || !entry[key]) fail(`${where}: missing ${key}`)
    }
    const { name, type, description, url, digest } = entry
    if (typeof name !== 'string') continue
    if (name.length < 1 || name.length > 64 || !NAME_RE.test(name)) fail(`${where}: name must be 1-64 chars of a-z, 0-9 and single inner hyphens`)
    if (!EXT[type]) {
      fail(`${where}: type is ${JSON.stringify(type)}, expected skill-md or archive`)
      continue
    }
    const repoFiles = existsSync(join(ROOT, 'skills', name)) ? skillFiles(name) : null
    if (repoFiles && type !== artifactType(repoFiles)) {
      fail(`${where}: type is ${type}, but skills/${name} should ship as ${artifactType(repoFiles)}`)
    }
    if (typeof description === 'string' && description.length > MAX_DESCRIPTION) fail(`${where}: description is ${description.length} chars (max ${MAX_DESCRIPTION})`)
    if (!DIGEST_RE.test(digest ?? '')) fail(`${where}: digest must be sha256:<64 lowercase hex>`)
    const asset = `${name}${EXT[type]}`
    try {
      const u = new URL(url)
      if (!['https:', 'http:'].includes(u.protocol)) fail(`${where}: url must be absolute http(s)`)
      if (!u.pathname.endsWith(`/${asset}`)) fail(`${where}: url should end in /${asset}`)
      if (!args['base-url'] && url !== `${baseUrl}/${asset}`) fail(`${where}: url ${url} does not point at ${baseUrl}`)
    } catch {
      fail(`${where}: url ${JSON.stringify(url)} is not absolute`)
    }

    const assetPath = join(dir, asset)
    if (!existsSync(assetPath)) {
      fail(`${where}: missing ${assetPath}`)
      continue
    }
    const bytes = readFileSync(assetPath)
    if (sha256(bytes) !== digest) fail(`${where}: digest ${digest} does not match ${asset} bytes ${sha256(bytes)}`)

    let files
    if (type === 'skill-md') {
      files = new Map([['SKILL.md', bytes]])
    } else {
      try {
        files = readTarGz(bytes)
      } catch (e) {
        fail(`${where}: ${e.message}`)
        continue
      }
    }
    const skillMd = files.get('SKILL.md')
    if (!skillMd) {
      fail(`${where}: archive has no SKILL.md at its root`)
      continue
    }
    let fm
    try {
      fm = frontmatter(skillMd.toString('utf8'), type === 'skill-md' ? asset : `SKILL.md in ${asset}`)
    } catch (e) {
      fail(`${where}: ${e.message}`)
      continue
    }
    if (fm.name !== name) fail(`${where}: SKILL.md name is ${JSON.stringify(fm.name)}`)
    if (fm.description !== description) fail(`${where}: index description differs from SKILL.md frontmatter`)

    // The asset must match the repo's skill folder byte for byte.
    if (repoFiles) {
      const expected = new Map(repoFiles.map((f) => [f.path, f.content]))
      const got = [...files.keys()].sort()
      const want = [...expected.keys()].sort()
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        fail(`${where}: ${asset} files differ from skills/${name} (extra: ${got.filter((p) => !expected.has(p))}; missing: ${want.filter((p) => !files.has(p))})`)
      }
      for (const [p, content] of files) {
        if (expected.has(p) && !content.equals(expected.get(p))) fail(`${where}: ${p} differs from skills/${name}/${p}`)
      }
    }

    // Cross-check archives with the system tar, which is what
    // `npx skills add <url>` effectively does: extract, then look for SKILL.md
    // at the root.
    if (type === 'archive') {
      const tmp = mkdtempSync(join(tmpdir(), `skill-${name}-`))
      try {
        execFileSync('tar', ['-xzf', assetPath, '-C', tmp])
        if (!existsSync(join(tmp, 'SKILL.md'))) fail(`${where}: system tar extraction has no root SKILL.md`)
      } catch (e) {
        fail(`${where}: system tar could not extract: ${e.message}`)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    }

    console.log(`ok ${name.padEnd(18)} ${type.padEnd(8)}  ${files.size} files  ${digest}`)
  }
}

// ---------------------------------------------------------------------------

function checkSkillList() {
  // Every tracked skills/<dir>/SKILL.md must be in SKILLS, so a new skill
  // cannot silently miss the release.
  const tracked = git(['ls-files', '--', 'skills/*/SKILL.md'])
    .split('\n')
    .filter(Boolean)
    .map((p) => p.split('/')[1])
  const missing = tracked.filter((n) => !SKILLS.includes(n))
  const extra = SKILLS.filter((n) => !tracked.includes(n))
  if (missing.length) throw new Error(`skills not in SKILLS list: ${missing.join(', ')}`)
  if (extra.length) throw new Error(`SKILLS lists folders without a tracked SKILL.md: ${extra.join(', ')}`)
}

// A folder holding only SKILL.md ships as a plain file, anything else as an
// archive.
function artifactType(files) {
  return files.length === 1 && files[0].path === 'SKILL.md' ? 'skill-md' : 'archive'
}

// Tracked files of one skill folder, as { path, mode, content }.
function skillFiles(name) {
  const prefix = `skills/${name}/`
  const out = []
  const lines = git(['ls-files', '-s', '-z', '--', prefix]).split('\0').filter(Boolean)
  for (const line of lines) {
    const [meta, path] = line.split('\t')
    const mode = meta.split(' ')[0]
    const rel = path.slice(prefix.length)
    const abs = join(ROOT, path)
    if (mode === '120000') {
      const target = git(['cat-file', '-p', meta.split(' ')[1]])
      throw new Error(`${path} is a symlink to ${target}; the skills CLI rejects links in archives`)
    }
    if (mode !== '100644' && mode !== '100755') throw new Error(`${path} has unsupported git mode ${mode}`)
    out.push({ path: rel, mode: mode === '100755' ? 0o755 : 0o644, content: readFileSync(abs) })
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

function frontmatter(text, label) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!m) throw new Error(`${label} has no YAML frontmatter`)
  const data = parseYaml(m[1])
  if (typeof data?.name !== 'string' || typeof data?.description !== 'string') {
    throw new Error(`${label} frontmatter needs string name and description`)
  }
  // Folded block scalars (`description: >`) keep a trailing newline.
  return { name: data.name, description: data.description.trim() }
}

// ---------------------------------------------------------------------------
// ustar writer/reader. Only regular files; directories are implied by paths.

function makeTar(files) {
  const blocks = []
  for (const f of files) {
    const header = Buffer.alloc(512)
    const [prefix, base] = splitUstarPath(f.path)
    header.write(base, 0, 100, 'utf8')
    writeOctal(header, f.mode, 100, 8)
    writeOctal(header, 0, 108, 8) // uid
    writeOctal(header, 0, 116, 8) // gid
    writeOctal(header, f.content.length, 124, 12)
    writeOctal(header, f.mtime, 136, 12)
    header.fill(0x20, 148, 156) // checksum placeholder
    header[156] = 0x30 // '0' regular file
    header.write('ustar\0', 257, 6, 'latin1')
    header.write('00', 263, 2, 'latin1')
    header.write(prefix, 345, 155, 'utf8')
    let sum = 0
    for (const b of header) sum += b
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'latin1')
    blocks.push(header, f.content)
    const pad = (512 - (f.content.length % 512)) % 512
    if (pad) blocks.push(Buffer.alloc(pad))
  }
  blocks.push(Buffer.alloc(1024))
  return Buffer.concat(blocks)
}

function splitUstarPath(path) {
  if (Buffer.byteLength(path) <= 100) return ['', path]
  // Split at a slash so that prefix <= 155 and name <= 100 bytes.
  for (let i = path.lastIndexOf('/'); i > 0; i = path.lastIndexOf('/', i - 1)) {
    const prefix = path.slice(0, i)
    const base = path.slice(i + 1)
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(base) <= 100) return [prefix, base]
  }
  throw new Error(`path too long for ustar: ${path}`)
}

function writeOctal(buf, value, offset, length) {
  buf.write(value.toString(8).padStart(length - 1, '0') + '\0', offset, length, 'latin1')
}

function gzip(buf) {
  const gz = gzipSync(buf, { level: 9 })
  // Header bytes 4-7 are mtime (zlib writes 0) and byte 9 is the OS, which
  // depends on the platform zlib was built for. Pin it to Unix so local and CI
  // builds of the same commit produce the same bytes.
  gz[9] = 3
  return gz
}

// Mirrors the skills CLI's well-known archive reader: regular files only,
// links rejected, no absolute or parent paths, SKILL.md at the root.
function readTarGz(gz) {
  const tar = gunzipSync(gz)
  const files = new Map()
  for (let off = 0; off + 512 <= tar.length; ) {
    const h = tar.subarray(off, off + 512)
    if (h.every((b) => b === 0)) break
    const str = (o, l) => {
      const s = h.subarray(o, o + l)
      const nul = s.indexOf(0)
      return (nul >= 0 ? s.subarray(0, nul) : s).toString('utf8')
    }
    const name = str(0, 100)
    const prefix = str(345, 155)
    const path = prefix ? `${prefix}/${name}` : name
    const size = parseInt(str(124, 12).trim() || '0', 8)
    const type = h[156]
    off += 512
    if (type === 0x31 || type === 0x32) throw new Error(`archive contains a link: ${path}`)
    if (type !== 0 && type !== 0x30 && type !== 0x35) throw new Error(`archive entry ${path} has unsupported type ${String.fromCharCode(type)}`)
    const parts = path.split('/').filter(Boolean)
    if (path.startsWith('/') || path.includes('\\') || parts.some((p) => p === '.' || p === '..')) {
      throw new Error(`unsafe archive path: ${path}`)
    }
    if (type !== 0x35) files.set(parts.join('/'), Buffer.from(tar.subarray(off, off + size)))
    off += Math.ceil(size / 512) * 512
  }
  return files
}

// ---------------------------------------------------------------------------

function sha256(buf) {
  return `sha256:${createHash('sha256').update(buf).digest('hex')}`
}

function git(argv) {
  return execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8' })
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`)
    const key = a.slice(2)
    if (key === 'dry-run') out[key] = true
    else out[key] = argv[++i]
  }
  return out
}
