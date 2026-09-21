import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { describe, it } from 'node:test'
import { waitForHttp } from './server.mjs'

describe('waitForHttp', () => {
  it('resolves once the port serves HTTP', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(204)
      res.end()
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    try {
      await waitForHttp(address.port, 5_000)
    } finally {
      await new Promise(resolve => server.close(resolve))
    }
  })
})
