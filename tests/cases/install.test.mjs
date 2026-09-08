import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const name = 'install'
export const scope = 'lane'

/**
 * @param {{ language: import('../../skills/create-mcp-app/scripts/lib/languages.mjs').LanguageRow, workspace: string, scaffoldLog: string }} ctx
 */
export async function run(ctx) {
  const marker = join(ctx.workspace, ctx.language.installMarker)
  if (!existsSync(marker)) {
    if (/⚠️/.test(ctx.scaffoldLog)) {
      throw new Error(
        `scaffolder printed ⚠️ — install is a soft warning, not success\n${ctx.scaffoldLog}`,
      )
    }
    throw new Error(`install marker missing: ${ctx.language.installMarker}`)
  }
}
