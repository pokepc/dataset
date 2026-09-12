import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDownIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

type CollapsibleSectionProps = {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
  buttonClassName?: string
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  className,
  buttonClassName,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={cn('space-y-2', className)}>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          'h-auto w-full justify-between p-2 text-left text-lg font-semibold tracking-tight',
          buttonClassName,
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{title}</span>
        <ChevronDownIcon className={cn('transition-transform', open ? 'rotate-180' : undefined)} />
      </Button>

      {open ? <div>{children}</div> : null}
    </section>
  )
}
