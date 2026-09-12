import { Badge } from '@/components/ui/badge'
import { summarizeBoxPresetDraft, type BoxPresetDraft } from '@/lib/box-presets'

type BoxPresetSummaryProps = {
  draft: BoxPresetDraft
  changedCellCount: number
}

export function BoxPresetSummary({ draft, changedCellCount }: BoxPresetSummaryProps) {
  const summary = summarizeBoxPresetDraft(draft)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{summary.boxCount} boxes</Badge>
      <Badge variant="outline">{summary.placedPokemonCount} placed</Badge>
      <Badge variant="outline">{summary.emptyCellCount} empty stored cells</Badge>
      <Badge variant={changedCellCount > 0 ? 'default' : 'secondary'}>
        {changedCellCount} changed cells
      </Badge>
      {summary.duplicatePokemonIds.length > 0 ? (
        <Badge variant="outline">{summary.duplicatePokemonIds.length} duplicates</Badge>
      ) : null}
    </div>
  )
}
