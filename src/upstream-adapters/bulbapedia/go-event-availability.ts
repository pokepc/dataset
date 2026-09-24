type GoEventRule = { note: string; sourceUrl: string }

// Reviewed 2026-09-24. Exact records only; applied after the GO table proves release.
// Permanent research and recurring raids take precedence over an event debut.
// Sources, retained forms and review criteria: docs/audits/go-legendary-mythical-availability.md.
export const goEventAvailabilityRules: Partial<Record<string, GoEventRule>> = {
  cosmog: {
    note: 'Cosmog requires Special Research claimed during a limited event or season.',
    sourceUrl: 'https://pokemongo.com/news/solstice-horizons',
  },
  cosmoem: {
    note: 'Cosmoem evolves from event-research Cosmog; no independent ordinary GO route.',
    sourceUrl: 'https://www.serebii.net/pokemongo/pokemon/790.shtml',
  },
  kubfu: {
    note: 'Kubfu requires the limited-claim Might and Mastery or Fuzzy Fighter research.',
    sourceUrl: 'https://pokemongo.com/news/final-strike-2025?hl=en',
  },
  urshifu: {
    note: 'Single Strike Urshifu evolves from event-research Kubfu; no independent ordinary GO route.',
    sourceUrl: 'https://pokemongo.com/news/final-strike-2025?hl=en',
  },
  'urshifu-rapid-strike': {
    note: 'Rapid Strike Urshifu evolves from event-research Kubfu; no independent ordinary GO route.',
    sourceUrl: 'https://pokemongo.com/news/final-strike-2025?hl=en',
  },
  eternatus: {
    note: 'Eternatus was a limited GO Pass: Max Finale reward; Eternamax battles did not award an encounter.',
    sourceUrl: 'https://pokemongo.com/gofestmaxfinale',
  },
  zarude: {
    note: 'Zarude requires Search for Zarude or Rogue of the Jungle research claimed during their events.',
    sourceUrl: 'https://pokemongo.com/news/verdant-wonders-2024',
  },
  zeraora: {
    note: 'Zeraora requires GO Fest 2026 event research; no permanent research or recurring raid route established.',
    sourceUrl: 'https://bulbapedia.bulbagarden.net/wiki/Mythical_Pok%C3%A9mon#Pokémon_GO',
  },
}
