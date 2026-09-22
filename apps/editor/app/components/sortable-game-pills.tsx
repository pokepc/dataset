import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DragDropManager, type DragDropCallbacks } from 'dnd-manager'
import { XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { GameOption } from './types'

type SortableGamePillsProps = {
  ids: string[]
  options: GameOption[]
  onChange: (nextIds: string[]) => void
  disabled?: boolean
  className?: string
}

type DragItem = {
  id: string
}

export function SortableGamePills({
  ids,
  options,
  onChange,
  disabled = false,
  className,
}: SortableGamePillsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPreview, setDragPreview] = useState<{
    id: string
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const optionById = new Map(options.map((option) => [option.id, option]))

  useEffect(() => {
    const container = containerRef.current
    if (!container || disabled) return

    const callbacks: DragDropCallbacks<DragItem, number> = {
      getItemPosition: (element) => {
        const index = element.dataset.index
        if (index === undefined) return null
        return Number.parseInt(index, 10)
      },
      getItemData: (_element, position) => {
        const id = ids[position]
        return id ? { id } : null
      },
      onDragStart: (element, _position, item) => {
        const rect = element.getBoundingClientRect()
        setIsDragging(true)
        setDragPreview({
          id: item.id,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        })
      },
      onDragMove: (position) => {
        setDragPreview((current) =>
          current
            ? {
                ...current,
                x: position.x,
                y: position.y,
              }
            : current,
        )
      },
      onDrop: (sourceIndex, targetIndex) => {
        if (sourceIndex === targetIndex) return
        const nextIds = [...ids]
        const [moved] = nextIds.splice(sourceIndex, 1)
        if (!moved) return
        nextIds.splice(targetIndex, 0, moved)
        onChange(nextIds)
      },
      onDragEnd: () => {
        setIsDragging(false)
        setDragPreview(null)
      },
      onClick: () => {},
    }

    const manager = new DragDropManager<DragItem, number>(
      container,
      {
        draggableKind: 'game-pill',
        droppableKind: 'game-pill',
        dragThreshold: 8,
        clickThreshold: 8,
      },
      callbacks,
    )

    return () => manager.destroy()
  }, [ids, onChange, disabled])

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-wrap items-start gap-2 rounded-xl border border-transparent p-1.5 transition-colors',
        isDragging && 'border-accent/60 bg-accent/10',
        className,
      )}
    >
      {ids.map((id, index) => {
        const option = optionById.get(id)
        return (
          <Badge
            key={id}
            data-kind="game-pill"
            data-index={index}
            variant="secondary"
            title={option?.label ?? id}
            className={cn(
              'group/pill border-border/70 bg-card relative size-16 cursor-grab overflow-hidden rounded-xl border p-0',
              'transition-all',
              'data-[dragging=true]:scale-95 data-[dragging=true]:opacity-25',
              'data-[hovered=true]:border-accent data-[hovered=true]:ring-accent/60 data-[hovered=true]:scale-105 data-[hovered=true]:ring-2',
              disabled && 'cursor-not-allowed opacity-70',
            )}
          >
            {option ? (
              <img src={option.image} alt="" aria-hidden className="size-full object-cover" />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn(
                'bg-background/80 absolute top-0.5 right-0.5 size-5 rounded-full transition-opacity',
                'cannot-hover:opacity-100',
                'can-hover:opacity-0 can-hover:pointer-events-none',
                'can-hover:group-hover/pill:opacity-100 can-hover:group-hover/pill:pointer-events-auto',
              )}
              disabled={disabled}
              // Stop before the native drag listener can capture the button's pointer.
              onPointerDownCapture={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onChange(ids.filter((currentId) => currentId !== id))
              }}
              aria-label={`Remove ${option?.label ?? id}`}
            >
              <XIcon className="size-3" />
            </Button>
          </Badge>
        )
      })}

      {dragPreview ? (
        <div
          className="border-accent/70 bg-card/95 pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border p-1.5 shadow-2xl"
          style={{
            left: dragPreview.x,
            top: dragPreview.y,
            width: `${dragPreview.width}px`,
            height: `${dragPreview.height}px`,
          }}
        >
          {optionById.get(dragPreview.id) ? (
            <img
              src={optionById.get(dragPreview.id)?.image}
              alt=""
              aria-hidden
              className="size-full object-contain"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
