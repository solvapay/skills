import { createSolvaPayMcpFetch } from '@solvapay/mcp'
import { registerTools } from './tools/index'

export default createSolvaPayMcpFetch({
  registerTools,
})
