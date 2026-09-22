import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { availabilityUrls, parseAvailabilityTables } from './availability.ts'

/** Only the two complete availability lists are accepted as upstream sources. */
export async function fetchAvailabilityPage(
  source: 'main' | 'go',
  signal?: AbortSignal,
  options: { cacheDir?: string; forceRefresh?: boolean } = {},
): Promise<string> {
  signal?.throwIfAborted()
  const url = availabilityUrls[source]
  const cacheDir =
    options.cacheDir ??
    process.env.BULBAPEDIA_CACHE_DIR ??
    fileURLToPath(new URL('../../../.local/bulbapedia/', import.meta.url))
  const key = createHash('sha256').update(url).digest('hex')
  const cacheFile = resolve(cacheDir, `${key}.json`)
  const isValidPage = (html: string) => {
    try {
      parseAvailabilityTables({ [source]: html })
      return true
    } catch {
      return false
    }
  }
  if (!options.forceRefresh) {
    try {
      const cached = JSON.parse(await readFile(cacheFile, 'utf8'))
      signal?.throwIfAborted()
      if (
        cached?.version === 2 &&
        cached.url === url &&
        typeof cached.html === 'string' &&
        isValidPage(cached.html)
      )
        return cached.html
    } catch (error) {
      signal?.throwIfAborted()
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError))
        throw error
    }
  }
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
    : AbortSignal.timeout(30_000)
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'PokePC-Dataset-Availability/2.0 (+https://github.com/pokepc/dataset)',
        Accept: 'text/html',
      },
      signal: requestSignal,
    })
  } catch (error) {
    signal?.throwIfAborted()
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Could not fetch Bulbapedia ${source} availability: ${reason}. Check the network, or use --html and --go-html with both saved pages.`,
      { cause: error },
    )
  }
  if (!response.ok)
    throw new Error(
      `Bulbapedia ${source} availability returned HTTP ${response.status}. Use --html and --go-html with both saved pages if access is blocked.`,
    )
  const html = await response.text()
  requestSignal.throwIfAborted()
  try {
    parseAvailabilityTables({ [source]: html })
  } catch (error) {
    throw new Error(
      `Invalid Bulbapedia ${source} availability page: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
  await mkdir(cacheDir, { recursive: true })
  const temporary = `${cacheFile}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify({ version: 2, url, html }), 'utf8')
    requestSignal.throwIfAborted()
    await rename(temporary, cacheFile)
  } finally {
    await rm(temporary, { force: true })
  }
  return html
}
