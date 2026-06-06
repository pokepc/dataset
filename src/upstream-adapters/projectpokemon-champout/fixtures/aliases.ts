const LOCAL_SLUG_ALIASES: Record<string, readonly string[]> = {
  'vise-grip': ['vice-grip'],
}

export function expandLocalSlugAliases(slug: string): string[] {
  return [slug, ...(LOCAL_SLUG_ALIASES[slug] ?? [])]
}
