import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @param {number} port
 */
function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    socket.once('connect', () => {
      socket.end()
      reject(new Error(`127.0.0.1:${port} is already in use — stop the other listener or pick a free e2ePort`))
    })
    socket.once('error', () => {
      socket.destroy()
      resolve()
    })
  })
}

/**
 * @param {number} port
 * @param {number} timeoutMs
 */
function waitForPort(port, timeoutMs) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = createConnection({ port, host: '127.0.0.1' })
      socket.once('connect', () => {
        socket.end()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`timed out waiting for 127.0.0.1:${port}`))
          return
        }
        setTimeout(attempt, 400)
      })
    }
    attempt()
  })
}

/**
 * @param {object} input
 * @param {import('../../skills/create-mcp-app/scripts/lib/languages.mjs').LanguageRow} input.language
 * @param {string} input.cwd
 * @param {string} input.logDir
 */
export async function startServer(input) {
  const { language, cwd, logDir } = input
  const chunks = []
  await assertPortFree(language.e2ePort)
  const child = spawn(language.serve.command, [...language.serve.args], {
    cwd,
    env: {
      ...process.env,
      MCP_PORT: String(language.e2ePort),
      MCP_PUBLIC_BASE_URL: `http://127.0.0.1:${language.e2ePort}`,
    },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', chunk => chunks.push(chunk))
  child.stderr.on('data', chunk => chunks.push(chunk))

  const flush = () => {
    writeFileSync(join(logDir, 'server.log'), Buffer.concat(chunks))
  }

  try {
    await waitForPort(language.e2ePort, language.timeoutMs)
    flush()
  } catch (error) {
    flush()
    await stopServer(child)
    throw new Error(
      `server for ${language.id} did not bind :${language.e2ePort}: ${error instanceof Error ? error.message : error}`,
    )
  }

  return {
    child,
    port: language.e2ePort,
    url: `http://127.0.0.1:${language.e2ePort}`,
    flush,
  }
}

/**
 * @param {import('node:child_process').ChildProcess} child
 */
export async function stopServer(child) {
  if (!child.pid) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      // already gone
    }
  }
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 3_000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}
