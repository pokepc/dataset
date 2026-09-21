import { spawnSync } from 'node:child_process'
import { createServer, get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'
import { connect } from 'node:net'
import { describe, expect, it, vi } from 'vitest'

const blocked = 'External network access is disabled in tests'

describe('test network guard', () => {
  it.each([
    'https://pokeapi.co/api/v2/version-group/',
    new URL('https://bulbapedia.bulbagarden.net/wiki/Pikachu'),
    new Request('https://api.openai.com/v1/responses'),
  ])('rejects unmocked fetch requests: %s', async (input) => {
    await expect(fetch(input)).rejects.toThrow(blocked)
  })

  it('still blocks upstream requests after restoring test mocks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('fixture')))
    expect(await (await fetch('https://pokeapi.co')).text()).toBe('fixture')
    vi.unstubAllGlobals()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('another fixture'))
    vi.restoreAllMocks()
    await expect(fetch('https://pokeapi.co')).rejects.toThrow(blocked)
  })

  it.each([
    () => httpGet('http://upstream.invalid'),
    () => httpsGet('https://upstream.invalid'),
    () => connect(443, 'upstream.invalid'),
  ])('blocks clients that bypass fetch (%#)', (request) => {
    expect(request).toThrow(blocked)
  })

  it('allows local fixtures but blocks their redirects to upstreams', async () => {
    const server = createServer((request, response) => {
      if (request.url === '/redirect') {
        response.writeHead(302, { location: 'https://upstream.invalid' }).end()
      } else {
        response.end('fixture')
      }
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Expected a local TCP server')
      const url = `http://127.0.0.1:${address.port}`
      expect(await (await fetch(url)).text()).toBe('fixture')
      await expect(fetch(`${url}/redirect`)).rejects.toMatchObject({
        cause: { message: expect.stringContaining(blocked) },
      })
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })

  it('preloads the guard in Node CLI subprocesses', () => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', 'await fetch("https://upstream.invalid")'],
      { encoding: 'utf8', timeout: 5000 },
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(blocked)
  })
})
