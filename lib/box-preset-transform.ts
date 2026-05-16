import {
  collectModernBoxPresetSanitizerDiagnostics,
  sanitizeModernBoxPresetSlots,
  type ModernBoxPresetSanitizerDiagnostic,
} from './box-preset-sanitizer'
import { boxPresetSchema, modernBoxPresetIndexSchema, modernBoxPresetSchema } from './schemas'
import fs from 'node:fs'
import path from 'node:path'

export type TransformModernBoxPresetsOptions = {
  datasetDir: string
  validPokemonIds: ReadonlySet<string>
}

export type TransformModernBoxPresetsResult = {
  gameSets: string[]
  presetCount: number
  diagnostics: ModernBoxPresetSanitizerDiagnostic[]
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
}

function cleanModernPresetDir(modernDir: string) {
  if (fs.existsSync(modernDir)) {
    fs.rmSync(modernDir, { recursive: true, force: true })
  }
  fs.mkdirSync(modernDir, { recursive: true })
}

function getSlotPokemonId(slot: Pkds.ModernBoxPresetSlot): string | null {
  if (slot === null) return null
  if (typeof slot === 'string') return slot
  return slot.pokemon
}

function validateModernPresetPokemonIds(preset: Pkds.ModernBoxPreset, validPokemonIds: ReadonlySet<string>) {
  for (const [boxIndex, box] of preset.boxes.entries()) {
    for (const [slotIndex, slot] of box.slots.entries()) {
      const pokemonId = getSlotPokemonId(slot)
      if (pokemonId === null || validPokemonIds.has(pokemonId)) continue
      throw new Error(
        [
          `Unknown Modern preset pokemon id "${pokemonId}"`,
          `gameSet=${preset.gameSet}`,
          `presetId=${preset.id}`,
          `boxIndex=${boxIndex}`,
          `slotIndex=${slotIndex}`,
        ].join(' '),
      )
    }
  }
}

function inferModernBoxPresetTags(preset: Pkds.LegacyBoxPreset): Pkds.ModernBoxPresetTag[] {
  const text = `${preset.id} ${preset.name}`.toLowerCase()
  return [
    ['recommended', /recommended/.test(text)],
    ['national', /national/.test(text)],
    ['grouped', /grouped|region/.test(text)],
    ['sorted', /sorted/.test(text)],
    ['minimal', /minimal/.test(text)],
    ['shiny', /shiny/.test(text)],
    ['forms', /forms?/.test(text)],
  ].flatMap(([tag, matches]) => (matches ? [tag as Pkds.ModernBoxPresetTag] : []))
}

function isHiddenClassicPreset(preset: Pkds.LegacyBoxPreset): boolean {
  return boxPresetSchema.parse(preset).isHidden === true
}

export function transformClassicBoxPreset(
  gameSet: string,
  preset: Pkds.LegacyBoxPreset,
  validPokemonIds: ReadonlySet<string>,
): {
  preset: Pkds.ModernBoxPreset
  diagnostics: ModernBoxPresetSanitizerDiagnostic[]
} {
  const parsedPreset = boxPresetSchema.parse(preset)
  const diagnostics: ModernBoxPresetSanitizerDiagnostic[] = []
  const modernPreset: Pkds.ModernBoxPreset = {
    schemaVersion: 1,
    id: parsedPreset.id,
    gameSet,
    name: parsedPreset.name,
    description: parsedPreset.description || undefined,
    source: {
      kind: 'classic',
      gameSet: parsedPreset.gameSet ?? gameSet,
      presetId: parsedPreset.id,
      version: parsedPreset.version,
      legacyId: parsedPreset.legacyId,
    },
    tags: inferModernBoxPresetTags(parsedPreset),
    boxes: parsedPreset.boxes.map((box, boxIndex) => {
      const slots = sanitizeModernBoxPresetSlots(box.pokemon, {
        gameSet,
        presetId: parsedPreset.id,
        boxIndex,
        validPokemonIds,
      })
      diagnostics.push(
        ...collectModernBoxPresetSanitizerDiagnostics(box.pokemon, slots, {
          gameSet,
          presetId: parsedPreset.id,
          boxIndex,
          validPokemonIds,
        }),
      )
      return {
        name: box.title,
        slots,
      }
    }),
  }

  const validatedPreset = modernBoxPresetSchema.parse(modernPreset)
  validateModernPresetPokemonIds(validatedPreset, validPokemonIds)
  return {
    preset: validatedPreset,
    diagnostics,
  }
}

export function transformModernBoxPresets(options: TransformModernBoxPresetsOptions): TransformModernBoxPresetsResult {
  const classicDir = path.join(options.datasetDir, 'boxpresets', 'classic')
  const modernDir = path.join(options.datasetDir, 'boxpresets', 'modern')
  const gameSetFiles = fs
    .readdirSync(classicDir)
    .filter((filename) => filename.endsWith('.json'))
    .sort()

  cleanModernPresetDir(modernDir)

  const result: TransformModernBoxPresetsResult = {
    gameSets: [],
    presetCount: 0,
    diagnostics: [],
  }

  for (const filename of gameSetFiles) {
    const gameSet = path.basename(filename, '.json')
    const classicPresetsById = readJson<Record<string, Pkds.LegacyBoxPreset>>(path.join(classicDir, filename))
    const presetIds = Object.keys(classicPresetsById).filter(
      (presetId) => !isHiddenClassicPreset(classicPresetsById[presetId]),
    )
    const index = modernBoxPresetIndexSchema.parse(presetIds)
    writeJson(path.join(modernDir, `${gameSet}.json`), index)

    for (const presetId of index) {
      const classicPreset = classicPresetsById[presetId]
      if (!classicPreset) {
        throw new Error(`Classic preset ${gameSet}/${presetId} is missing from ${filename}`)
      }
      const transformed = transformClassicBoxPreset(gameSet, classicPreset, options.validPokemonIds)
      if (transformed.preset.id !== presetId) {
        throw new Error(`Preset id mismatch for ${gameSet}/${presetId}`)
      }
      writeJson(path.join(modernDir, gameSet, `${presetId}.json`), transformed.preset)
      result.presetCount += 1
      result.diagnostics.push(...transformed.diagnostics)
    }

    result.gameSets.push(gameSet)
  }

  return result
}
