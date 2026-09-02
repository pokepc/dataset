import {
  abilitySchema,
  i18nSchema,
  type AbilityRecord,
  type I18nRecord,
} from '../../../lib-next/schemas'
import type { I18nCode } from '../mappings'

/**
 * Content that has been announced but is not in the ROM dump yet.
 *
 * The champout build mirrors the dump, so anything here is preliminary by
 * definition: it retires itself the moment the dump carries the real record,
 * because both helpers below leave an id the dump already has untouched.
 */
interface PreliminaryAbility {
  id: string
  slug: string
  /** Kept in English for every language until official names exist. */
  name: string
  descriptions: Record<I18nCode, string>
}

const PRELIMINARY_ABILITIES: readonly PreliminaryAbility[] = [
  {
    // Mega Lucario Z's Ability, announced for Regulation Set M-C:
    // https://news.pokemon-home.com/en/page/816.html
    //
    // Each description reuses the first clause of that language's own in-game
    // Fluffy text, which describes the identical effect, so the wording is the
    // game's rather than a translation of the announcement.
    id: 'auraguard',
    slug: 'aura-guard',
    name: 'Aura Guard',
    descriptions: {
      usa: 'Halves the damage the Pokémon takes from contact moves.',
      jpn: '接触技で受けるダメージが半減する。',
      kor: '접촉 기술로 입는 데미지가 반감된다.',
      sch: '因接触类招式而受到的伤害会减半。',
      tch: '因接觸類招式而受到的傷害會減半。',
      deu: 'Der Schaden, den das Pokémon durch Kontaktattacken erleidet, wird halbiert.',
      fra: 'Les dégâts des capacités à contact subis par le Pokémon sont réduits de moitié.',
      ita: 'Dimezza i danni subiti dalle mosse da contatto.',
      esp: 'Reduce a la mitad el daño recibido por los movimientos de contacto.',
      latam: 'Reduce un 50% el daño recibido por los movimientos de contacto.',
    },
  },
]

/** Append the preliminary abilities the dump does not carry yet. */
export function applyPreliminaryAbilities(abilities: AbilityRecord[]): AbilityRecord[] {
  const known = new Set(abilities.map((ability) => ability.id))

  return [
    ...abilities,
    ...PRELIMINARY_ABILITIES.filter((ability) => !known.has(ability.id)).map((ability) =>
      abilitySchema.parse({
        id: ability.id,
        // No dump record means no Champions id to carry. Left empty rather
        // than guessed: TOKUSEI slots 314 and 317 are both free.
        championsId: '',
        slug: ability.slug,
        name: ability.name,
        description: ability.descriptions.usa,
      }),
    ),
  ]
}

/** The same abilities for one language's i18n file. */
export function applyPreliminaryAbilityI18n(records: I18nRecord[], lang: I18nCode): I18nRecord[] {
  const known = new Set(records.map((record) => record.id))

  return [
    ...records,
    ...PRELIMINARY_ABILITIES.filter((ability) => !known.has(ability.id)).map((ability) =>
      i18nSchema.parse({
        id: ability.id,
        slug: ability.slug,
        // Follows `name`, which is the English one in every language for now.
        slugLoc: ability.slug,
        name: ability.name,
        description: ability.descriptions[lang],
      }),
    ),
  ]
}
