import { Socket } from 'node:net'

function assertLocalHost(host: string) {
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error(
      `External network access is disabled in tests (${host}). Use a fixture, mock, or local test server.`,
    )
  }
}

// Plain replacements make this the baseline restored by vi.unstubAllGlobals() and
// vi.restoreAllMocks(). The same module can be preloaded by Node CLI subprocesses.
globalThis.fetch = new Proxy(globalThis.fetch, {
  async apply(target, thisArg, args: Parameters<typeof fetch>) {
    const [input] = args
    const url = new URL(input instanceof Request ? input.url : input)
    assertLocalHost(url.hostname)
    return Reflect.apply(target, thisArg, args)
  },
})

// Cover HTTP clients that bypass global fetch, and local redirects to upstreams.
const originalConnect = Socket.prototype.connect
Socket.prototype.connect = function (this: Socket, ...args: unknown[]) {
  // Node's HTTP/TLS clients also pass the internally normalized argument array.
  const [options, host] = Array.isArray(args[0]) ? args[0] : args
  if (typeof options === 'object' && options !== null) {
    const connection = options as { path?: string; host?: string }
    if (!connection.path) assertLocalHost(connection.host ?? 'localhost')
  } else if (
    typeof options === 'number' ||
    (typeof options === 'string' && /^\d+$/.test(options))
  ) {
    assertLocalHost(typeof host === 'string' ? host : 'localhost')
  }
  return Reflect.apply(originalConnect, this, args)
}
