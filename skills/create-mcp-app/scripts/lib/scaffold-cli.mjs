import { spawnSync } from 'node:child_process'

/** Published create-solvapay@0.6.1 TOOL_NAME_RE — camelCase only, no underscores. */
export const PUBLISHED_TOOL_NAME_RE = /^[a-z][a-zA-Z0-9]*$/

/** Checkout / language-aware CLI — camelCase or snake_case. */
export const CHECKOUT_TOOL_NAME_RE = /^[a-z][a-zA-Z0-9_]*$/

/**
 * @param {string} helpText
 * @returns {boolean}
 */
export function cliHelpMentionsLanguage(helpText) {
  return /--language\b/.test(helpText)
}

/**
 * @param {string} cliPath
 * @param {typeof spawnSync} [spawn]
 * @returns {boolean}
 */
export function probeCliLanguageSupport(cliPath, spawn = spawnSync) {
  const result = spawn(process.execPath, [cliPath, '--help'], {
    encoding: 'utf8',
    timeout: 15_000,
  })
  const text = `${result.stdout ?? ''}${result.stderr ?? ''}`
  return cliHelpMentionsLanguage(text)
}

/**
 * @param {{ supportsLanguage: boolean, languageId: string }} input
 * @returns {{ forward: boolean, omit?: boolean, message?: string, error?: string }}
 */
export function resolveLanguageForward({ supportsLanguage, languageId }) {
  if (supportsLanguage) return { forward: true }
  if (languageId === 'ts') {
    return {
      forward: false,
      omit: true,
      message:
        'Resolved create-solvapay CLI does not advertise --language; omitting it (TypeScript-only published CLI).',
    }
  }
  return {
    forward: false,
    error:
      `Resolved create-solvapay CLI does not support --language and cannot scaffold ${languageId}. ` +
      'Use a solvapay-sdk checkout (SOLVAPAY_SDK_ROOT) whose create-solvapay build advertises --language, ' +
      'or pick TypeScript.',
  }
}

/**
 * @param {{ supportsLanguage: boolean, toolName?: string }} input
 * @returns {{ ok: boolean, error?: string, rewritten?: undefined }}
 */
export function assertToolNameForCli({ supportsLanguage, toolName }) {
  if (!toolName) return { ok: true }
  const re = supportsLanguage ? CHECKOUT_TOOL_NAME_RE : PUBLISHED_TOOL_NAME_RE
  if (re.test(toolName)) return { ok: true }
  if (!supportsLanguage) {
    return {
      ok: false,
      error:
        `"${toolName}" is not a valid --tool-name for this create-solvapay CLI ` +
        '(camelCase only: start lowercase, letters and digits, no underscores). ' +
        'Pass camelCase (e.g. generateHaiku), then rename the MCP identifier and file stem ' +
        'to snake_case (generate_haiku) in source after scaffold. Do not rewrite the flag silently.',
    }
  }
  return {
    ok: false,
    error:
      `"${toolName}" must be camelCase or snake_case (start lowercase; letters, digits, underscores).`,
  }
}

/**
 * @param {{
 *   cli: string,
 *   projectName: string,
 *   languageId: string,
 *   supportsLanguage: boolean,
 *   toolName?: string,
 *   modulePath?: string,
 *   useDev: boolean,
 *   apiBaseUrl?: string,
 *   skipInit?: boolean,
 *   skipInstall?: boolean,
 * }} input
 * @returns {string[]}
 */
export function buildCreateSolvapayArgs({
  cli,
  projectName,
  languageId,
  supportsLanguage,
  toolName,
  modulePath,
  useDev,
  apiBaseUrl,
  skipInit,
  skipInstall,
}) {
  const args = [cli, projectName, '--type', 'mcp', '--no-openapi']
  if (supportsLanguage) {
    args.push('--language', languageId)
  }
  args.push('--yes')
  if (toolName) args.push('--tool-name', toolName)
  if (modulePath) args.push('--module', modulePath)
  if (useDev) args.push('--dev')
  if (apiBaseUrl) args.push('--api-base', apiBaseUrl)
  if (skipInit) args.push('--skip-init')
  if (skipInstall) args.push('--skip-install')
  return args
}
