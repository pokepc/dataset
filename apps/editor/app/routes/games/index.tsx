import { cardClassNames, CardHeader, CardTitle } from '@/components/ui/card'
import {
  GAME_AVAILABILITY_FIRST_COMPLETED_GEN,
  GAME_AVAILABILITY_LAST_COMPLETED_GEN,
} from '@/config'
import { loadGamesIndexData } from '@/lib/games-logic.server'
import { cn } from '@/lib/utils'
import { Link } from 'react-router'

export function meta() {
  return [
    { title: 'Games | PokePC Dataset Editor' },
    {
      name: 'description',
      content: 'Browse games and edit availability from the game perspective.',
    },
  ]
}

export async function loader() {
  return loadGamesIndexData()
}

export default function GamesIndexPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>
}) {
  const { games } = loaderData

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Games</h1>
        <p className="text-muted-foreground text-sm">
          Select a game to edit Pokemon availability from the game perspective.
        </p>
      </div>

      {games.length > 0 ? (
        <ul
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
        >
          {games.map((game) => (
            <li key={game.id} className="h-full">
              <Link
                to={`/games/${game.id}`}
                className={cardClassNames(
                  cn(
                    'border-card bg-card hover:border-primary hover:bg-primary/10 block h-full border p-3',
                    {
                      'border-emerald-600/60 bg-emerald-600/10':
                        game.gen >= GAME_AVAILABILITY_FIRST_COMPLETED_GEN &&
                        game.gen <= GAME_AVAILABILITY_LAST_COMPLETED_GEN,
                    },
                  ),
                )}
              >
                <CardHeader className="items-center gap-2 bg-none p-0 text-center">
                  <div className="flex h-26 items-center justify-center">
                    <img
                      src={game.image}
                      alt={game.label}
                      loading="lazy"
                      className="size-24 rounded-sm object-contain"
                    />
                  </div>
                  <CardTitle className="text-sm">{game.label}</CardTitle>
                </CardHeader>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No game records were found in the dataset.</p>
      )}
    </section>
  )
}
