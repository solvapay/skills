import { createSolvaPayMcpFetch } from '@solvapay/mcp/fetch'
import { registerTools } from './tools/index'

export default createSolvaPayMcpFetch({
  registerTools,
})
