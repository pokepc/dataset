import { Collapsible } from '@base-ui/react/collapsible'

import { cn } from '@/lib/utils'

const Drawer = Collapsible.Root

function DrawerTrigger({ className, ...props }: Collapsible.Trigger.Props) {
  return (
    <Collapsible.Trigger
      data-slot="drawer-trigger"
      className={cn(
        'focus-visible:border-ring focus-visible:ring-ring/50 rounded-4xl outline-none focus-visible:ring-[3px]',
        className,
      )}
      {...props}
    />
  )
}

function DrawerContent({ className, ...props }: Collapsible.Panel.Props) {
  return (
    <Collapsible.Panel
      data-slot="drawer-content"
      className={cn(
        'border-border bg-card text-card-foreground ring-foreground/5 overflow-hidden rounded-2xl border shadow-2xl ring-1',
        'data-closed:hidden',
        className,
      )}
      {...props}
    />
  )
}

export { Drawer, DrawerContent, DrawerTrigger }
