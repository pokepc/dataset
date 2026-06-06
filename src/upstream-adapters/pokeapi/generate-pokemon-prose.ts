/**
 * Generates text descriptions from PokeAPI Pokemon species prose.
 *
 * The endpoint shapes mirror src/upstreams/pokeapi-openapi.yml:
 * - GET /api/v2/pokemon/{id}/ links a Pokemon variety to its species.
 * - GET /api/v2/pokemon-form/{id}/ provides form names and form metadata.
 * - GET /api/v2/pokemon-species/{id}/ provides flavor_text_entries and form_descriptions.
 *
 * Requires OPENAI_API_KEY unless running a dry run without generation.
 *
 * Examples:
 *   bun src/upstream-adapters/pokeapi/generate-pokemon-prose.ts --offset=0 --limit=100
 *   bun src/upstream-adapters/pokeapi/generate-pokemon-prose.ts --offset=100 --limit=100
 *   bun src/upstream-adapters/pokeapi/generate-pokemon-prose.ts --id=bulbasaur --dry-run --max-length=256
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import {
  appLangs,
  appLangsBySlug,
  DEFAULT_LANG_SLUG,
  type LangInfo,
} from '../../lib-next/languages'
import { DEFAULT_POKEAPI_BASE_URL, DEFAULT_POKEAPI_CACHE_DIR, fetchPokeApiJson } from './client'

/**
 * RESEARCH DONE: Averages of PokeAPI english game prose lengths, calculated statically:
 *
 * Updated table, using English rows only:
 *
 * ```md
 * | File / field | Count | Avg chars | Median chars | Min | Max | Avg words |
 * |---|---:|---:|---:|---:|---:|---:|
 * | `pokemon_species_flavor_text.csv` / `flavor_text` | 14,496 | **113.31** | 101 | 49 | 235 | 20.24 |
 * | `pokemon_species_prose.csv` / `form_description` | 34 | **268.65** | 206 | 69 | 951 | 45.09 |
 * | `pokemon_form_names.csv` / `form_name` + `pokemon_name` text cells | 1,116 | **15.10** | 14 | 1 | 39 | 2.35 |
 * | `pokemon_form_names.csv` combined per form row | 583 | **29.81** | 28 | 5 | 70 | 4.50 |
 * ```
 * Whitespace-normalized version only changes `pokemon_species_prose.csv`: **266.50** avg chars instead of **268.65**.
 *
 * CONCLUSION: A 256 to 512 word limit should be sufficient for all generated descriptions.
 */
const POKEMON_INDEX_PATH = join(process.cwd(), 'data/indices/pokemon.json')
const POKEMON_DATA_ROOT = join(process.cwd(), 'data/pokemon')
const DEFAULT_OUTPUT_ROOT = join(process.cwd(), 'data-next/pokemon-texts')
const DEFAULT_MODEL = 'gpt-5.4-mini'
const DEFAULT_MAX_LENGTH_CHARS = 512
const MIN_MAX_LENGTH_CHARS = 50
const OPENAI_MODEL = process.env.OPENAI_MODEL_ID ?? DEFAULT_MODEL
const POKEAPI_BASE_URL = process.env.POKEAPI_BASE_URL ?? DEFAULT_POKEAPI_BASE_URL
const FETCH_RETRIES = parseIntegerEnv('POKEMON_PROSE_FETCH_RETRIES', 3)
const GENERATE_RETRIES = parseIntegerEnv('POKEMON_PROSE_GENERATE_RETRIES', 2)
const DELAY_MS = parseIntegerEnv('POKEMON_PROSE_DELAY_MS', 0)
const DEFAULT_LANG_CODE = appLangsBySlug[DEFAULT_LANG_SLUG].gameLocale.toLowerCase()

type GenerationBackend = 'auto' | 'ai-sdk' | 'openai-sdk'

type CliOptions = {
  ids: string[]
  offset: number
  limit?: number
  outputRoot: string
  dryRun: boolean
  force: boolean
  backend: GenerationBackend
  maxLength: number
  lang: LangInfo
  help: boolean
}

type LocalPokemon = {
  id: string
  dexNum: number
  gen?: number
  type1?: string
  type2?: string
  isForm?: boolean
  names?: Record<string, string>
  genus?: Record<string, string>
  speciesNames?: Record<string, string>
  formNames?: Record<string, string>
  refs?: {
    pkApiId?: string
    pkApiFormId?: string
    pkApiFormSlug?: string
  }
}

type NamedResource = {
  name: string
  url: string
}

type LocalPokemonContext = {
  pokemon: LocalPokemon
  pokemonDetail?: PokeApiPokemonDetail
  formDetail?: PokeApiPokemonFormDetail
  speciesDetail: PokeApiPokemonSpeciesDetail
  sourceWarnings: string[]
}

type ProseEntry = {
  source: 'species-flavor-text' | 'species-form-description'
  version?: string
  text: string
}

type PokeApiPokemonDetail = {
  id: number
  name: string
  species: NamedResource
  forms: NamedResource[]
  gameIndices: NamedResource[]
  types: string[]
}

type PokeApiPokemonFormDetail = {
  id: number
  name: string
  formName: string
  isBattleOnly: boolean
  isMega: boolean
  pokemon: NamedResource
  versionGroup?: NamedResource
  names: LocalizedName[]
  formNames: LocalizedName[]
  types: string[]
}

type PokeApiPokemonSpeciesDetail = {
  id: number
  name: string
  flavorTextEntries: SpeciesFlavorText[]
  formDescriptions: SpeciesDescription[]
  genera: LocalizedGenus[]
  varieties: SpeciesVariety[]
}

type LocalizedName = {
  language: NamedResource
  name: string
}

type LocalizedGenus = {
  language: NamedResource
  genus: string
}

type SpeciesDescription = {
  language: NamedResource
  description: string
}

type SpeciesFlavorText = {
  flavorText: string
  language: NamedResource
  version: NamedResource
}

type SpeciesVariety = {
  isDefault: boolean
  pokemon: NamedResource
}

type TextGenerator = {
  backendName: string
  generate: (
    systemPrompt: string,
    prompt: string,
    maxLength: number,
    lang: LangInfo,
  ) => Promise<string>
}

type DescriptionResponse = z.infer<ReturnType<typeof createDescriptionResponseSchema>>

type AiSdkModule = {
  generateObject: (options: {
    model: unknown
    schema: ReturnType<typeof createDescriptionResponseSchema>
    system: string
    prompt: string
  }) => Promise<{ object: DescriptionResponse }>
}

type AiSdkOpenAiModule = {
  openai: (modelId: string) => unknown
}

type BatchFailure = {
  id: string
  message: string
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    console.log(helpText())
    return
  }

  const index = readPokemonIndex()
  const selectedIds = selectPokemonIds(index, options)

  if (selectedIds.length === 0) {
    console.log('No Pokemon selected.')
    return
  }

  console.log(
    `Selected ${selectedIds.length} Pokemon from ${index.length} local records (offset ${options.offset}, limit ${options.limit ?? 'all'}).`,
  )
  console.log(
    `Language: ${formatLanguageName(options.lang)} (${outputLocaleForLanguage(options.lang)})`,
  )
  console.log(`Output: ${outputDirectoryForLanguage(options)}`)
  console.log(`PokeAPI: ${POKEAPI_BASE_URL}`)
  console.log(`PokeAPI cache: ${pokeApiCacheLabel()}`)
  console.log(`Max generated description length: ${options.maxLength} characters`)

  const generator = options.dryRun ? undefined : await createTextGenerator(options.backend)

  if (generator === undefined) {
    console.log(
      'Dry run: fetching source prose and printing placeholder output without generation.',
    )
  } else {
    console.log(`Generation backend: ${generator.backendName}; model: ${OPENAI_MODEL}`)
  }

  const speciesCache = new Map<string, PokeApiPokemonSpeciesDetail>()
  const failures: BatchFailure[] = []
  let processed = 0
  let written = 0
  let skipped = 0

  for (const [indexInBatch, pokemonId] of selectedIds.entries()) {
    const outputPath = outputPathForPokemon(options, pokemonId)

    if (!options.force && existsSync(outputPath)) {
      skipped += 1
      console.log(`[${indexInBatch + 1}/${selectedIds.length}] ${pokemonId}: skipped existing file`)
      continue
    }

    try {
      const context = await loadPokemonContext(pokemonId, speciesCache)
      const proseEntries = collectLocalizedProseEntries(context.speciesDetail, options.lang)

      if (proseEntries.length === 0) {
        throw new Error(`No ${formatLanguageName(options.lang)} PokeAPI prose entries found`)
      }

      const systemPrompt = buildSystemPrompt(options.lang)
      const prompt = buildPrompt(proseEntries, options.maxLength, options.lang, context.pokemon)
      const description =
        generator === undefined
          ? dryRunDescription(context.pokemon, proseEntries, options.lang)
          : await generateWithRetries(
              generator,
              systemPrompt,
              prompt,
              options.maxLength,
              options.lang,
            )
      const document = buildTextDocument(context, description, options.lang)

      if (options.dryRun) {
        console.log(document)
      } else {
        writeTextFile(outputPath, document)
        written += 1
      }

      processed += 1
      const sourceSummary = `${countFlavorEntries(proseEntries)} ${formatLanguageName(options.lang)} game prose entries`
      console.log(
        `[${indexInBatch + 1}/${selectedIds.length}] ${pokemonId}: ${options.dryRun ? 'previewed' : 'wrote'} ${sourceSummary}`,
      )
      await sleep(DELAY_MS)
    } catch (error) {
      failures.push({ id: pokemonId, message: errorMessage(error) })
      console.error(
        `[${indexInBatch + 1}/${selectedIds.length}] ${pokemonId}: failed: ${errorMessage(error)}`,
      )
    }
  }

  const summary = `Done. Processed ${processed}, wrote ${written}, skipped ${skipped}, failed ${failures.length}.`

  if (failures.length > 0) {
    console.error(summary)
  } else {
    console.log(summary)
  }

  if (failures.length > 0) {
    console.error('Failures:')
    for (const failure of failures) {
      console.error(`- ${failure.id}: ${failure.message}`)
    }
    process.exitCode = 1
  }
}

function parseArgs(argv: string[]): CliOptions {
  const ids: string[] = []
  let offset = 0
  let limit: number | undefined
  let outputRoot = process.env.POKEMON_PROSE_OUTPUT_DIR ?? DEFAULT_OUTPUT_ROOT
  let dryRun = process.env.DRY_RUN === '1'
  let force = false
  let backend = parseBackend(process.env.POKEMON_PROSE_BACKEND ?? 'auto')
  let maxLength = parseMaxLength(
    process.env.POKEMON_PROSE_MAX_LENGTH ?? String(DEFAULT_MAX_LENGTH_CHARS),
    'POKEMON_PROSE_MAX_LENGTH',
  )
  let lang = parseLanguage(
    process.env.POKEMON_PROSE_LANG ?? DEFAULT_LANG_CODE,
    'POKEMON_PROSE_LANG',
  )
  let help = false

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      help = true
    } else if (arg === '--dry-run') {
      dryRun = true
    } else if (arg === '--force') {
      force = true
    } else if (arg.startsWith('--offset=')) {
      offset = parseNonNegativeInteger(arg.slice('--offset='.length), '--offset')
    } else if (arg.startsWith('--limit=')) {
      limit = parsePositiveInteger(arg.slice('--limit='.length), '--limit')
    } else if (arg.startsWith('--id=')) {
      ids.push(...parseIdList(arg.slice('--id='.length)))
    } else if (arg.startsWith('--output-dir=')) {
      outputRoot = arg.slice('--output-dir='.length)
    } else if (arg.startsWith('--backend=')) {
      backend = parseBackend(arg.slice('--backend='.length))
    } else if (arg.startsWith('--max-length=')) {
      maxLength = parseMaxLength(arg.slice('--max-length='.length), '--max-length')
    } else if (arg.startsWith('--lang=')) {
      lang = parseLanguage(arg.slice('--lang='.length), '--lang')
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`)
    } else {
      ids.push(arg)
    }
  }

  return {
    ids: uniqueStrings(ids),
    offset,
    limit,
    outputRoot: resolve(outputRoot),
    dryRun,
    force,
    backend,
    maxLength,
    lang,
    help,
  }
}

function helpText(): string {
  return [
    'Generate Pokemon text files from localized PokeAPI flavor text.',
    '',
    'Usage:',
    '  bun src/upstream-adapters/pokeapi/generate-pokemon-prose.ts --offset=0 --limit=100',
    '  bun src/upstream-adapters/pokeapi/generate-pokemon-prose.ts --id=bulbasaur --dry-run --lang=fra --max-length=256',
    '',
    'Options:',
    '  --offset=N             Start at this local Pokemon index after optional --id filtering.',
    '  --limit=N              Process at most N Pokemon.',
    '  --id=a,b               Process specific local Pokemon IDs. Can be repeated.',
    '  --output-dir=PATH      Default: data-next/pokemon-texts.',
    '  --backend=auto|ai-sdk|openai-sdk',
    `  --max-length=N         Max generated description characters. Default: ${DEFAULT_MAX_LENGTH_CHARS}; minimum: ${MIN_MAX_LENGTH_CHARS}.`,
    `  --lang=CODE            Game locale code, matching the output folder. Default: ${DEFAULT_LANG_CODE}. Valid: ${validLanguageCodes()}.`,
    '  --dry-run              Print placeholder text instead of writing files or calling OpenAI.',
    '  --force                Overwrite existing text files.',
    '',
    'Environment:',
    '  OPENAI_API_KEY                 Required unless dry-running.',
    `  OPENAI_MODEL_ID                Default: ${DEFAULT_MODEL}.`,
    `  POKEAPI_BASE_URL               Default: ${DEFAULT_POKEAPI_BASE_URL}.`,
    `  POKEAPI_CACHE_DIR              Default: ${DEFAULT_POKEAPI_CACHE_DIR}.`,
    '  POKEAPI_CACHE=0                Disable PokeAPI disk cache.',
    '  POKEAPI_REFRESH_CACHE=1        Refetch PokeAPI requests and overwrite cached JSON.',
    '  POKEMON_PROSE_OUTPUT_DIR       Overrides --output-dir default.',
    '  POKEMON_PROSE_BACKEND          auto, ai-sdk, or openai-sdk.',
    `  POKEMON_PROSE_MAX_LENGTH       Max generated description characters. Default: ${DEFAULT_MAX_LENGTH_CHARS}; minimum: ${MIN_MAX_LENGTH_CHARS}.`,
    `  POKEMON_PROSE_LANG             Game locale code, matching the output folder. Default: ${DEFAULT_LANG_CODE}. Valid: ${validLanguageCodes()}.`,
    '  POKEMON_PROSE_DELAY_MS         Optional delay after each processed Pokemon.',
  ].join('\n')
}

function selectPokemonIds(index: string[], options: CliOptions): string[] {
  const selected = options.ids.length === 0 ? index : index.filter((id) => options.ids.includes(id))
  const end = options.limit === undefined ? undefined : options.offset + options.limit
  return selected.slice(options.offset, end)
}

function outputPathForPokemon(options: CliOptions, pokemonId: string): string {
  return join(outputDirectoryForLanguage(options), `${pokemonId}.md`)
}

function outputDirectoryForLanguage(options: CliOptions): string {
  return join(options.outputRoot, outputLocaleForLanguage(options.lang))
}

function outputLocaleForLanguage(lang: LangInfo): string {
  return lang.gameLocale.toLowerCase()
}

function pokeApiCacheLabel(): string {
  if (process.env.POKEAPI_CACHE === '0') {
    return 'disabled'
  }

  const cacheDir = resolve(process.env.POKEAPI_CACHE_DIR ?? DEFAULT_POKEAPI_CACHE_DIR)
  const refreshLabel = process.env.POKEAPI_REFRESH_CACHE === '1' ? ' (refresh enabled)' : ''
  return `${cacheDir}${refreshLabel}`
}

function readPokemonIndex(): string[] {
  const parsed: unknown = JSON.parse(readFileSync(POKEMON_INDEX_PATH, 'utf8'))

  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
    throw new Error(`Expected ${POKEMON_INDEX_PATH} to contain a string array`)
  }

  return parsed
}

function readLocalPokemon(pokemonId: string): LocalPokemon {
  const filePath = join(POKEMON_DATA_ROOT, `${pokemonId}.json`)
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
  const record = requiredRecord(parsed, filePath)
  const id = requiredString(record, 'id', filePath)
  const dexNum = requiredNumber(record, 'dexNum', filePath)

  return {
    id,
    dexNum,
    gen: optionalNumber(record, 'gen'),
    type1: optionalString(record, 'type1'),
    type2: optionalString(record, 'type2'),
    isForm: optionalBoolean(record, 'isForm'),
    names: optionalStringRecord(record, 'names'),
    genus: optionalStringRecord(record, 'genus'),
    speciesNames: optionalStringRecord(record, 'speciesNames'),
    formNames: optionalStringRecord(record, 'formNames'),
    refs: parseRefs(record),
  }
}

async function loadPokemonContext(
  pokemonId: string,
  speciesCache: Map<string, PokeApiPokemonSpeciesDetail>,
): Promise<LocalPokemonContext> {
  const pokemon = readLocalPokemon(pokemonId)
  const warnings: string[] = []
  const pokemonDetail = await fetchOptionalPokemonDetail(pokemon, warnings)
  const formDetail = await fetchOptionalFormDetail(pokemon, warnings)
  const speciesLookup = pokemonDetail
    ? (resourceLookupFromUrl(pokemonDetail.species.url, 'pokemon-species') ??
      pokemonDetail.species.name)
    : String(pokemon.dexNum)
  const speciesDetail = await fetchSpeciesDetail(speciesLookup, speciesCache)

  return {
    pokemon,
    pokemonDetail,
    formDetail,
    speciesDetail,
    sourceWarnings: warnings,
  }
}

async function fetchOptionalPokemonDetail(
  pokemon: LocalPokemon,
  warnings: string[],
): Promise<PokeApiPokemonDetail | undefined> {
  const pokeApiId = pokemon.refs?.pkApiId

  if (pokeApiId === undefined) {
    warnings.push('Local refs.pkApiId is missing; using dexNum for pokemon-species lookup.')
    return undefined
  }

  try {
    const json = await fetchCachedPokeApiJson(`pokemon/${pokeApiId}`)
    return parsePokemonDetail(json, `pokemon/${pokeApiId}`)
  } catch (error) {
    warnings.push(
      `Could not fetch pokemon/${pokeApiId}: ${errorMessage(error)}; using dexNum fallback.`,
    )
    return undefined
  }
}

async function fetchOptionalFormDetail(
  pokemon: LocalPokemon,
  warnings: string[],
): Promise<PokeApiPokemonFormDetail | undefined> {
  const formId = pokemon.refs?.pkApiFormId

  if (formId === undefined) {
    warnings.push('Local refs.pkApiFormId is missing; no pokemon-form context will be included.')
    return undefined
  }

  try {
    const json = await fetchCachedPokeApiJson(`pokemon-form/${formId}`)
    return parsePokemonFormDetail(json, `pokemon-form/${formId}`)
  } catch (error) {
    warnings.push(`Could not fetch pokemon-form/${formId}: ${errorMessage(error)}`)
    return undefined
  }
}

async function fetchSpeciesDetail(
  lookup: string,
  speciesCache: Map<string, PokeApiPokemonSpeciesDetail>,
): Promise<PokeApiPokemonSpeciesDetail> {
  const cached = speciesCache.get(lookup)

  if (cached !== undefined) {
    return cached
  }

  const json = await fetchCachedPokeApiJson(`pokemon-species/${lookup}`)
  const detail = parsePokemonSpeciesDetail(json, `pokemon-species/${lookup}`)
  speciesCache.set(lookup, detail)
  speciesCache.set(String(detail.id), detail)
  speciesCache.set(detail.name, detail)

  return detail
}

async function fetchCachedPokeApiJson(pathname: string): Promise<unknown> {
  return fetchPokeApiJson(pathname, {
    baseUrl: POKEAPI_BASE_URL,
    retries: FETCH_RETRIES,
  })
}

function parsePokemonDetail(value: unknown, context: string): PokeApiPokemonDetail {
  const record = requiredRecord(value, context)

  return {
    id: requiredNumber(record, 'id', context),
    name: requiredString(record, 'name', context),
    species: requiredNamedResource(record.species, `${context}.species`),
    forms: parseNamedResourceArray(record.forms),
    gameIndices: parseGameIndices(record.game_indices),
    types: parseTypeNames(record.types),
  }
}

function parsePokemonFormDetail(value: unknown, context: string): PokeApiPokemonFormDetail {
  const record = requiredRecord(value, context)

  return {
    id: requiredNumber(record, 'id', context),
    name: requiredString(record, 'name', context),
    formName: requiredString(record, 'form_name', context),
    isBattleOnly: requiredBoolean(record, 'is_battle_only', context),
    isMega: requiredBoolean(record, 'is_mega', context),
    pokemon: requiredNamedResource(record.pokemon, `${context}.pokemon`),
    versionGroup: optionalNamedResource(record.version_group),
    names: parseLocalizedNames(record.names),
    formNames: parseLocalizedNames(record.form_names),
    types: parseTypeNames(record.types),
  }
}

function parsePokemonSpeciesDetail(value: unknown, context: string): PokeApiPokemonSpeciesDetail {
  const record = requiredRecord(value, context)

  return {
    id: requiredNumber(record, 'id', context),
    name: requiredString(record, 'name', context),
    flavorTextEntries: parseFlavorTextEntries(record.flavor_text_entries),
    formDescriptions: parseSpeciesDescriptions(record.form_descriptions),
    genera: parseLocalizedGenera(record.genera),
    varieties: parseSpeciesVarieties(record.varieties),
  }
}

function collectLocalizedProseEntries(
  species: PokeApiPokemonSpeciesDetail,
  lang: LangInfo,
): ProseEntry[] {
  const flavorEntries = species.flavorTextEntries
    .filter((entry) => isPokeApiLanguage(entry.language, lang))
    .map((entry) => ({
      source: 'species-flavor-text' as const,
      version: entry.version.name,
      text: normalizePokeApiText(entry.flavorText),
    }))
    .filter((entry) => entry.text.length > 0)

  const formDescriptions = species.formDescriptions
    .filter((entry) => isPokeApiLanguage(entry.language, lang))
    .map((entry) => ({
      source: 'species-form-description' as const,
      text: normalizePokeApiText(entry.description),
    }))
    .filter((entry) => entry.text.length > 0)

  return uniqueProseEntries([...flavorEntries, ...formDescriptions])
}

function buildSystemPrompt(lang: LangInfo): string {
  const languageName = formatLanguageName(lang)

  return `You write original Pokemon descriptions for a structured dataset.

Requirements:
- The supplied PokeAPI prose is written in ${languageName}.
- Synthesize the supplied ${languageName} PokeAPI prose into one cohesive description.
- The description field must be written in ${languageName}; do not write English unless the selected language is English.
- Use the local Pokemon context only for the correct Pokemon name, species name, and form identity. Do not treat names as source prose.
- Use every source entry as evidence, but do not quote or paraphrase any one game entry too closely.
- Include traits that recur across versions and gracefully merge compatible details from different games.
- If the local Pokemon is a form and only species-level prose exists, write about the named local Pokemon while staying faithful to species-level evidence and supplied form metadata.
- Do not invent mechanics, lore, habitats, powers, or behavior that are not supported by the supplied source text or metadata.
- Put 1 to 3 plain ${languageName} paragraphs in the description field, with no heading, markdown, bullets, citations, or labels.
- Use 2 or 3 paragraphs when the description combines several distinct traits, behaviors, or observations.
- Separate paragraphs with a blank line.
- Use complete sentences, good punctuation, and natural paragraph flow.
- Respect the maximum string length supplied by the user prompt.`
}

function buildPrompt(
  proseEntries: ProseEntry[],
  maxLength: number,
  lang: LangInfo,
  pokemon: LocalPokemon,
): string {
  const languageName = formatLanguageName(lang)
  const localContext = buildLocalPokemonPromptContext(pokemon, lang)

  return [
    `Return a JSON object with exactly this shape: {"description":"..."}.`,
    `The source prose entries below are written in ${languageName}.`,
    `The description string must be written in ${languageName}.`,
    `The description string must be ${maxLength} characters or fewer.`,
    'Use 1 to 3 paragraphs. Prefer 2 or 3 paragraphs when the source prose contains several distinct traits or behaviors.',
    'Separate paragraphs with a blank line.',
    lang.slug === DEFAULT_LANG_SLUG
      ? 'Use English because the selected language is English.'
      : 'Do not translate the final description into English.',
    '',
    'Local Pokemon context for naming and form identity only:',
    ...localContext,
    '',
    `Use only these ${languageName} source prose entries:`,
    ...proseEntries.map((entry) => entry.text),
    '',
    'Write the final description now.',
  ].join('\n')
}

function buildLocalPokemonPromptContext(pokemon: LocalPokemon, lang: LangInfo): string[] {
  const pokemonName = displayName(pokemon, lang)
  const speciesName = localizedText(pokemon.speciesNames, lang) ?? pokemonName
  const formName = localizedText(pokemon.formNames, lang)
  const context = [
    `- Local Pokemon ID: ${pokemon.id}`,
    `- Local record kind: ${pokemon.isForm ? 'form' : 'base species'}`,
    `- Pokemon name: ${pokemonName}`,
    `- Species name: ${speciesName}`,
  ]

  if (formName !== undefined) {
    context.push(`- Form name: ${formName}`)
  }

  return context
}

function buildTextDocument(
  context: LocalPokemonContext,
  description: string,
  lang: LangInfo,
): string {
  const { pokemon, speciesDetail } = context
  const classification =
    localizedText(pokemon.genus, lang) ?? localizedGenus(speciesDetail, lang) ?? 'unknown'
  const lines = [`${classification}`, '---', '', normalizeDescription(description)]
  return `${trimTrailingBlankLines(lines).join('\n')}\n`
}

function dryRunDescription(
  pokemon: LocalPokemon,
  proseEntries: ProseEntry[],
  lang: LangInfo,
): string {
  const languageName = formatLanguageName(lang)
  const flavorCount = countFlavorEntries(proseEntries)

  return [
    `DRY RUN (${languageName}): ${displayName(pokemon, lang)} has ${flavorCount} game prose entries`,
    `and ${proseEntries.length - flavorCount} form description entries available for synthesis.`,
    'Run without --dry-run to generate the description.',
  ].join(' ')
}

function createDescriptionResponseSchema(maxLength: number, lang?: LangInfo) {
  const languageName = lang === undefined ? undefined : formatLanguageName(lang)

  return z.object({
    description: z
      .string()
      .min(1)
      .max(maxLength)
      .describe(
        [
          'Original synthesized Pokemon description',
          languageName === undefined ? undefined : `written in ${languageName}`,
          `${maxLength} characters or fewer`,
          'using 1 to 3 paragraphs separated by blank lines',
        ]
          .filter(isString)
          .join(', '),
      ),
  })
}

async function createTextGenerator(backend: GenerationBackend): Promise<TextGenerator> {
  if (!hasOpenAiApiKey()) {
    throw new Error(
      'Set OPENAI_API_KEY before generating prose, or pass --dry-run to inspect source data only.',
    )
  }

  if (backend !== 'openai-sdk') {
    const aiSdkGenerator = await tryCreateAiSdkGenerator()

    if (aiSdkGenerator !== undefined) {
      return aiSdkGenerator
    }

    if (backend === 'ai-sdk') {
      throw new Error(
        'POKEMON_PROSE_BACKEND=ai-sdk was requested, but packages "ai" and "@ai-sdk/openai" are not installed.',
      )
    }
  }

  const client = new OpenAI()

  return {
    backendName: 'openai-sdk',
    generate: async (systemPrompt, prompt, maxLength, lang) => {
      const schema = createDescriptionResponseSchema(maxLength, lang)
      const completion = await client.chat.completions.parse({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(schema, 'pokemon_description'),
      })
      const message = completion.choices[0]?.message

      if (!message?.parsed) {
        throw new Error(`No parsed response: ${message?.refusal ?? 'empty response'}`)
      }

      return normalizeGeneratedDescription(message.parsed.description, maxLength)
    },
  }
}

function hasOpenAiApiKey(): boolean {
  return (process.env.OPENAI_API_KEY?.trim().length ?? 0) > 0
}

async function tryCreateAiSdkGenerator(): Promise<TextGenerator | undefined> {
  try {
    const [{ generateObject }, { openai }] = await Promise.all([
      dynamicImport<AiSdkModule>('ai'),
      dynamicImport<AiSdkOpenAiModule>('@ai-sdk/openai'),
    ])
    const model = openai(OPENAI_MODEL)

    return {
      backendName: 'ai-sdk',
      generate: async (systemPrompt, prompt, maxLength, lang) => {
        const { object } = await generateObject({
          model,
          schema: createDescriptionResponseSchema(maxLength, lang),
          system: systemPrompt,
          prompt,
        })

        return normalizeGeneratedDescription(object.description, maxLength)
      },
    }
  } catch {
    return undefined
  }
}

async function dynamicImport<T>(specifier: string): Promise<T> {
  const importFunction = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<T>

  return importFunction(specifier)
}

async function generateWithRetries(
  generator: TextGenerator,
  systemPrompt: string,
  prompt: string,
  maxLength: number,
  lang: LangInfo,
): Promise<string> {
  let lastError: unknown

  for (let attempt = 1; attempt <= GENERATE_RETRIES; attempt += 1) {
    try {
      return await generator.generate(systemPrompt, prompt, maxLength, lang)
    } catch (error) {
      lastError = error
      await sleep(backoffMs(attempt))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function parseFlavorTextEntries(value: unknown): SpeciesFlavorText[] {
  return recordArray(value)
    .map((record) => {
      const flavorText = optionalString(record, 'flavor_text')
      const language = optionalNamedResource(record.language)
      const version = optionalNamedResource(record.version)

      if (flavorText === undefined || language === undefined || version === undefined) {
        return undefined
      }

      return { flavorText, language, version }
    })
    .filter(isDefined)
}

function parseSpeciesDescriptions(value: unknown): SpeciesDescription[] {
  return recordArray(value)
    .map((record) => {
      const description = optionalString(record, 'description')
      const language = optionalNamedResource(record.language)

      if (description === undefined || language === undefined) {
        return undefined
      }

      return { description, language }
    })
    .filter(isDefined)
}

function parseLocalizedNames(value: unknown): LocalizedName[] {
  return recordArray(value)
    .map((record) => {
      const name = optionalString(record, 'name')
      const language = optionalNamedResource(record.language)

      if (name === undefined || language === undefined) {
        return undefined
      }

      return { name, language }
    })
    .filter(isDefined)
}

function parseLocalizedGenera(value: unknown): LocalizedGenus[] {
  return recordArray(value)
    .map((record) => {
      const genus = optionalString(record, 'genus')
      const language = optionalNamedResource(record.language)

      if (genus === undefined || language === undefined) {
        return undefined
      }

      return { genus, language }
    })
    .filter(isDefined)
}

function parseSpeciesVarieties(value: unknown): SpeciesVariety[] {
  return recordArray(value)
    .map((record) => {
      const isDefault = optionalBoolean(record, 'is_default')
      const pokemon = optionalNamedResource(record.pokemon)

      if (isDefault === undefined || pokemon === undefined) {
        return undefined
      }

      return { isDefault, pokemon }
    })
    .filter(isDefined)
}

function parseGameIndices(value: unknown): NamedResource[] {
  return recordArray(value)
    .map((record) => optionalNamedResource(record.version))
    .filter(isDefined)
}

function parseTypeNames(value: unknown): string[] {
  return recordArray(value)
    .map((record) => {
      const type = optionalNamedResource(record.type)
      return type?.name
    })
    .filter(isDefined)
}

function parseNamedResourceArray(value: unknown): NamedResource[] {
  return recordArray(value).map((record) => requiredNamedResource(record, 'named resource'))
}

function parseRefs(record: Record<string, unknown>): LocalPokemon['refs'] {
  const refs = optionalRecord(record, 'refs')

  if (refs === undefined) {
    return undefined
  }

  return {
    pkApiId: optionalString(refs, 'pkApiId'),
    pkApiFormId: optionalString(refs, 'pkApiFormId'),
    pkApiFormSlug: optionalString(refs, 'pkApiFormSlug'),
  }
}

function requiredNamedResource(value: unknown, context: string): NamedResource {
  const record = requiredRecord(value, context)

  return {
    name: requiredString(record, 'name', context),
    url: requiredString(record, 'url', context),
  }
}

function optionalNamedResource(value: unknown): NamedResource | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const name = optionalString(value, 'name')
  const url = optionalString(value, 'url')

  if (name === undefined || url === undefined) {
    return undefined
  }

  return { name, url }
}

function requiredRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Expected object for ${context}`)
  }

  return value
}

function optionalRecord(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = record[key]
  return isRecord(value) ? value : undefined
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function requiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key]

  if (typeof value !== 'string') {
    throw new Error(`Expected ${context}.${key} to be a string`)
  }

  return value
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function requiredNumber(record: Record<string, unknown>, key: string, context: string): number {
  const value = record[key]

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Expected ${context}.${key} to be a finite number`)
  }

  return value
}

function optionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function requiredBoolean(record: Record<string, unknown>, key: string, context: string): boolean {
  const value = record[key]

  if (typeof value !== 'boolean') {
    throw new Error(`Expected ${context}.${key} to be a boolean`)
  }

  return value
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key]
  return typeof value === 'boolean' ? value : undefined
}

function optionalStringRecord(
  record: Record<string, unknown>,
  key: string,
): Record<string, string> | undefined {
  const value = record[key]

  if (!isRecord(value)) {
    return undefined
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  )
  return Object.fromEntries(entries)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

function isString(value: string | undefined): value is string {
  return value !== undefined && value.length > 0
}

function normalizePokeApiText(value: string): string {
  return value.replace(/\f/g, ' ').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeGeneratedDescription(value: string, maxLength: number): string {
  const description = normalizeDescription(value, maxLength)
  return createDescriptionResponseSchema(maxLength).parse({ description }).description
}

function normalizeDescription(value: string, maxLength?: number): string {
  const paragraphs = normalizedParagraphs(value)

  if (paragraphs.length === 0) {
    return ''
  }

  const nextParagraphs =
    paragraphs.length === 1 ? splitLongParagraph(paragraphs[0]!, maxLength) : paragraphs
  const clampedParagraphs = clampParagraphs(nextParagraphs, 3)

  return clampedParagraphs.join('\n\n')
}

function normalizedParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0)
}

function splitLongParagraph(paragraph: string, maxLength: number | undefined): string[] {
  const sentences = splitSentences(paragraph)

  if (paragraph.length < 260 || sentences.length < 3) {
    return [paragraph]
  }

  const paragraphCount = paragraph.length > 420 && sentences.length >= 5 ? 3 : 2
  const splitParagraphs = splitSentencesIntoParagraphs(sentences, paragraphCount)

  if (maxLength !== undefined && splitParagraphs.join('\n\n').length > maxLength) {
    return [paragraph]
  }

  return splitParagraphs
}

function splitSentences(value: string): string[] {
  return (
    value.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g)?.map((sentence) => sentence.trim()) ?? [
      value,
    ]
  ).filter((sentence) => sentence.length > 0)
}

function splitSentencesIntoParagraphs(sentences: string[], paragraphCount: number): string[] {
  const totalLength = sentences.reduce((sum, sentence) => sum + sentence.length, 0)
  const targetLength = totalLength / paragraphCount
  const paragraphs: string[] = []
  let current: string[] = []
  let currentLength = 0

  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index]!
    const remainingSentences = sentences.length - index
    const remainingParagraphs = paragraphCount - paragraphs.length

    current.push(sentence)
    currentLength += sentence.length

    if (
      currentLength >= targetLength &&
      paragraphs.length < paragraphCount - 1 &&
      remainingSentences > remainingParagraphs
    ) {
      paragraphs.push(current.join(' '))
      current = []
      currentLength = 0
    }
  }

  if (current.length > 0) {
    paragraphs.push(current.join(' '))
  }

  return paragraphs
}

function clampParagraphs(paragraphs: string[], maxParagraphs: number): string[] {
  if (paragraphs.length <= maxParagraphs) {
    return paragraphs
  }

  return [...paragraphs.slice(0, maxParagraphs - 1), paragraphs.slice(maxParagraphs - 1).join(' ')]
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const out = [...lines]

  while (out.at(-1) === '') {
    out.pop()
  }

  return out
}

function uniqueProseEntries(entries: ProseEntry[]): ProseEntry[] {
  const seen = new Set<string>()
  const out: ProseEntry[] = []

  for (const entry of entries) {
    const key = `${entry.source}\0${entry.version ?? ''}\0${entry.text}`

    if (!seen.has(key)) {
      seen.add(key)
      out.push(entry)
    }
  }

  return out
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter(isString)))
}

function localizedText(
  value: Record<string, string> | undefined,
  lang: LangInfo,
): string | undefined {
  if (value === undefined) {
    return undefined
  }

  for (const key of localLanguageKeys(lang)) {
    const text = value[key]

    if (isString(text)) {
      return text
    }
  }

  return isString(value.eng) ? value.eng : undefined
}

function localLanguageKeys(lang: LangInfo): string[] {
  return uniqueStrings([lang.oldCode, lang.slug === 'mx' ? 'esp' : undefined, 'eng'])
}

function localizedGenus(species: PokeApiPokemonSpeciesDetail, lang: LangInfo): string | undefined {
  return species.genera.find((entry) => isPokeApiLanguage(entry.language, lang))?.genus
}

function isPokeApiLanguage(resource: NamedResource, lang: LangInfo): boolean {
  return resourceLookupFromUrl(resource.url, 'language') === String(lang.pokeApiId)
}

function displayName(pokemon: LocalPokemon, lang: LangInfo): string {
  return localizedText(pokemon.names, lang) ?? pokemon.id
}

function formatLanguageName(lang: LangInfo): string {
  return `${lang.engName} (${lang.name})`
}

function countFlavorEntries(entries: ProseEntry[]): number {
  return entries.filter((entry) => entry.source === 'species-flavor-text').length
}

function writeTextFile(filePath: string, text: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, text)
}

function resourceLookupFromUrl(resourceUrl: string, resourceKind: string): string | undefined {
  try {
    const url = new URL(resourceUrl)
    const segments = url.pathname.split('/').filter(Boolean)
    const kindIndex = segments.lastIndexOf(resourceKind)
    return kindIndex === -1 ? undefined : segments[kindIndex + 1]
  } catch {
    return undefined
  }
}

function parseIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]

  if (raw === undefined) {
    return fallback
  }

  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }

  return parsed
}

function parseNonNegativeInteger(value: string, label: string): number {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }

  return parsed
}

function parseMaxLength(value: string, label: string): number {
  const parsed = parsePositiveInteger(value, label)

  if (parsed < MIN_MAX_LENGTH_CHARS) {
    throw new Error(`${label} must be at least ${MIN_MAX_LENGTH_CHARS}`)
  }

  return parsed
}

function parseIdList(value: string): string[] {
  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
}

function parseBackend(value: string): GenerationBackend {
  if (value === 'auto' || value === 'ai-sdk' || value === 'openai-sdk') {
    return value
  }

  throw new Error(`Invalid backend: ${value}`)
}

function parseLanguage(value: string, label: string): LangInfo {
  const normalizedValue = value.trim().toLowerCase()
  const lang = appLangs.find((candidate) => outputLocaleForLanguage(candidate) === normalizedValue)

  if (lang !== undefined) {
    return lang
  }

  throw new Error(`${label} must be one of: ${validLanguageCodes()}`)
}

function validLanguageCodes(): string {
  return appLangs.map((lang) => outputLocaleForLanguage(lang)).join(', ')
}

function backoffMs(attempt: number): number {
  return Math.min(15_000, 750 * 2 ** Math.max(0, attempt - 1))
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return
  }

  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

main().catch((error) => {
  console.error(errorMessage(error))
  process.exit(1)
})
