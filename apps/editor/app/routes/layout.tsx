import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { BoxIcon, WrenchIcon } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'

type NavItem = {
  to: string
  label: string
  end?: boolean
  icon?: LucideIcon
}

const navItems: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/pokemon', label: 'Pokemon' },
  { to: '/games', label: 'Games' },
  { to: '/pokedexes', label: 'Pokedexes' },
  { to: '/box-presets', label: 'Box Presets', icon: BoxIcon },
  { to: '/maintenance', label: 'Maintenance', icon: WrenchIcon },
]

export default function LayoutRoute() {
  return (
    <div className="bg-background min-h-screen">
      <header className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/80 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link to="/" className="text-foreground text-sm font-bold tracking-tight sm:text-base">
            PokePC Dataset Editor
          </Link>

          <nav className="flex items-center gap-3">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                {({ isActive }) => {
                  const Icon = item.icon
                  return (
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      className={cn('min-w-20', !isActive && 'text-muted-foreground')}
                    >
                      {Icon ? <Icon data-icon="inline-start" /> : null}
                      {item.label}
                    </Button>
                  )
                }}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  )
}
