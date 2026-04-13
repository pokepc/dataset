import { render } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { abilityTagIds } from '../../lib/enums'
import { loadAllAbilities } from '../../lib/fs' with { type: 'macro' }

type AbilityRow = {
  id: string
  name: string
  psName: string
  gen: number
  shortDesc: string
  desc: string
  tags: string[]
  immunities?: string[]
  weaknesses?: string[]
}

const abilities = loadAllAbilities() as AbilityRow[]
const allTags = [...abilityTagIds].sort((a, b) => a.localeCompare(b))

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function searchWordsFromQuery(query: string): string[] {
  return normalize(query)
    .split(' ')
    .map((w) => w.trim())
    .filter(Boolean)
}

function abilitySearchBlock(a: AbilityRow): string {
  return normalize(`${a.id} ${a.name} ${a.psName} ${a.shortDesc} ${a.desc}`)
}

function matchesSearch(a: AbilityRow, words: string[]): boolean {
  if (words.length === 0) return true
  const block = abilitySearchBlock(a)
  return words.every((w) => block.includes(w))
}

function matchesTags(a: AbilityRow, selected: string[], mode: 'and' | 'or'): boolean {
  if (selected.length === 0) return true
  const set = new Set(a.tags)
  if (mode === 'and') return selected.every((t) => set.has(t))
  return selected.some((t) => set.has(t))
}

function App() {
  const [search, setSearch] = useState('')
  const [tagMode, setTagMode] = useState<'and' | 'or'>('and')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagPick, setTagPick] = useState<string>('')

  const words = useMemo(() => searchWordsFromQuery(search), [search])

  const filtered = useMemo(() => {
    return abilities.filter((a) => matchesSearch(a, words) && matchesTags(a, selectedTags, tagMode))
  }, [words, selectedTags, tagMode])

  const availableToAdd = useMemo(() => allTags.filter((t) => !selectedTags.includes(t)), [selectedTags])

  function addTag() {
    if (!tagPick || selectedTags.includes(tagPick)) return
    setSelectedTags((prev) => [...prev, tagPick].sort((a, b) => a.localeCompare(b)))
    setTagPick('')
  }

  function removeTag(t: string) {
    setSelectedTags((prev) => prev.filter((x) => x !== t))
  }

  return (
    <div className="abilities-root">
      <header className="abilities-header">
        <div className="abilities-header-titles">
          <h1>Abilities</h1>
          <p className="abilities-header-sub">Dataset reference with search and tag filters</p>
        </div>
        <a className="abilities-back" href="/">
          ← Viewers
        </a>
      </header>

      <div className="abilities-toolbar">
        <section className="abilities-toolbar-section" aria-labelledby="abilities-search-heading">
          <h2 className="abilities-section-label" id="abilities-search-heading">
            Search
          </h2>
          <label className="sr-only" htmlFor="abilities-search">
            Search abilities
          </label>
          <input
            id="abilities-search"
            className="abilities-search"
            type="search"
            placeholder="Words match id, name, Showdown name, short & full desc (all words required)"
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            autoComplete="off"
          />
        </section>

        <section className="abilities-toolbar-section" aria-labelledby="abilities-tags-heading">
          <h2 className="abilities-section-label" id="abilities-tags-heading">
            Tag filter
          </h2>
          <div className="abilities-tag-row">
            <span className="abilities-field-label abilities-field-label--inline">Match mode</span>
            <div className="abilities-tag-mode" role="group" aria-label="Tag match mode">
              <button type="button" aria-pressed={tagMode === 'and'} onClick={() => setTagMode('and')}>
                All (AND)
              </button>
              <button type="button" aria-pressed={tagMode === 'or'} onClick={() => setTagMode('or')}>
                Any (OR)
              </button>
            </div>
          </div>

          <div className="abilities-tag-add">
            <span className="abilities-field-label">Add tag</span>
            <div className="abilities-tag-add-controls">
              <select
                value={tagPick}
                onChange={(e) => setTagPick((e.target as HTMLSelectElement).value)}
                aria-label="Tag to add"
              >
                <option value="">Choose tag…</option>
                {availableToAdd.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button type="button" disabled={!tagPick} onClick={addTag}>
                Add
              </button>
            </div>
          </div>

          <div className="abilities-pills" aria-live="polite">
            <span className="abilities-field-label">Active filters</span>
            <div className="abilities-pills-inner">
              {selectedTags.length === 0 ? (
                <span className="abilities-pills-empty">None — all tags shown</span>
              ) : (
                selectedTags.map((t) => (
                  <span key={t} className="abilities-pill">
                    {t}
                    <button type="button" aria-label={`Remove ${t}`} onClick={() => removeTag(t)}>
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        <footer className="abilities-toolbar-footer">
          Showing <strong>{filtered.length}</strong> of {abilities.length} abilities
        </footer>
      </div>

      <section className="abilities-results" aria-label="Ability list">
        <ul className="abilities-list">
          {filtered.map((a) => (
            <li key={a.id}>
              <article className="abilities-card">
                <div className="abilities-card-top">
                  <span className="abilities-id">{a.id}</span>
                  <span className="abilities-name">{a.name}</span>
                  <span className="abilities-gen">Gen {a.gen}</span>
                </div>
                <div className="abilities-card-tags">
                  {a.tags.map((t) => (
                    <span key={t} className="abilities-chip">
                      {t}
                    </span>
                  ))}
                </div>
                {a.immunities?.length || a.weaknesses?.length ? (
                  <div className="abilities-iw">
                    {a.immunities?.length ? (
                      <div>
                        <strong>Immunities:</strong> {a.immunities.join(', ')}
                      </div>
                    ) : null}
                    {a.weaknesses?.length ? (
                      <div>
                        <strong>Weaknesses:</strong> {a.weaknesses.join(', ')}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <p className="abilities-short">{a.shortDesc}</p>
                <details className="abilities-details">
                  <summary>Full description</summary>
                  <p className="abilities-desc">{a.desc}</p>
                </details>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

render(<App />, document.getElementById('root')!)
