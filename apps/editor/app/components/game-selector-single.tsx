import { GameOptionCombobox } from './game-option-combobox'
import type { GameOption, GameSelectorMode } from './types'

type GameSelectorSingleProps = {
  value: string
  onChange: (nextValue: string) => void
  options: GameOption[]
  mode?: GameSelectorMode
  placeholder?: string
  disabled?: boolean
}

export function GameSelectorSingle({
  value,
  onChange,
  options,
  mode = 'games',
  placeholder = 'Select game',
  disabled = false,
}: GameSelectorSingleProps) {
  const filteredOptions = options.filter((option) => option.modes.includes(mode))

  return (
    <GameOptionCombobox
      options={filteredOptions}
      value={value}
      onSelect={(nextOption) => {
        onChange(nextOption.id)
      }}
      placeholder={placeholder}
      disabled={disabled}
      triggerClassName="w-full justify-between"
    />
  )
}
