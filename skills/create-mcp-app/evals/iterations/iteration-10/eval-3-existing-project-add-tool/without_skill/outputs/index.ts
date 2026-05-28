import type { AdditionalToolsContext } from '@solvapay/mcp'
import { registerManagePet } from './manage_pet'

export function registerTools(ctx: AdditionalToolsContext): void {
  registerManagePet(ctx)
}
