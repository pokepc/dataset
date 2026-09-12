import { cardClassNames, CardHeader, CardTitle } from '@/components/ui/card'
import { loadPokedexesIndexData } from '@/lib/pokedex-logic.server'
import { cn } from '@/lib/utils'
import { Link } from 'react-router'

export function meta() {
  return [
    { title: 'Pokedexes | PokePC Dataset Editor' },
    {
      name: 'description',
      content: 'Browse and edit existing Pokedex records.',
    },
  ]
}

export async function loader() {
  return loadPokedexesIndexData()
}

export default function PokedexesIndexPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>
}) {
  const { pokedexes } = loaderData

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Pokedexes</h1>
        <p className="text-muted-foreground text-sm">
          Select a Pokedex to review and edit its general info and entry order.
        </p>
      </div>

      {pokedexes.length > 0 ? (
        <ul
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
        >
          {pokedexes.map((pokedex) => (
            <li key={pokedex.id} className="h-full">
              <Link
                to={`/pokedexes/${pokedex.id}`}
                className={cardClassNames(
                  cn(
                    'border-card bg-card hover:border-primary hover:bg-primary/10 block h-full border p-3',
                  ),
                )}
              >
                <CardHeader className="gap-2 p-0">
                  <CardTitle className="text-base">{pokedex.label}</CardTitle>
                  <p className="text-muted-foreground text-xs">
                    Gen {pokedex.gen} • {pokedex.entryCount} entries
                  </p>
                </CardHeader>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No Pokedex records were found in the dataset.
        </p>
      )}
    </section>
  )
}
