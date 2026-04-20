import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAllGames, loadAllLanguages, loadAllPokedexes, loadAllPokemon } from '../lib/fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// const OLD_DATA_PATH = path.resolve(__dirname, '../data')
const NEW_DATA_PATH = path.resolve(__dirname, '../data-v7')

type I18nData = Record<string, Record<string, string>>

const langs = loadAllLanguages()

function buildTranslationObject(data: Record<string, string>): I18nData {
  return Object.fromEntries(
    langs.map((lang) => {
      return [lang.id, data]
    }),
  )
}

type GameInfo = {
  id: string
  name: string
  nameSlug: string
  i18n: I18nData
}

type GameDLCInfo = GameInfo & {
  codename: string | null
  releaseDate: string
}

type GameType = 'gameset' | 'game' | 'dlc'
type ObtainMethod = 'in-game' | 'transfer' | 'event'
type ObtainableRecord = [string, { method: ObtainMethod; version?: string }]
type PokemonI18n = Record<
  Pkds.LanguageAlpha2,
  {
    name: string
    formName: string | undefined
    speciesName: string | undefined
    genus: string | undefined
  }
>

type PokemonV2 = Omit<
  Partial<Pkds.Pokemon>,
  | 'names'
  | 'genus'
  | 'speciesNames'
  | 'formNames'
  | 'family'
  | 'ability1'
  | 'ability2'
  | 'abilityHidden'
  | 'abilitySpecial'
  | 'type2'
> & {
  name: string // full name
  speciesName: string | undefined
  formName: string | undefined
  genus: string | undefined
  abilities: string[]
  i18n: PokemonI18n
  type2: string | null
}

function mapGameType(type: Pkds.Game['type']): GameType {
  if (type === 'superset') {
    throw new Error('Supersets are not supported')
  }
  if (type === 'set') {
    return 'gameset'
  }
  return type
}

const pokedexesById = Object.fromEntries(loadAllPokedexes().map((dex) => [dex.id, dex]))

function copyDexes(dexes: string[], destDir: string): void {
  for (const dexId of dexes) {
    const dexData = pokedexesById[dexId]
    if (!dexData) {
      throw new Error(`Dex ${dexId} does not exist.`)
    }
    fs.writeFileSync(
      `${destDir}/${dexId}.json`,
      JSON.stringify(
        {
          ...dexData,
          i18n: buildTranslationObject({
            name: dexData.name,
          }),
        },
        null,
        2,
      ),
    )
  }
}

function processGames() {
  const allGames = loadAllGames()
  const gameSets = allGames
    .filter((g) => g.type !== 'superset')
    .filter((g) => g.type === 'set' || (g.type === 'game' && g.gameSet === null) || g.id === g.gameSet)

  const index: Array<{ id: string; type: 'gameset' | 'game' | 'dlc'; gameSet?: string }> = []

  for (const gameSet of gameSets) {
    const destDir = path.resolve(NEW_DATA_PATH, `games/${gameSet.id}`)
    const requiredDirs = [`${destDir}/prose`, `${destDir}/mods`, `${destDir}/lists`, `${destDir}/dexes`]

    for (const dir of requiredDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }

    const record = {
      ...gameSet,
      games: allGames
        .filter((g) => g.type === 'game' && g.gameSet === gameSet.id)
        .map((g): GameInfo => {
          return {
            id: g.id,
            name: g.name,
            nameSlug: g.nameSlug,
            i18n: buildTranslationObject({
              name: g.name,
              nameSlug: g.nameSlug,
            }),
          }
        }),
      dlcs: allGames
        .filter((g) => g.type === 'dlc' && g.gameSet === gameSet.id)
        .map((g): GameDLCInfo => {
          return {
            id: g.id,
            name: g.name,
            nameSlug: g.nameSlug,
            codename: g.codename,
            releaseDate: g.releaseDate,
            i18n: buildTranslationObject({
              name: g.name,
              nameSlug: g.nameSlug,
            }),
          }
        }),
      i18n: buildTranslationObject({
        name: gameSet.name,
        nameSlug: gameSet.nameSlug,
      }),
    }

    fs.writeFileSync(`${destDir}/data.json`, JSON.stringify(record, null, 2))

    index.push({
      id: gameSet.id,
      type: mapGameType(gameSet.type),
    })

    for (const g of record.games) {
      index.push({
        id: g.id,
        type: 'game',
        gameSet: gameSet.id,
      })
    }

    for (const g of record.dlcs) {
      index.push({
        id: g.id,
        type: 'dlc',
        gameSet: gameSet.id,
      })
    }

    fs.writeFileSync(`${NEW_DATA_PATH}/games-index.json`, JSON.stringify(index, null, 2))

    // markdown texts
    for (const lang of langs) {
      fs.writeFileSync(`${destDir}/prose/description-${lang.id}.md`, `# ${gameSet.name}\n\n`)
    }

    // mods
    fs.writeFileSync(`${destDir}/mods/games.json`, `{}`)
    fs.writeFileSync(`${destDir}/mods/abilities.json`, `{}`)
    fs.writeFileSync(`${destDir}/mods/items.json`, `{}`)
    fs.writeFileSync(`${destDir}/mods/pokemon.json`, `{}`)

    // lists
    // fs.writeFileSync(`${destDir}/lists/pokemon-storable.json`, `[]`)
    // fs.writeFileSync(`${destDir}/lists/pokemon-version-exclusives.json`, `{}`)
    // fs.writeFileSync(`${destDir}/lists/pokemon-obtainable.json`, `[[]]`) // gameplay, events, transfer-only

    copyDexes(gameSet.pokedexes, `${destDir}/dexes`)
  }
}

// const langsById = Object.fromEntries(langs.map((lang) => [lang.id, lang]))

function buildPokemonI18n(langA3: Pkds.LanguageAlpha3, pkm: Pkds.Pokemon): PokemonI18n[Pkds.LanguageAlpha2] {
  return {
    name: pkm.names[langA3] || pkm.names['eng'] || '',
    formName: pkm.formNames[langA3] || pkm.formNames['eng'] || undefined,
    speciesName: pkm.speciesNames[langA3] || pkm.speciesNames['eng'] || undefined,
    genus: pkm.genus[langA3] || pkm.genus['eng'] || undefined,
  }
}

const allGames = loadAllGames().filter((g) => g.type === 'game')
const allGamesByGameset = (() => {
  const gamesByGameset: Record<string, string[]> = {}
  for (const game of allGames) {
    const gameSet = game.gameSet || game.id
    if (!gamesByGameset[gameSet]) {
      gamesByGameset[gameSet] = []
    }

    gamesByGameset[gameSet].push(game.id)
  }
  return gamesByGameset
})()

function processPokemon() {
  const allPokes = loadAllPokemon()
  const index: Array<{ id: string; nid: string; isForm: boolean; baseSpecies?: string }> = []
  const destDir = path.resolve(NEW_DATA_PATH, `pokemon`)
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  const obtainableByGameId = Object.fromEntries(allGames.map((g) => [g.id, new Set<string>()]))
  const storableByGameId = Object.fromEntries(allGames.map((g) => [g.id, new Set<string>()]))
  const transferOnlyByGameId = Object.fromEntries(allGames.map((g) => [g.id, new Set<string>()]))
  const eventOnlyByGameId = Object.fromEntries(allGames.map((g) => [g.id, new Set<string>()]))
  const shinyLockedByGameId = Object.fromEntries(allGames.map((g) => [g.id, new Set<string>()]))
  const exclusivesByGameId = Object.fromEntries(allGames.map((g) => [g.id, new Set<string>()]))

  for (const pkm of allPokes) {
    const destFile = path.resolve(destDir, `${pkm.id}.json`)
    index.push({
      id: pkm.id,
      nid: pkm.nid,
      isForm: pkm.isForm || false,
      baseSpecies: pkm.baseSpecies || undefined,
    })

    // const {
    //   // i18n:
    //   names,
    //   genus,
    //   speciesNames,
    //   formNames,
    //   // availability:
    //   obtainableIn,
    //   storableIn,
    //   transferOnlyIn,
    //   eventOnlyIn,
    //   shinyLockedIn,
    // } = pkm

    if (pkm.family) {
      console.log(`${pkm.id} has family ${pkm.family}`)
    }

    for (const game of allGames) {
      const gameDir = game.gameSet ?? game.id

      if (pkm.obtainableIn.includes(game.id)) {
        if (!obtainableByGameId[gameDir]) {
          obtainableByGameId[gameDir] = new Set<string>()
        }
        obtainableByGameId[gameDir].add(pkm.id)
      }
      if (pkm.storableIn.includes(game.id)) {
        if (!storableByGameId[gameDir]) {
          storableByGameId[gameDir] = new Set<string>()
        }
        storableByGameId[gameDir].add(pkm.id)
      }
      if (pkm.transferOnlyIn.includes(game.id)) {
        if (!transferOnlyByGameId[gameDir]) {
          transferOnlyByGameId[gameDir] = new Set<string>()
        }
        transferOnlyByGameId[gameDir].add(pkm.id)
      }
      if (pkm.eventOnlyIn.includes(game.id)) {
        if (!eventOnlyByGameId[gameDir]) {
          eventOnlyByGameId[gameDir] = new Set<string>()
        }
        eventOnlyByGameId[gameDir].add(pkm.id)
      }
      if (pkm.shinyLockedIn?.includes(game.id)) {
        if (!shinyLockedByGameId[gameDir]) {
          shinyLockedByGameId[gameDir] = new Set<string>()
        }
        shinyLockedByGameId[gameDir].add(pkm.id)
      }
    }

    for (const game of allGames) {
      const gameDir = game.gameSet ?? game.id
      const counterpartGames = allGamesByGameset[gameDir].filter((g) => g !== game.id)
      if (counterpartGames.length === 0) continue
      if (!pkm.obtainableIn.includes(game.id)) continue

      const isExclusive = counterpartGames.every((g) => !pkm.obtainableIn.includes(g))
      if (isExclusive) {
        if (!exclusivesByGameId[game.id]) {
          exclusivesByGameId[game.id] = new Set<string>()
        }
        exclusivesByGameId[game.id].add(pkm.id)
      }
    }

    const newPkm: PokemonV2 = {
      id: pkm.id,
      nid: pkm.id,
      name: pkm.names['eng'] || '',
      formName: pkm.formNames['eng'] || undefined,
      speciesName: pkm.speciesNames['eng'] || undefined,
      genus: pkm.genus['eng'] || undefined,
      dexNum: pkm.dexNum,
      gen: pkm.gen,
      region: pkm.region,
      debutIn: pkm.debutIn,
      type1: pkm.type1,
      type2: pkm.type2 || null,
      color: pkm.color,
      abilities: [pkm.ability1, pkm.ability2, pkm.abilityHidden, pkm.abilitySpecial].filter(Boolean) as string[],
      baseHp: pkm.baseHp,
      baseAtk: pkm.baseAtk,
      baseDef: pkm.baseDef,
      baseSpAtk: pkm.baseSpAtk,
      baseSpDef: pkm.baseSpDef,
      baseSpeed: pkm.baseSpeed,
      height: pkm.height,
      weight: pkm.weight,
      maleRate: pkm.maleRate,
      femaleRate: pkm.femaleRate,
      isPrerelease: pkm.isPrerelease || false,
      // forms data:
      isDefault: pkm.isDefault || false,
      isForm: pkm.isForm || false,
      formId: pkm.formId || undefined,
      formItem: pkm.formItem || undefined,
      isCosmeticForm: pkm.isCosmeticForm || false,
      isFemaleForm: pkm.isFemaleForm || false,
      hasGenderDifferences: pkm.hasGenderDifferences || false,
      baseSpecies: pkm.baseSpecies || undefined,
      forms: pkm.forms?.length ? pkm.forms : undefined,
      formsDesc: pkm.formsDesc || undefined,
      baseForms: pkm.baseForms?.length ? pkm.baseForms : undefined,
      isBattleOnlyForm: pkm.isBattleOnlyForm || false,
      isFusion: pkm.isFusion || false,
      isMega: pkm.isMega || false,
      isPrimal: pkm.isPrimal || false,
      isGmax: pkm.isGmax || false,
      isRegional: pkm.isRegional,
      // other flags, categories and metadata:
      isLegendary: pkm.isLegendary || false,
      isMythical: pkm.isMythical || false,
      isBaby: pkm.isBaby || false,
      isUltraBeast: pkm.isUltraBeast || false,
      canBeAlpha: pkm.canBeAlpha || false,
      canDynamax: pkm.canDynamax || false,
      canGmax: pkm.canGmax || false,
      shinyReleased: pkm.shinyReleased || false,
      shinyBase: pkm.shinyBase || undefined,
      isParadox: pkm.isParadox || false,
      paradoxSpecies: pkm.paradoxSpecies?.length ? pkm.paradoxSpecies : undefined,
      isConvergent: pkm.isConvergent || false,
      convergentSpecies: pkm.convergentSpecies?.length ? pkm.convergentSpecies : undefined,
      // pre-evolution:
      evolvesFrom: pkm.evolvesFrom || undefined,
      evoFromTrading: pkm.evoFromTrading || undefined,
      evoFromAbility: pkm.evoFromAbility || undefined,
      evoFromCondition: pkm.evoFromCondition || undefined,
      evoFromGender: pkm.evoFromGender || undefined,
      evoFromFriendship: pkm.evoFromFriendship || undefined,
      evoFromItem: pkm.evoFromItem || undefined,
      evoFromLevel: pkm.evoFromLevel || undefined,
      evoFromMove: pkm.evoFromMove || undefined,
      // refs and i18n:
      refs: pkm.refs,
      i18n: {
        en: buildPokemonI18n('eng', pkm),
        fr: buildPokemonI18n('fra', pkm),
        de: buildPokemonI18n('deu', pkm),
        es: buildPokemonI18n('esp', pkm),
        esla: buildPokemonI18n('esla', pkm),
        it: buildPokemonI18n('ita', pkm),
        pt: buildPokemonI18n('por', pkm),
        ja: buildPokemonI18n('jap', pkm),
        ko: buildPokemonI18n('kor', pkm),
        chs: buildPokemonI18n('chs', pkm),
        cht: buildPokemonI18n('cht', pkm),
      },
    }

    fs.writeFileSync(destFile, JSON.stringify(newPkm, null, 2))
  }

  fs.writeFileSync(`${NEW_DATA_PATH}/pokemon-index.json`, JSON.stringify(index, null, 2))

  for (const game of allGames) {
    const gameDir = game.gameSet ?? game.id
    const destDir = path.resolve(NEW_DATA_PATH, `games/${gameDir}/lists`)
    if (!fs.existsSync(destDir)) {
      throw new Error(`List directory ${destDir} does not exist.`)
    }

    fs.writeFileSync(
      `${destDir}/pokemon-obtainable.json`,
      JSON.stringify(Array.from(obtainableByGameId[gameDir] ?? []), null, 2),
    )
    fs.writeFileSync(
      `${destDir}/pokemon-storable.json`,
      JSON.stringify(Array.from(storableByGameId[gameDir] ?? []), null, 2),
    )
    fs.writeFileSync(
      `${destDir}/pokemon-transfer-only.json`,
      JSON.stringify(Array.from(transferOnlyByGameId[gameDir] ?? []), null, 2),
    )
    fs.writeFileSync(
      `${destDir}/pokemon-event-only.json`,
      JSON.stringify(Array.from(eventOnlyByGameId[gameDir] ?? []), null, 2),
    )
    fs.writeFileSync(
      `${destDir}/pokemon-shiny-locked.json`,
      JSON.stringify(Array.from(shinyLockedByGameId[gameDir] ?? []), null, 2),
    )

    const gamesetGames = allGamesByGameset[gameDir]
    if (gamesetGames.length > 1) {
      const exclusives: Record<string, string[]> = {}
      for (const gameId of gamesetGames) {
        if (!exclusivesByGameId[gameId] || exclusivesByGameId[gameId].size === 0) {
          continue
        }
        exclusives[gameId] = Array.from(exclusivesByGameId[gameId])
      }

      if (Object.keys(exclusives).length > 0) {
        fs.writeFileSync(`${destDir}/pokemon-version-exclusives.json`, JSON.stringify(exclusives, null, 2))
      }
    }
  }
}

type GamePokemon = {
  id: string
  method: 'ingame' | 'transfer' | 'event'
  storable: boolean
  shinyLocked: boolean
  exclusiveTo: string[]
}

function processGamePokemonLists() {
  const allPokes = loadAllPokemon()
  const allGames = loadAllGames()
    .filter((g) => g.type === 'game')
    .map((g) => ({
      ...g,
      dirname: g.gameSet ?? g.id,
    }))

  const gamePokemon: Record<string, GamePokemon[]> = {}

  for (const game of allGames) {
    gamePokemon[game.dirname] = []
    const gamesetGames = allGamesByGameset[game.dirname]
    for (const pkm of allPokes) {
      const isObtainable =
        pkm.obtainableIn.includes(game.id) || pkm.transferOnlyIn.includes(game.id) || pkm.eventOnlyIn.includes(game.id)
      if (!isObtainable) continue

      let method: GamePokemon['method'] = 'ingame'
      if (pkm.transferOnlyIn.includes(game.id)) {
        method = 'transfer'
      } else if (pkm.eventOnlyIn.includes(game.id)) {
        method = 'event'
      }

      const exclusiveTo = gamesetGames.filter((g) => pkm.obtainableIn.includes(g))

      gamePokemon[game.dirname].push({
        id: pkm.id,
        method,
        storable: pkm.storableIn.includes(game.id),
        shinyLocked: pkm.shinyLockedIn?.includes(game.id) || false,
        exclusiveTo: exclusiveTo.length !== gamesetGames.length ? exclusiveTo : [],
      })
    }
  }

  for (const game of allGames) {
    const destDir = path.resolve(NEW_DATA_PATH, `games/${game.dirname}/lists`)
    if (!fs.existsSync(destDir)) {
      throw new Error(`List directory ${destDir} does not exist.`)
    }

    fs.writeFileSync(`${destDir}/pokemon.json`, JSON.stringify(gamePokemon[game.dirname], null, 2))
  }
}

processGames()
processPokemon()
processGamePokemonLists()
