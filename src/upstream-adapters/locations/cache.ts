import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export class SourceCache {
  readonly hashes = new Map<string, string>()
  private readonly hostQueues = new Map<string, Promise<void>>()
  readonly directory: string
  readonly offline: boolean
  readonly refresh: boolean

  constructor(directory: string, offline = false, refresh = false) {
    this.directory = directory
    this.offline = offline
    this.refresh = refresh
  }

  async text(url: string): Promise<string> {
    const key = createHash('sha256').update(url).digest('hex')
    const path = resolve(this.directory, 'http', `${key}.json`)
    if (!this.refresh) {
      try {
        const cached = JSON.parse(await readFile(path, 'utf8'))
        if (cached.url !== url || typeof cached.text !== 'string')
          throw new Error(`Invalid location source cache: ${path}`)
        this.hashes.set(url, createHash('sha256').update(cached.text).digest('hex'))
        return cached.text
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    if (this.offline) throw new Error(`Missing cached location source: ${url}`)
    const host = new URL(url).hostname
    const previous = this.hostQueues.get(host) ?? Promise.resolve()
    const next = previous.then(() => delay(150))
    this.hostQueues.set(host, next)
    await next
    let text = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PokePC-Dataset-Locations/1.0 (+https://github.com/pokepc/dataset)',
        },
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await delay(1000 * 2 ** attempt)
          continue
        }
        throw new Error(`HTTP ${response.status}: ${url}`)
      }
      const bytes = await response.arrayBuffer()
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        text = new TextDecoder('windows-1252').decode(bytes)
      }
      break
    }
    if (!text.trim()) throw new Error(`Empty location source: ${url}`)
    await mkdir(resolve(this.directory, 'http'), { recursive: true })
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify({ url, text }) + '\n')
      await rename(temporary, path)
    } finally {
      await rm(temporary, { force: true })
    }
    this.hashes.set(url, createHash('sha256').update(text).digest('hex'))
    return text
  }
}

export async function mapConcurrent<T, R>(
  items: T[],
  count: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(count, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++
        results[index] = await run(items[index])
      }
    }),
  )
  return results
}
