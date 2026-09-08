let nextId = 1

export class RpcError extends Error {
  /**
   * @param {string} message
   * @param {Record<string, unknown>} [info]
   */
  constructor(message, info = {}) {
    super(message)
    this.name = 'RpcError'
    this.info = info
  }
}

function toMcpEndpoint(workerUrl) {
  const trimmed = workerUrl.replace(/\/$/, '')
  return trimmed.endsWith('/mcp') ? trimmed : `${trimmed}/mcp`
}

/**
 * @param {Response} res
 */
async function readJsonOrSse(res) {
  const type = res.headers.get('content-type') ?? ''
  const text = await res.text()
  if (type.includes('text/event-stream')) {
    const dataLine = text.split('\n').find(line => line.startsWith('data:'))
    if (!dataLine) throw new RpcError('SSE response missing data line', { body: text })
    return JSON.parse(dataLine.slice(5).trim())
  }
  return JSON.parse(text)
}

/**
 * @param {string} workerUrl
 * @param {string} method
 * @param {Record<string, unknown>} [params]
 * @param {{ bearerToken?: string, headers?: Record<string, string> }} [options]
 */
export async function rpc(workerUrl, method, params = {}, options = {}) {
  const body = { jsonrpc: '2.0', id: nextId++, method, params }
  const url = toMcpEndpoint(workerUrl)
  /** @type {Record<string, string>} */
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    ...options.headers,
  }
  if (options.bearerToken) headers.authorization = `Bearer ${options.bearerToken}`
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new RpcError(`HTTP ${res.status} from ${url}`, {
      httpStatus: res.status,
      body: text,
      wwwAuthenticate: res.headers.get('www-authenticate'),
    })
  }
  const payload = await readJsonOrSse(res)
  if (payload.error) {
    throw new RpcError(payload.error.message ?? 'JSON-RPC error', {
      code: payload.error.code,
      data: payload.error.data,
    })
  }
  return payload.result
}

/**
 * @param {string} workerUrl
 * @param {{ bearerToken?: string }} [options]
 */
export async function initialize(workerUrl, options = {}) {
  return rpc(
    workerUrl,
    'initialize',
    {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'solvapay-skill-e2e', version: '1.0.0' },
    },
    options,
  )
}

/**
 * @param {string} workerUrl
 * @param {{ bearerToken?: string }} [options]
 */
export async function listTools(workerUrl, options = {}) {
  const result = await rpc(workerUrl, 'tools/list', {}, options)
  return Array.isArray(result?.tools) ? result.tools : []
}

/**
 * @param {string} workerUrl
 * @param {{ bearerToken?: string }} [options]
 */
export async function listPrompts(workerUrl, options = {}) {
  const result = await rpc(workerUrl, 'prompts/list', {}, options)
  return Array.isArray(result?.prompts) ? result.prompts : []
}

/**
 * @param {string} workerUrl
 * @param {string} name
 * @param {Record<string, unknown>} args
 * @param {{ bearerToken?: string }} [options]
 */
export async function callTool(workerUrl, name, args, options = {}) {
  return rpc(workerUrl, 'tools/call', { name, arguments: args }, options)
}
