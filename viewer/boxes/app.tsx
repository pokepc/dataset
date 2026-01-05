import { render } from 'preact'
import { useState } from 'preact/hooks'

// macro imports (Bun runs them at build time when called, bundling the result inline):
import {
  loadAllBoxPresets,
  loadAllGames,
  loadAllPokemon,
} from '../../lib/fs' with { type: 'macro' }
import { cn } from '../utils'

const games = loadAllGames()
const supportedGameSets = games
  .filter(
    (game) =>
      (game.type === 'set' || (game.type === 'game' && !game.gameSet)) &&
      new Date(game.releaseDate) < new Date(),
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

function getBoxPokemon(
  pokemon: Pkds.LegacyBoxPresetBoxPokemon,
): { id: string; sprite: string } | null {
  if (typeof pokemon === 'string') {
    const pid = getCleanPokemonId(pokemon)
    return { id: pid, sprite: getPokemonSprite(pid) }
  }

  if (pokemon && pokemon.gmax) {
    const pid = getCleanPokemonId(pokemon.pid)
    return {
      id: pid,
      sprite: getPokemonSprite(pid),
    }
  }

  const pid = pokemon ? getCleanPokemonId(pokemon.pid) : null
  return pid ? { id: pid, sprite: getPokemonSprite(pid) } : null
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
        {cells.map((pokemon) => (
          <div className={cn('poke-box-cell', { 'poke-box-cell-empty': !pokemon })}>
            {pokemon ? (
              <img
                title={pokemon.id}
                src={pokemon.sprite}
                alt={pokemon.id}
                loading="lazy"
                width={40}
                height={40}
              />
            ) : undefined}
          </div>
        ))}
      </div>
    </div>
  )
}

function PokeBoxList({ boxes }: { boxes: Array<Pkds.LegacyBoxPresetBox> }) {
  return (
    <div
      className={cn('poke-box-list', { 'has-1': boxes.length === 1, 'has-2': boxes.length === 2 })}
    >
      {boxes.map((box, index) => (
        <PokeBox box={box} boxIndex={index} />
      ))}
    </div>
  )
}

function App() {
  const [selectedGame, setSelectedGame] = useState<string | undefined>()
  const [selectedBoxPreset, setSelectedBoxPreset] = useState<string | undefined>()
  const [selectedPokemon, setSelectedPokemon] = useState<string | undefined>()
  const boxPresets = boxPresetsClassic.filter((preset) => preset.gameset === selectedGame)
  const boxPresetsCount = boxPresets
    .map((preset) => preset.presets.length)
    .reduce((a, b) => a + b, 0)

  const currentBoxPreset = boxPresets
    .find((preset) => preset.gameset === selectedGame)
    ?.presets.find((preset) => preset.id === selectedBoxPreset)

  return (
    <main className="container">
      <h2>Box Preset Viewer</h2>
      <p>
        - Select a game set to view the box presets for that game set. <br />
        - Select a box preset to view the boxes for that box preset. <br />- If you edit the dataset
        JSON files, you will have to stop and restart the Bun server to see the changes. <br />
        {/* - Select a Pokémon to view the Pokémon for that box. <br /> */}
      </p>
      <div className="select-bar">
        <select
          className="select"
          value={selectedGame}
          onChange={(e) => {
            setSelectedGame(e.currentTarget?.value)
            setSelectedBoxPreset('')
            setSelectedPokemon('')
          }}
        >
          <button>
            <selectedcontent />
          </button>
          <option value="">
            <p class="placeholder">Select a Game Set</p>
          </option>
          <optgroup label="Game Sets">
            {supportedGameSets.map((game) => (
              <option value={game.id}>
                <p>{game.name}</p>
              </option>
            ))}
          </optgroup>
        </select>
        <select
          className="select"
          value={selectedBoxPreset}
          onChange={(e) => setSelectedBoxPreset(e.currentTarget?.value)}
          disabled={boxPresetsCount === 0 || !selectedGame}
        >
          <button>
            <selectedcontent />
          </button>
          <option value="">
            <p class="placeholder">Select a box preset</p>
          </option>
          <optgroup label="Box Presets">
            {boxPresets.flatMap((preset) =>
              preset.presets.map((boxPreset) => (
                <option value={boxPreset.id}>
                  <p>{boxPreset.name}</p>
                </option>
              )),
            )}
          </optgroup>
        </select>
        <select
          hidden
          className="select"
          value={selectedPokemon}
          onChange={(e) => setSelectedPokemon(e.currentTarget?.value)}
        >
          <button>
            <selectedcontent />
          </button>
          <option value="">
            <p class="placeholder">Select a Pokémon</p>
          </option>
          <optgroup label="Pokémon">
            {pokemon.map((pokemon) => (
              <option value={pokemon.id}>
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
