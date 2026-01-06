import { render } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'

// macro imports (Bun runs them at build time when called, bundling the result inline):
import { loadAllBoxPresets, loadAllGames, loadAllPokemon } from '../../lib/fs' with { type: 'macro' }
import { cn } from '../utils'

const games = loadAllGames()
const supportedGameSets = games
  .filter(
    (game) =>
      (game.type === 'set' || (game.type === 'game' && !game.gameSet)) && new Date(game.releaseDate) < new Date(),
  )
  .toReversed()
const pokemon = loadAllPokemon()
const boxPresetsClassic = loadAllBoxPresets('classic')
// const boxPresetsGamesets = [...new Set(boxPresetsClassic.map((boxPreset) => boxPreset.gameset))]
// const gamesById = Object.fromEntries(games.map((game) => [game.id, game]))
const pokemonById = Object.fromEntries(pokemon.map((pokemon) => [pokemon.id, pokemon]))

function getPokemonSprite(pokemonId: string): string {
  const nid = pokemonById[pokemonId]?.nid
  if (!nid) {
    throw new Error(`Pokemon ${pokemonId} not found in the dataset`)
  }
  return `https://static.pokepc.net/images/pokemon/home3d-icon/regular/${nid}.webp`
}

function getCleanPokemonId(pokemonId: string): string {
  const pass1 = pokemonId.replace('-gmax', '-gmax')
  if (pass1.includes('--')) {
    // we dont support Special Ability forms anymore, e.g. zygarde--power-construct
    return pass1.split('--')[0]
  }
  return pass1
}

function getPokemonInfo(pokemonId: string): { id: string; name: string; sprite: string } {
  const pid = getCleanPokemonId(pokemonId)
  return { id: pid, name: pokemonById[pid]?.names.eng ?? pid, sprite: getPokemonSprite(pid) }
}

function getBoxPokemon(pokemon: Pkds.LegacyBoxPresetBoxPokemon): { id: string; name: string; sprite: string } | null {
  if (typeof pokemon === 'string') {
    return getPokemonInfo(pokemon)
  }

  return pokemon ? getPokemonInfo(pokemon.pid) : null
}

function PokeBox({ box, boxIndex }: { box: Pkds.LegacyBoxPresetBox; boxIndex: number }) {
  const cellFill = Array.from({ length: Math.max(30, box.pokemon.length) }, (_, index) => index)
  const cells = cellFill.map((cellIndex) => {
    const pokemon = box.pokemon[cellIndex]
    return getBoxPokemon(pokemon) ?? null
  })
  return (
    <div className="poke-box">
      <div className="poke-box-title">{box.title || `Box ${boxIndex + 1}`}</div>
      <div className="poke-box-cells">
        {cells.map((pokemon, cellIndex) => (
          <div
            data-tooltip={pokemon ? pokemon.name : undefined}
            className={cn('poke-box-cell', { 'poke-box-cell-empty': !pokemon })}
            key={`cell-${boxIndex}-${cellIndex}`}
          >
            {pokemon ? <img src={pokemon.sprite} alt={pokemon.id} loading="lazy" width={40} height={40} /> : undefined}
          </div>
        ))}
      </div>
    </div>
  )
}

function PokeBoxList({ boxes }: { boxes: Array<Pkds.LegacyBoxPresetBox> }) {
  return (
    <div className={cn('poke-box-list', { 'has-1': boxes.length === 1, 'has-2': boxes.length === 2 })}>
      {boxes.map((box, index) => (
        <PokeBox box={box} boxIndex={index} key={`box-${index}`} />
      ))}
    </div>
  )
}

function useQueryStringStates<K extends string>(
  keys: K[],
  defaultValue?: Record<K, string | null>,
): [Record<K, string | null>, (values: Record<K, string | null>) => void] {
  function readFromUrl(): Record<K, string | null> {
    const url = new URL(window.location.href)
    return Object.fromEntries(
      keys.map((key) => [key, url.searchParams.get(key) ?? defaultValue?.[key] ?? null]),
    ) as Record<K, string | null>
  }

  const [values, setValues] = useState<Record<K, string | null>>(readFromUrl)

  const setUrlValues = useCallback(
    (newValues: Record<K, string | null>) => {
      const url = new URL(window.location.href)
      for (const key of keys) {
        const value = newValues[key]
        if (value === null || value === undefined || value === '') {
          url.searchParams.delete(key)
        } else {
          url.searchParams.set(key, String(value))
        }
      }
      window.history.pushState({}, '', url.toString())
      setValues(newValues)
    },
    [keys],
  )

  useEffect(() => {
    function handlePopState() {
      setValues(readFromUrl())
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  return [values, setUrlValues]
}

function App() {
  const [qs, setQs] = useQueryStringStates(['game', 'preset', 'pokemon'])

  const boxPresets = boxPresetsClassic.filter((preset) => preset.gameset === qs.game)
  const boxPresetsCount = boxPresets.map((preset) => preset.presets.length).reduce((a, b) => a + b, 0)

  const currentBoxPreset = boxPresets
    .find((preset) => preset.gameset === qs.game)
    ?.presets.find((preset) => preset.id === qs.preset)

  return (
    <main className="container">
      <h2>Box Preset Viewer</h2>
      <p>
        - Select a game set to view the box presets for that game set. <br />
        - Select a box preset to view the boxes for that box preset. <br />- If you edit the dataset JSON files, you
        will have to stop and restart the Bun server to see the changes. <br />
        {/* - Select a Pokémon to view the Pokémon for that box. <br /> */}
      </p>
      <div className="select-bar">
        <select
          className="select"
          value={qs.game ?? undefined}
          onChange={(e) => {
            setQs({ game: e.currentTarget?.value ?? null, preset: null, pokemon: null })
          }}
        >
          <button>
            <selectedcontent />
          </button>
          <option value="">
            <p className="placeholder">Select a Game Set</p>
          </option>
          <optgroup label="Game Sets">
            {supportedGameSets.map((game) => (
              <option value={game.id} key={`game-${game.id}`}>
                <p>{game.name}</p>
              </option>
            ))}
          </optgroup>
        </select>
        <select
          className="select"
          value={qs.preset ?? undefined}
          onChange={(e) => setQs({ ...qs, preset: e.currentTarget?.value ?? null })}
          disabled={boxPresetsCount === 0 || !qs.game}
        >
          <button>
            <selectedcontent />
          </button>
          <option value="">
            <p className="placeholder">Select a box preset</p>
          </option>
          <optgroup label="Box Presets">
            {boxPresets.flatMap((preset) =>
              preset.presets.map((boxPreset) => (
                <option value={boxPreset.id} key={`preset-${boxPreset.id}`}>
                  <p>{boxPreset.name}</p>
                </option>
              )),
            )}
          </optgroup>
        </select>
        <select
          hidden
          className="select"
          value={qs.pokemon ?? undefined}
          onChange={(e) => setQs({ ...qs, pokemon: e.currentTarget?.value ?? null })}
        >
          <button>
            <selectedcontent />
          </button>
          <option value="">
            <p className="placeholder">Select a Pokémon</p>
          </option>
          <optgroup label="Pokémon">
            {pokemon.map((pokemon) => (
              <option value={pokemon.id} key={`pokemon-${pokemon.id}`}>
                <p>{pokemon.names.eng}</p>
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      {currentBoxPreset && <PokeBoxList boxes={currentBoxPreset.boxes} />}
    </main>
  )
}

render(<App />, document.getElementById('root') as HTMLElement)
