import { LANGUAGE_IDS, getLanguage } from '../../skills/create-mcp-app/scripts/lib/languages.mjs'

export { LANGUAGE_IDS, LANGUAGES, getLanguage } from '../../skills/create-mcp-app/scripts/lib/languages.mjs'

/** H2 order every `references/languages/<id>.md` must follow. */
export const LANGUAGE_H2_SKELETON = Object.freeze([
  'Imports',
  'Registration',
  'Respond',
  'File layout',
  'Install and run',
  'Environment',
  'Troubleshooting',
])

export const LANE_CASES = Object.freeze([
  'scaffold-shape',
  'install',
  'build',
  'mcp-handshake',
  'paywall-gate',
])

/**
 * @typedef {object} VersionProbe
 * @property {string} file
 * @property {string} [json]
 * @property {RegExp} [regex]
 */

/**
 * @typedef {object} RegistryProbe
 * @property {string} url
 * @property {true} expectMissing
 */

/**
 * @typedef {object} ExportProbe
 * @property {string} file
 * @property {string} subpath
 * @property {true} expectMissing
 */

/**
 * @typedef {object} Waiver
 * @property {string} id
 * @property {'patch' | 'stub'} kind
 * @property {string} reason
 * @property {string} ref
 * @property {string} provesAt
 * @property {RegExp} failureMatch
 * @property {VersionProbe} [versionProbe]
 * @property {RegistryProbe} [registryProbe]
 * @property {ExportProbe} [exportProbe]
 * @property {string} [observedAgainst]
 * @property {string} [file]
 * @property {string} [find]
 * @property {string} [replace]
 * @property {string} [name]
 * @property {string} [version]
 * @property {string} [checkoutRel]
 */

/**
 * @typedef {object} TestSurface
 * @property {string} id
 * @property {number} e2ePort
 * @property {readonly string[]} expectFiles
 * @property {string} installMarker
 * @property {RegExp} pathDepMarker
 * @property {boolean} pathDepOnCheckout
 * @property {readonly { name: string, rel: string }[]} fileDeps
 * @property {readonly string[]} reinstallPackages
 * @property {readonly { path: string, contents: string }[]} seedFiles
 * @property {readonly string[]} extraScaffoldArgs
 * @property {Record<string, string>} discoveryHeaders
 * @property {boolean} assertHiddenUi
 * @property {readonly string[]} requiredTools
 * @property {readonly string[]} promptNames
 * @property {boolean} anonymousDiscovery
 * @property {number} timeoutMs
 * @property {{ command: string, args: readonly string[] }} build
 * @property {readonly Waiver[]} waivers
 */

/** @type {readonly TestSurface[]} */
export const SURFACES = Object.freeze([
  {
    id: 'ts',
    e2ePort: 8787,
    expectFiles: Object.freeze([
      'src/worker.ts',
      'src/tools/index.ts',
      'package.json',
      'wrangler.jsonc',
    ]),
    installMarker: 'node_modules',
    pathDepMarker: /"@solvapay\/mcp":\s*"(file:|link:|workspace:)/,
    pathDepOnCheckout: true,
    fileDeps: Object.freeze([{ name: '@solvapay/server-wasm', rel: 'sdks/wasm' }]),
    reinstallPackages: Object.freeze([]),
    extraScaffoldArgs: Object.freeze([]),
    discoveryHeaders: Object.freeze({}),
    assertHiddenUi: true,
    requiredTools: Object.freeze(['account', 'activate_plan']),
    promptNames: Object.freeze(['upgrade', 'manage_account', 'topup', 'activate_plan']),
    anonymousDiscovery: false,
    seedFiles: Object.freeze([
      { path: 'src/assets/mcp-app.html', contents: '<!doctype html><title>e2e</title>' },
    ]),
    timeoutMs: 180_000,
    build: { command: 'npm', args: Object.freeze(['run', 'build']) },
    waivers: Object.freeze([]),
  },
  {
    id: 'python',
    e2ePort: 13030,
    expectFiles: Object.freeze(['main.py', 'tools.py', 'pyproject.toml', 'scripts/http.sh']),
    installMarker: '.venv',
    pathDepMarker: /\[tool\.uv\.sources\]/,
    pathDepOnCheckout: true,
    fileDeps: Object.freeze([]),
    reinstallPackages: Object.freeze(['solvapay-mcp', 'solvapay']),
    extraScaffoldArgs: Object.freeze([]),
    discoveryHeaders: Object.freeze({}),
    assertHiddenUi: true,
    requiredTools: Object.freeze(['account', 'activate_plan']),
    promptNames: Object.freeze(['upgrade', 'manage_account', 'topup', 'activate_plan']),
    anonymousDiscovery: false,
    seedFiles: Object.freeze([]),
    timeoutMs: 600_000,
    build: { command: 'uv', args: Object.freeze(['run', 'python', '-c', 'import main, tools']) },
    waivers: Object.freeze([]),
  },
  {
    id: 'ruby',
    e2ePort: 13030,
    expectFiles: Object.freeze(['main.rb', 'tools.rb', 'Gemfile', 'scripts/http.sh']),
    installMarker: 'Gemfile.lock',
    pathDepMarker: /gem\s+"solvapay",\s*path:/,
    pathDepOnCheckout: true,
    fileDeps: Object.freeze([]),
    reinstallPackages: Object.freeze([]),
    extraScaffoldArgs: Object.freeze([]),
    discoveryHeaders: Object.freeze({}),
    assertHiddenUi: false,
    requiredTools: Object.freeze(['account', 'activate_plan']),
    promptNames: Object.freeze(['upgrade', 'manage_account', 'topup', 'activate_plan']),
    anonymousDiscovery: false,
    seedFiles: Object.freeze([]),
    timeoutMs: 300_000,
    build: { command: 'bundle', args: Object.freeze(['exec', 'ruby', '-c', 'main.rb']) },
    waivers: Object.freeze([]),
  },
  {
    id: 'go',
    e2ePort: 13030,
    expectFiles: Object.freeze(['main.go', 'tools.go', 'go.mod', 'scripts/http.sh']),
    installMarker: 'go.sum',
    pathDepMarker: /^replace\s+/m,
    pathDepOnCheckout: true,
    fileDeps: Object.freeze([]),
    reinstallPackages: Object.freeze([]),
    extraScaffoldArgs: Object.freeze(['--module', 'github.com/solvapay/e2e-go']),
    discoveryHeaders: Object.freeze({}),
    assertHiddenUi: true,
    requiredTools: Object.freeze(['account', 'activate_plan']),
    promptNames: Object.freeze(['upgrade', 'manage_account', 'topup', 'activate_plan']),
    anonymousDiscovery: false,
    seedFiles: Object.freeze([]),
    timeoutMs: 300_000,
    build: { command: 'go', args: Object.freeze(['build', './...']) },
    waivers: Object.freeze([]),
  },
  {
    id: 'rust',
    e2ePort: 13030,
    expectFiles: Object.freeze(['src/main.rs', 'Cargo.toml', 'scripts/http.sh']),
    installMarker: 'Cargo.lock',
    pathDepMarker: /solvapay\s*=\s*\{\s*path\s*=/,
    pathDepOnCheckout: true,
    fileDeps: Object.freeze([]),
    reinstallPackages: Object.freeze([]),
    extraScaffoldArgs: Object.freeze([]),
    discoveryHeaders: Object.freeze({}),
    assertHiddenUi: false,
    requiredTools: Object.freeze(['account', 'activate_plan']),
    promptNames: Object.freeze(['upgrade', 'manage_account', 'topup', 'activate_plan']),
    anonymousDiscovery: false,
    seedFiles: Object.freeze([]),
    timeoutMs: 900_000,
    build: { command: 'cargo', args: Object.freeze(['build']) },
    waivers: Object.freeze([]),
  },
])

/**
 * @param {string} id
 * @returns {import('../../skills/create-mcp-app/scripts/lib/languages.mjs').LanguageRow & TestSurface}
 */
export function getSurface(id) {
  const language = getLanguage(id)
  const surface = SURFACES.find(row => row.id === id)
  if (!surface) {
    throw new Error(`Unknown test surface '${id}'. Valid: ${LANGUAGE_IDS.join(', ')}`)
  }
  return { ...language, ...surface }
}
