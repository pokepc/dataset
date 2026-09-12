import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function pokemonSpriteUrl(
  pokemonNid: string,
  shiny: boolean = false,
  variant: 'home2d-icon' | 'home3d-icon' | 'home3d-icon-xl' = 'home3d-icon',
): string {
  return `https://static.pokepc.net/images/pokemon/${variant}/${shiny ? 'shiny' : 'regular'}/${pokemonNid}.webp`
}

export function gameSpriteUrl(
  gameId: string,
  variant: 'icons' | 'gametiles' = 'gametiles',
): string {
  return `https://static.pokepc.net/images/games/${variant}/${gameId}.webp?v=poke30`
}
