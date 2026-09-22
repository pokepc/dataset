import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

/** Fetch-only entry point shared by the CLI and the editor; never loads AI tooling. */
export async function fetchSpeciesPage(
  url: string,
  signal?: AbortSignal,
  options: { cacheDir?: string; forceRefresh?: boolean } = {},
): Promise<string> {
  signal?.throwIfAborted()
  const cacheDir =
    options.cacheDir ??
    process.env.BULBAPEDIA_CACHE_DIR ??
    fileURLToPath(new URL('../../../.local/bulbapedia/', import.meta.url))
  const key = createHash('sha256').update(url).digest('hex')
  const cacheFile = resolve(cacheDir, `${key}.json`)
  const hasLocations = (html: string) => /\bid=["']Game_locations["']/.test(html)
  if (!options.forceRefresh) {
    try {
      const cached = JSON.parse(await readFile(cacheFile, 'utf8'))
      signal?.throwIfAborted()
      if (
        cached?.version === 1 &&
        cached.url === url &&
        typeof cached.html === 'string' &&
        hasLocations(cached.html)
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
        'User-Agent': 'PokePC-Dataset-Availability/1.0 (+https://github.com/pokepc/dataset)',
        Accept: 'text/html',
      },
      signal: requestSignal,
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Could not fetch Bulbapedia: ${reason}. Check the network, or use --html with a saved species page.`,
      { cause: error },
    )
  }
  if (!response.ok)
    throw new Error(
      `Bulbapedia returned HTTP ${response.status}. Use --html with a saved species page if access is blocked.`,
    )
  const html = await response.text()
  if (!hasLocations(html))
    throw new Error(
      'Bulbapedia did not return a species page with Game locations. Use --html with a saved species page.',
    )
  requestSignal.throwIfAborted()
  await mkdir(cacheDir, { recursive: true })
  const temporary = `${cacheFile}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify({ version: 1, url, html }), 'utf8')
    requestSignal.throwIfAborted()
    await rename(temporary, cacheFile)
  } finally {
    await rm(temporary, { force: true })
  }
  return html
}
