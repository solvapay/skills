import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PUBLISHED_TOOL_NAME_RE,
  assertToolNameForCli,
  buildCreateSolvapayArgs,
  cliHelpMentionsLanguage,
  resolveLanguageForward,
} from './scaffold-cli.mjs'

describe('cliHelpMentionsLanguage', () => {
  it('is true when --help lists --language', () => {
    assert.equal(
      cliHelpMentionsLanguage('  -l, --language <id>    ts, python, ruby, go, rust'),
      true,
    )
  })

  it('is false for published 0.6.1 help that has no language flag', () => {
    const published =
      'Usage:\n  npm create solvapay <project-name> -- --type <kind> [flags]\n\n' +
      'Common flags:\n  --type <kind>\n  --dev\n  --help\n  --product\n  --version\n  --yes\n'
    assert.equal(cliHelpMentionsLanguage(published), false)
  })
})

describe('resolveLanguageForward', () => {
  it('forwards --language when the CLI advertises it', () => {
    const result = resolveLanguageForward({ supportsLanguage: true, languageId: 'python' })
    assert.deepEqual(result, { forward: true })
  })

  it('omits --language for ts on a CLI that does not advertise it', () => {
    const result = resolveLanguageForward({ supportsLanguage: false, languageId: 'ts' })
    assert.equal(result.forward, false)
    assert.equal(result.omit, true)
    assert.match(result.message ?? '', /omit|--language/i)
  })

  it('fails for a non-ts language on a CLI that does not advertise --language', () => {
    const result = resolveLanguageForward({ supportsLanguage: false, languageId: 'python' })
    assert.equal(result.forward, false)
    assert.ok(result.error)
    assert.match(result.error, /python/)
    assert.match(result.error, /cannot scaffold|does not support|--language/i)
  })
})

describe('assertToolNameForCli', () => {
  it('allows snake_case when the CLI supports --language', () => {
    const result = assertToolNameForCli({
      supportsLanguage: true,
      toolName: 'generate_haiku',
    })
    assert.equal(result.ok, true)
  })

  it('rejects snake_case on the published camelCase-only CLI', () => {
    const result = assertToolNameForCli({
      supportsLanguage: false,
      toolName: 'generate_haiku',
    })
    assert.equal(result.ok, false)
    assert.match(result.error ?? '', /camelCase/)
    assert.match(result.error ?? '', /rename/)
    assert.equal(PUBLISHED_TOOL_NAME_RE.test('generate_haiku'), false)
    assert.equal(PUBLISHED_TOOL_NAME_RE.test('generateHaiku'), true)
  })

  it('allows helloTool on the published CLI', () => {
    const result = assertToolNameForCli({
      supportsLanguage: false,
      toolName: 'helloTool',
    })
    assert.equal(result.ok, true)
  })

  it('does not rewrite the tool name', () => {
    const result = assertToolNameForCli({
      supportsLanguage: false,
      toolName: 'generate_haiku',
    })
    assert.equal(result.rewritten, undefined)
    assert.notEqual(result.toolName, 'generateHaiku')
  })
})

describe('buildCreateSolvapayArgs', () => {
  const base = {
    cli: '/cli.js',
    projectName: 'haiku-mcp',
    languageId: 'ts',
    toolName: 'helloTool',
    useDev: false,
  }

  it('forwards --language when supported', () => {
    const args = buildCreateSolvapayArgs({
      ...base,
      languageId: 'ruby',
      supportsLanguage: true,
      toolName: 'generate_haiku',
    })
    assert.deepEqual(args.slice(0, 10), [
      '/cli.js',
      'haiku-mcp',
      '--type',
      'mcp',
      '--no-openapi',
      '--language',
      'ruby',
      '--yes',
      '--tool-name',
      'generate_haiku',
    ])
  })

  it('omits --language for ts when the CLI does not advertise it', () => {
    const args = buildCreateSolvapayArgs({ ...base, supportsLanguage: false })
    assert.equal(args.includes('--language'), false)
    assert.ok(args.includes('--tool-name'))
    assert.ok(args.includes('helloTool'))
  })

  it('always passes --dev when the gate resolved checkout (no separate refuse branch)', () => {
    const args = buildCreateSolvapayArgs({
      ...base,
      supportsLanguage: true,
      useDev: true,
    })
    assert.ok(args.includes('--dev'))
  })
})
