export type GameSelectorMode = 'games' | 'gamesets'

export type GameOption = {
  id: string
  label: string
  image: string
  modes: GameSelectorMode[]
}
