import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { pokemonSpriteUrl } from '@/lib/utils'
import { loadAllPokemon } from '@pokepc/dataset/lib/fs'
import { ArrowRightIcon, SparklesIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { Route } from './+types/index'

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'PokePC Dataset Editor' },
    { name: 'description', content: 'Browse and edit Pokemon dataset content.' },
  ]
}

export async function loader() {
  const pokemon = loadAllPokemon()
  return {
    pokemon: pokemon.map((pokemon: Pkds.Pokemon) => ({
      id: pokemon.id,
      name: pokemon.names.eng,
      image: pokemonSpriteUrl(pokemon.nid),
    })),
  }
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { pokemon } = loaderData
  const featured = pokemon.slice(0, 6)

  return (
    <div className="space-y-6">
      <Card className="border-border from-card via-card to-primary/20 overflow-hidden bg-gradient-to-br">
        <CardHeader className="space-y-3">
          <Badge className="w-fit" variant="secondary">
            <SparklesIcon data-icon="inline-start" />
            Dataset Overview
          </Badge>
          <CardTitle className="text-2xl tracking-tight sm:text-3xl">
            Welcome to the PokePC Dataset Editor
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Explore Pokemon records and manage core data from a clean, focused workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="border-border bg-background/90 rounded-2xl border px-4 py-2.5 text-sm">
            Total Pokemon: <span className="text-foreground font-semibold">{pokemon.length}</span>
          </div>
          <Button render={<Link to="/pokemon" />} nativeButton={false}>
            Open Pokemon
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Featured Pokemon</CardTitle>
          <CardDescription>Quick preview from the dataset.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {featured.map((item) => (
              <li
                key={item.id}
                className="border-border bg-card hover:border-accent hover:bg-accent/50 rounded-2xl border p-4 text-center transition-colors"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  className="mx-auto size-20 object-contain"
                />
                <p className="mt-3 truncate text-sm leading-tight font-medium">{item.name}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
