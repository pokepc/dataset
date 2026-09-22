export type ReleaseTag = { tag: string; sha: string }
export type PagesVersion = {
  path: string
  ref: string
  sha: string
  version: string
  description: string
}

// Only stable SemVer tags are deployable; prerelease tags deliberately do not match.
const stableTag =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/

export function parseStableTag(tag: string) {
  const match = stableTag.exec(tag)
  return match
    ? {
        version: tag.replace(/^v/, ''),
        numbers: [BigInt(match[1]), BigInt(match[2]), BigInt(match[3])],
      }
    : undefined
}

export function readMajors(config: unknown): number[] {
  const majors = (config as { majors?: unknown } | null)?.majors
  if (
    !Array.isArray(majors) ||
    majors.some((major) => !Number.isSafeInteger(major) || major < 6) ||
    new Set(majors).size !== majors.length
  ) {
    throw new Error('pages-versions.json must contain unique integer majors >= 6.')
  }
  return [...majors].sort((a, b) => a - b)
}

export function selectLatestTag(tags: ReleaseTag[], major?: number): ReleaseTag {
  const candidates = tags
    .map((release) => ({ ...release, parsed: parseStableTag(release.tag) }))
    .filter(
      (release) =>
        release.parsed && (major === undefined || release.parsed.numbers[0] === BigInt(major)),
    )
    .sort((a, b) => {
      for (let i = 0; i < 3; i++) {
        const difference = a.parsed!.numbers[i] - b.parsed!.numbers[i]
        if (difference !== 0n) return difference > 0n ? -1 : 1
      }
      return a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0
    })
  const latest = candidates[0]
  if (!latest)
    throw new Error(
      `No stable SemVer tag found${major === undefined ? '' : ` for major ${major}`}.`,
    )
  const aliases = candidates.filter((release) =>
    release.parsed!.numbers.every((number, index) => number === latest.parsed!.numbers[index]),
  )
  if (aliases.some((release) => release.sha !== latest.sha)) {
    throw new Error(
      `Ambiguous equal-precedence release tags: ${aliases.map((release) => release.tag).join(', ')}`,
    )
  }
  return { tag: latest.tag, sha: latest.sha }
}

export function assertPackageVersion(tag: string, version: string) {
  if (parseStableTag(tag)?.version !== version) {
    throw new Error(`Tag ${tag} does not match package version ${version}.`)
  }
}

export function createManifest(
  majors: number[],
  tags: ReleaseTag[],
  branch: { ref: string; sha: string; version: string },
): PagesVersion[] {
  function release(path: string, label: string, tag: ReleaseTag): PagesVersion {
    return {
      path,
      ref: tag.tag,
      sha: tag.sha,
      version: parseStableTag(tag.tag)!.version,
      description: `${label} (${tag.tag})`,
    }
  }
  return [
    { path: '', ...branch, description: `Default branch (${branch.ref}, development)` },
    release('latest/', 'Latest stable release', selectLatestTag(tags)),
    ...majors.map((major) => release(`v${major}/`, `v${major}`, selectLatestTag(tags, major))),
  ]
}

export function normalizeBaseUrl(value: string): string {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'Pages base URL must be an HTTP(S) URL without credentials, query, or fragment.',
    )
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
  return url.href
}

export function createServers(versions: PagesVersion[], currentPath: string, baseUrl: string) {
  const ordered = [
    ...versions.filter((version) => version.path === currentPath),
    ...versions.filter((version) => version.path !== currentPath),
  ]
  return ordered.map((version) => ({
    url: new URL(version.path, normalizeBaseUrl(baseUrl)).href,
    description: version.description,
  }))
}
