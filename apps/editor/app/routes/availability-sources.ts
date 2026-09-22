import { loadPokemonAvailabilitySource } from '@/lib/availability-sources.server'
import { data } from 'react-router'
import type { Route } from './+types/availability-sources'

export async function loader({ request }: Route.LoaderArgs) {
  return data(await loadPokemonAvailabilitySource(request), {
    headers: { 'Cache-Control': 'no-store' },
  })
}

// Evidence is loaded explicitly; saving a draft must not refetch upstream pages.
export function shouldRevalidate() {
  return false
}
