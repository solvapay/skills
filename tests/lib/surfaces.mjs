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
    pathDepMarker: /"@solvapay\/mcp":\s*"(file:|workspace:)/,
    pathDepOnCheckout: false,
    fileDeps: Object.freeze([]),
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
    waivers: Object.freeze([
      {
        id: 'ts-server-wasm-stub',
        kind: 'stub',
        reason:
          '@solvapay/server-wasm is not on the npm registry (404), so the template npm install fails.',
        ref: 'DEV-0000',
        provesAt: 'install',
        failureMatch: /@solvapay\/server-wasm/,
        registryProbe: {
          url: 'https://registry.npmjs.org/@solvapay%2Fserver-wasm',
          expectMissing: true,
        },
        name: '@solvapay/server-wasm',
        version: '0.1.0',
      },
      {
        id: 'ts-core-browser-wasm-export',
        kind: 'patch',
        reason:
          'Published @solvapay/core@1.7.0 predates the ./browser-wasm export (present in the local checkout at the same version). No release was cut, so the version number is not a usable stale signal.',
        ref: 'DEV-0000',
        provesAt: 'build',
        failureMatch: /"\.\/browser-wasm" is not exported/,
        exportProbe: {
          file: 'node_modules/@solvapay/core/package.json',
          subpath: './browser-wasm',
          expectMissing: true,
        },
        file: 'src/install-widget-core.ts',
        find: [
          "import { installBrowserCoreJs } from '@solvapay/core/browser-wasm'",
          "import * as binding from '@solvapay/server-wasm/browser-js'",
          '',
          'export function installSolvaPayWidgetCore(): void {',
          "  if (binding.SOLVAPAY_BROWSER_JS_CORE !== 'solvapay-browser-js-core') {",
          "    throw new Error('SolvaPay widget core failed to initialize: missing wasm2js marker')",
          '  }',
          '  installBrowserCoreJs(binding)',
          '}',
        ].join('\n'),
        replace: 'export function installSolvaPayWidgetCore(): void {}',
      },
    ]),
  },
  {
    id: 'python',
    e2ePort: 13030,
    expectFiles: Object.freeze(['main.py', 'tools.py', 'pyproject.toml', 'scripts/http.sh']),
    installMarker: '.venv',
    pathDepMarker: /\[tool\.uv\.sources\]/,
    pathDepOnCheckout: true,
    fileDeps: Object.freeze([]),
    extraScaffoldArgs: Object.freeze([]),
    discoveryHeaders: Object.freeze({}),
    assertHiddenUi: true,
    requiredTools: Object.freeze(['account', 'activate_plan']),
    promptNames: Object.freeze(['upgrade', 'manage_account', 'topup', 'activate_plan']),
    anonymousDiscovery: true,
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
    extraScaffoldArgs: Object.freeze([]),
    discoveryHeaders: Object.freeze({}),
    assertHiddenUi: false,
    requiredTools: Object.freeze(['account', 'activate_plan']),
    promptNames: Object.freeze(['upgrade', 'manage_account', 'topup', 'activate_plan']),
    anonymousDiscovery: true,
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
    extraScaffoldArgs: Object.freeze(['--module', 'github.com/solvapay/e2e-go']),
    discoveryHeaders: Object.freeze({}),
    assertHiddenUi: true,
    requiredTools: Object.freeze(['account', 'activate_plan']),
    promptNames: Object.freeze(['upgrade', 'manage_account', 'topup', 'activate_plan']),
    anonymousDiscovery: true,
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
    extraScaffoldArgs: Object.freeze([]),
    discoveryHeaders: Object.freeze({}),
    assertHiddenUi: false,
    requiredTools: Object.freeze(['account', 'activate_plan']),
    promptNames: Object.freeze(['upgrade', 'manage_account', 'topup', 'activate_plan']),
    anonymousDiscovery: true,
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
