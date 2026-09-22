import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { buildPagesArtifact, outDir } from './build.ts'

const defaultPort = 4173
const portArg = process.argv.find((arg) => arg.startsWith('--port='))
const port = Number(portArg?.slice('--port='.length) ?? process.env.PORT ?? defaultPort)
const previewVersions = process.argv.includes('--versions')
const basePath = previewVersions
  ? new URL(JSON.parse(fs.readFileSync(path.join(outDir, 'versions.json'), 'utf8')).baseUrl)
      .pathname
  : '/'

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
  if (!pathname.startsWith(basePath)) return undefined
  const relativePath = pathname.slice(basePath.length) || 'index.html'
  const filePath = path.resolve(outDir, relativePath)
  const outDirWithSeparator = `${outDir}${path.sep}`

  if (filePath !== outDir && !filePath.startsWith(outDirWithSeparator)) {
    return undefined
  }

  return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
    ? path.join(filePath, 'index.html')
    : filePath
}

if (!previewVersions) await buildPagesArtifact()

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendResponse(response, 405, 'Method not allowed')
    return
  }

  let filePath: string | undefined
  try {
    const requestUrl = new URL(request.url ?? '/', `http://localhost:${port}`)
    const pathname = decodeURIComponent(requestUrl.pathname)
    const directory = path.resolve(outDir, pathname.slice(basePath.length))
    if (
      !pathname.endsWith('/') &&
      (pathname === basePath.slice(0, -1) || pathname.startsWith(basePath)) &&
      (directory === outDir || directory.startsWith(`${outDir}${path.sep}`)) &&
      fs.existsSync(directory) &&
      fs.statSync(directory).isDirectory()
    ) {
      response.writeHead(308, { location: `${requestUrl.pathname}/${requestUrl.search}` })
      response.end()
      return
    }
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
  console.log(`PokePC Dataset API docs: http://localhost:${port}${basePath}`)
})
