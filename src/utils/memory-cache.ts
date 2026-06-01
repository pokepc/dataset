export class MemoryCache {
  defaultTTL: number = 1000 * 60

  constructor(defaultTTL: number = 1000 * 10) {
    this.defaultTTL = defaultTTL
  }

  #cache: Map<string, { exptime: number; value: any }> = new Map()

  get<T>(key: string): T | undefined {
    const value = this.#cache.get(key)
    if (!value) {
      return undefined
    }
    if (value.exptime > Date.now() || value.exptime === 0) {
      return value.value
    }
    this.#cache.delete(key)
    return undefined
  }

  set(key: string, value: any, ttl: number = this.defaultTTL) {
    this.#cache.set(key, { exptime: ttl === 0 ? 0 : Date.now() + ttl, value })
  }

  delete(key: string) {
    this.#cache.delete(key)
  }

  has(key: string) {
    const value = this.#cache.get(key)
    return Boolean(value && (value.exptime > Date.now() || value.exptime === 0))
  }

  clear() {
    this.#cache.clear()
  }

  keys() {
    return Array.from(this.#cache.keys())
  }

  values() {
    return Array.from(this.#cache.values()).map((value) => value.value)
  }

  entries() {
    return Array.from(this.#cache.entries()).map(([key, value]) => [key, value.value])
  }

  size() {
    return this.#cache.size
  }

  cached<T>(key: string, fn: () => T, ttl: number = this.defaultTTL): T {
    const value = this.get<T>(key)
    if (value) {
      return value
    }
    const result = fn()
    this.set(key, result, ttl)
    return result
  }
}
