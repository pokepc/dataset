import { BOX_PRESET_DND_KIND } from '@/lib/box-presets'
import { cn } from '@/lib/utils'
import { Trash2Icon } from 'lucide-react'

type BoxPresetTrashProps = {
  className?: string
  compact?: boolean
  isDropTarget?: boolean
}

export function BoxPresetTrash({
  className,
  compact = false,
  isDropTarget = false,
}: BoxPresetTrashProps) {
  return (
    <div
      data-kind={BOX_PRESET_DND_KIND}
      data-source="trash"
      data-testid="box-preset-trash"
      data-drop-target={isDropTarget ? 'true' : 'false'}
      className={cn(
        'bg-destructive/80 flex items-center justify-center gap-2 border border-dashed border-red-100 text-black transition-all',
        compact
          ? 'min-h-9 rounded-xl px-3 py-1.5 text-xs'
          : 'mx-auto min-h-16 max-w-xl rounded-2xl px-4 py-3 text-sm',
        'data-[hovered=true]:border-destructive data-[hovered=true]:bg-destructive/30 data-[hovered=true]:ring-destructive/35 data-[hovered=true]:ring-2',
        'data-[drop-target=true]:border-destructive data-[drop-target=true]:bg-destructive data-[drop-target=true]:ring-4 data-[drop-target=true]:ring-red-300',
        'select-none data-[drop-target=true]:scale-105',
        className,
      )}
    >
      <Trash2Icon className={compact ? 'size-4' : 'size-6'} />
      <span className="font-medium">Trash Zone</span>
    </div>
  )
}
