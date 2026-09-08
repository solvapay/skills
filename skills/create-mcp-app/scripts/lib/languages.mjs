/** Shared language rows. Skill scripts and the e2e harness both read this. */

export const LANGUAGE_IDS = Object.freeze(['ts', 'python', 'ruby', 'go', 'rust'])

/**
 * @typedef {object} LanguageRow
 * @property {string} id
 * @property {string} label
 * @property {number} port
 * @property {readonly { bin: string, install: string }[]} requires
 * @property {string} registry
 * @property {string} manifest
 * @property {readonly ('scratch' | 'openapi')[]} inputModes
 * @property {{ command: string, args: readonly string[] }} install
 * @property {{ command: string, args: readonly string[] }} serve
 * @property {string} host
 * @property {string} reference
 */

/** @type {readonly LanguageRow[]} */
export const LANGUAGES = Object.freeze([
  {
    id: 'ts',
    label: 'TypeScript',
    port: 8787,
    requires: [{ bin: 'npm', install: 'https://nodejs.org' }],
    registry: 'https://registry.npmjs.org/@solvapay%2Fmcp',
    manifest: 'package.json',
    inputModes: Object.freeze(['scratch', 'openapi']),
    install: { command: 'npm', args: Object.freeze(['install']) },
    serve: { command: 'npx', args: Object.freeze(['wrangler', 'dev', '--ip', '127.0.0.1', '--port', '8787']) },
    host: 'Cloudflare Workers (wrangler) on :8787',
    reference: 'references/languages/ts.md',
  },
  {
    id: 'python',
    label: 'Python',
    port: 3030,
    requires: [{ bin: 'uv', install: 'https://docs.astral.sh/uv/' }],
    registry: 'https://pypi.org/pypi/solvapay/json',
    manifest: 'pyproject.toml',
    inputModes: Object.freeze(['scratch']),
    install: { command: 'uv', args: Object.freeze(['sync']) },
    serve: { command: 'bash', args: Object.freeze(['scripts/http.sh']) },
    host: 'HTTP process on :3030',
    reference: 'references/languages/python.md',
  },
  {
    id: 'ruby',
    label: 'Ruby',
    port: 3030,
    requires: [{ bin: 'bundle', install: 'https://bundler.io' }],
    registry: 'https://rubygems.org/api/v1/gems/solvapay.json',
    manifest: 'Gemfile',
    inputModes: Object.freeze(['scratch']),
    install: { command: 'bundle', args: Object.freeze(['install']) },
    serve: { command: 'bash', args: Object.freeze(['scripts/http.sh']) },
    host: 'HTTP process on :3030',
    reference: 'references/languages/ruby.md',
  },
  {
    id: 'go',
    label: 'Go',
    port: 3030,
    requires: [{ bin: 'go', install: 'https://go.dev/dl' }],
    registry: 'https://proxy.golang.org/github.com/solvapay/solvapay-sdk/sdks/go/@v/list',
    manifest: 'go.mod',
    inputModes: Object.freeze(['scratch']),
    install: { command: 'go', args: Object.freeze(['mod', 'tidy']) },
    serve: { command: 'bash', args: Object.freeze(['scripts/http.sh']) },
    host: 'HTTP process on :3030',
    reference: 'references/languages/go.md',
  },
  {
    id: 'rust',
    label: 'Rust',
    port: 3030,
    requires: [{ bin: 'cargo', install: 'https://rustup.rs' }],
    registry: 'https://crates.io/api/v1/crates/solvapay',
    manifest: 'Cargo.toml',
    inputModes: Object.freeze(['scratch']),
    install: { command: 'cargo', args: Object.freeze(['fetch']) },
    serve: { command: 'bash', args: Object.freeze(['scripts/http.sh']) },
    host: 'HTTP process on :3030',
    reference: 'references/languages/rust.md',
  },
])

/**
 * @param {string} id
 * @returns {LanguageRow}
 */
export function getLanguage(id) {
  const row = LANGUAGES.find(language => language.id === id)
  if (!row) {
    throw new Error(`Unknown language '${id}'. Valid: ${LANGUAGE_IDS.join(', ')}`)
  }
  return row
}
