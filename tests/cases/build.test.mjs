import { spawnSync } from 'node:child_process'

export const name = 'build'
export const scope = 'lane'

/**
 * @param {{ language: { build: { command: string, args: readonly string[] }, timeoutMs: number }, workspace: string }} ctx
 */
export async function run(ctx) {
  const { command, args } = ctx.language.build
  const result = spawnSync(command, [...args], {
    cwd: ctx.workspace,
    encoding: 'utf8',
    timeout: ctx.language.timeoutMs,
    env: process.env,
  })
  if (result.status !== 0) {
    const output = `${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim()
    throw new Error(output || `build exit ${result.status}`)
  }
}
