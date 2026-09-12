import { Badge } from '@/components/ui/badge'
import {
  BOX_PRESET_DND_KIND,
  cleanBoxPokemonId,
  getBoxPokemonIdentity,
  hasUnsupportedBoxPokemonId,
  type BoxPresetCellValue,
} from '@/lib/box-presets'
import { cn } from '@/lib/utils'

export type BoxPresetPokemonDisplay = {
  id: string
  label: string
  image: string
  isFemale?: boolean
  isFemaleForm?: boolean
}

type BoxPresetCellProps = {
  boxIndex: number
  cellIndex: number
  value: BoxPresetCellValue
  isPadding?: boolean
  isDragSource?: boolean
  isDropTarget?: boolean
  isRepeatedPokemon?: boolean
  pokemonById: Map<string, BoxPresetPokemonDisplay>
}

export function BoxPresetCell({
  boxIndex,
  cellIndex,
  value,
  isPadding = false,
  isDragSource = false,
  isDropTarget = false,
  isRepeatedPokemon = false,
  pokemonById,
}: BoxPresetCellProps) {
  const pokemonId = cleanBoxPokemonId(value)
  const originalPokemonId = getBoxPokemonIdentity(value)
  const pokemon = pokemonId ? pokemonById.get(pokemonId) : null
  const isObjectValue = !!value && typeof value === 'object'
  const isEmpty = !pokemonId
  const isFemalePokemon = Boolean(pokemon?.isFemale || pokemon?.isFemaleForm)
  const hasUnsupportedFormId = hasUnsupportedBoxPokemonId(value)
  const title =
    pokemon && originalPokemonId
      ? `${pokemon.label} (${originalPokemonId})`
      : (pokemon?.label ?? originalPokemonId ?? (isPadding ? 'Visual padding' : 'Empty cell'))

  return (
    <div
      data-kind={isPadding ? undefined : BOX_PRESET_DND_KIND}
      data-source="cell"
      data-box-index={boxIndex}
      data-cell-index={cellIndex}
      data-empty={isEmpty ? 'true' : 'false'}
      data-padding={isPadding ? 'true' : 'false'}
      data-drag-source={isDragSource ? 'true' : 'false'}
      data-drop-target={isDropTarget ? 'true' : 'false'}
      data-repeated-pokemon={isRepeatedPokemon ? 'true' : 'false'}
      data-unsupported-id={hasUnsupportedFormId ? 'true' : 'false'}
      title={title}
      className={cn(
        'border-border/80 bg-input/45 relative flex aspect-square min-h-12 items-center justify-center rounded-lg border p-1 transition-all select-none [contain-intrinsic-size:3.5rem_3.5rem] [content-visibility:auto]',
        !isPadding && !isEmpty && 'cursor-grab active:cursor-grabbing',
        isEmpty && !isPadding && 'border-accent/70 bg-accent/15 border-dashed',
        isPadding && 'border-border/40 bg-background/20 border-dashed opacity-55',
        'data-[dragging=true]:scale-95 data-[dragging=true]:opacity-30',
        'data-[hovered=true]:border-primary data-[hovered=true]:bg-primary/15 data-[hovered=true]:ring-primary/45 data-[hovered=true]:ring-2',
        'data-[drag-source=true]:border-primary data-[drag-source=true]:bg-primary/15 data-[drag-source=true]:ring-primary/60 data-[drag-source=true]:ring-2',
        'data-[drop-target=true]:scale-[1.03] data-[drop-target=true]:border-emerald-400 data-[drop-target=true]:bg-emerald-500/20 data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-emerald-400/60',
        'data-[repeated-pokemon=true]:border-amber-400/80 data-[repeated-pokemon=true]:bg-amber-500/15 data-[repeated-pokemon=true]:ring-1 data-[repeated-pokemon=true]:ring-amber-400/40',
        'data-[unsupported-id=true]:border-red-400/80 data-[unsupported-id=true]:bg-red-500/15 data-[unsupported-id=true]:ring-1 data-[unsupported-id=true]:ring-red-400/40',
      )}
    >
      {pokemon ? (
        <img
          src={pokemon.image}
          alt={pokemon.label}
          loading="lazy"
          decoding="async"
          className="size-full object-contain"
          draggable={false}
        />
      ) : (
        <span className="text-muted-foreground text-[10px]">{isPadding ? '' : 'Empty'}</span>
      )}

      {isObjectValue || isFemalePokemon ? (
        <div className="absolute top-1 right-1 flex max-w-[calc(100%-0.5rem)] flex-wrap justify-end gap-1">
          {isFemalePokemon ? (
            <Badge
              variant="outline"
              className="h-4 rounded-full border-pink-300/60 bg-pink-500/25 px-1 text-[10px] leading-none font-semibold text-pink-100"
            >
              ♀
            </Badge>
          ) : null}
          {isObjectValue && value.gmax ? (
            <Badge variant="outline" className="h-4 bg-sky-500/15 px-1 text-[10px] text-sky-300">
              G
            </Badge>
          ) : null}
          {isObjectValue && value.shiny ? (
            <Badge
              variant="outline"
              className="h-4 bg-yellow-500/15 px-1 text-[10px] text-yellow-300"
            >
              S
            </Badge>
          ) : null}
          {isObjectValue && value.shinyLocked ? (
            <Badge variant="outline" className="h-4 bg-red-500/15 px-1 text-[10px] text-red-300">
              L
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
