import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { buildPagesArtifact, outDir } from './build.ts'

const defaultPort = 4173
const portArg = process.argv.find((arg) => arg.startsWith('--port='))
const port = Number(portArg?.slice('--port='.length) ?? process.env.PORT ?? defaultPort)

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}

function sendResponse(
  response: http.ServerResponse,
  statusCode: number,
  body: string,
  contentType = 'text/plain; charset=utf-8',
) {
  response.writeHead(statusCode, {
    'cache-control': 'no-cache',
    'content-type': contentType,
  })
  response.end(body)
}

function resolveStaticPath(requestUrl: string | undefined) {
  const url = new URL(requestUrl ?? '/', `http://localhost:${port}`)
  const pathname = decodeURIComponent(url.pathname)
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
  const filePath = path.resolve(outDir, relativePath)
  const outDirWithSeparator = `${outDir}${path.sep}`

  if (filePath !== outDir && !filePath.startsWith(outDirWithSeparator)) {
    return undefined
  }

  return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
    ? path.join(filePath, 'index.html')
    : filePath
}

await buildPagesArtifact()

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendResponse(response, 405, 'Method not allowed')
    return
  }

  let filePath: string | undefined
  try {
    filePath = resolveStaticPath(request.url)
  } catch {
    sendResponse(response, 400, 'Bad request')
    return
  }

  if (!filePath || !fs.existsSync(filePath)) {
    sendResponse(response, 404, 'Not found')
    return
  }

  const contentType = contentTypes[path.extname(filePath)] ?? 'application/octet-stream'
  response.writeHead(200, {
    'cache-control': 'no-cache',
    'content-type': contentType,
  })

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  fs.createReadStream(filePath).pipe(response)
})

server.listen(port, () => {
  console.log(`PokePC Dataset API docs: http://localhost:${port}/`)
})
