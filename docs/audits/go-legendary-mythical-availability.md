# GO legendary and mythical acquisition audit

Reviewed **2026-09-24** against the
[canonical availability definitions](../pokemon-availability.md). Scope: all 188 dataset records
marked `isLegendary` or `isMythical`, including their exact forms (128 legendary, 60 mythical). Of
these, 111 have a released GO acquisition route. The resulting classification is 103 ordinary and
eight event-only records; the other 77 retain no GO acquisition. Ultra Beasts without either flag,
costumes absent from the dataset, storage and shiny fields are outside this change.

The [GO release and raid tables][go-list] establish release and recurring raid history. Official
event/research announcements below establish the acquisition gates. Supplemental route inventories
help check for later alternatives; a debut announcement alone cannot establish ongoing exclusivity.
These are reviewed classifications, not predictions about future events or today's spawn calendar.

## Event-only records

Seven records move `go` from `obtainableIn` to `eventOnlyIn`. Zeraora was already corrected and is
included in the parser rule without modifying its data file.

| Exact records                              | Established gate and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cosmog`, `cosmoem`                        | Cosmog's research must be claimed during an event/season; Cosmoem only evolves from Cosmog. [Starry Skies](https://pokemongo.com/news/solstice-horizons) had a June 16–25, 2023 claim window, and [GO Fest 2024](https://pokemongo.com/news/gofest-fusion-2024) supplied another event research encounter. The current [Cosmog route inventory](https://www.serebii.net/pokemongo/pokemon/789.shtml) lists these research routes and A Cosmic Companion; [Cosmoem](https://www.serebii.net/pokemongo/pokemon/790.shtml) lists evolution. No permanent unlock or independent raid route was found for either record. |
| `kubfu`, `urshifu`, `urshifu-rapid-strike` | Kubfu came from limited-claim Might and Mastery or Fuzzy Fighter research. The [season announcement](https://pokemongo.com/seasons/might-and-mastery) describes both; [Final Strike](https://pokemongo.com/news/final-strike-2025?hl=en) gives the June 3, 2025 claim deadline and both Urshifu evolution requirements. The [Kubfu route inventory](https://www.serebii.net/pokemongo/pokemon/891.shtml) supplies no ordinary alternative. Both styles retain their prerequisite's event gate.                                                                                                                      |
| `eternatus`                                | [GO Pass: Max Finale](https://pokemongo.com/gofestmaxfinale) awarded the encounter, with rewards expiring August 26, 2025. Defeating Eternamax awarded Candy and Candy XL, not a catch. No later ordinary encounter route was established. Eternamax itself remains unavailable.                                                                                                                                                                                                                                                                                                                                    |
| `zarude`                                   | [Search for Zarude](https://pokemongo.com/news/oct-2021-events?hl=no) required logging in during the October 2021 movie event; [Rogue of the Jungle](https://pokemongo.com/news/verdant-wonders-2024) required purchasing and claiming research March 21–25, 2024. These are still the routes in the [Zarude inventory](https://www.serebii.net/pokemongo/pokemon/893.shtml). Dada Zarude does not inherit this GO release.                                                                                                                                                                                         |
| `zeraora`                                  | The [mythical route history][mythical] records GO Fest 2026 research, including the July 11–12 global claim opportunity. No permanent research or recurring raid route was established. Mega Zeraora does not inherit the base release.                                                                                                                                                                                                                                                                                                                                                                             |

Research remaining completable after its claim window closes does **not** remove the event gate.
Conversely, a permanent quest being one-time, lengthy or prerequisite-dependent does not make it
event-only. GO trading does not turn a researched event-exclusive native route into an ordinary one.

## Permanent research and other retained mythical routes

| Records retained in `obtainableIn`                        | Reason                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mew, Celebi, Jirachi, Victini, Aria Meloetta              | Permanent Special Research, documented in the [mythical route history][mythical]. Limited shiny research is a separate issue.                                                                                                                                                                    |
| Land and Sky Shaymin                                      | [Permanent Grass and Gratitude](https://pokemongo.com/news/shaymin-global-special-research) supplies Land Shaymin; the [form-change reference](https://www.serebii.net/pokemongo/formchange.shtml) establishes the Sky transformation.                                                           |
| Ordinary and Resolute Keldeo                              | [Final Justice](https://pokemongo.com/news/final-justice-2025) explicitly promises a replacement permanent route after the season. Hooves of a Hero supplies Keldeo and unlocks form change; the [research tasks](https://pokemongo.fandom.com/wiki/Hooves_of_a_Hero) include changing its form. |
| Diancie and Mega Diancie                                  | [Glitz and Glam](https://pokemongo.com/news/diancie-global-special-research?hl=en) is permanent; its [task rewards](https://www.serebii.net/pokemongo/events/glitzandglam.shtml) supply enough Mega Energy.                                                                                      |
| Marshadow                                                 | [A Striking Shadow](https://pokemongo.com/news/stunning-styles-2025?hl=en) became freely available April 3, 2025. Its GO Fest debut is no longer the only route.                                                                                                                                 |
| Volcanion                                                 | [Pressure Rising](https://pokemongo.com/seasons/memories-in-motion) became freely available March 3, 2026 after Glitz and Glam.                                                                                                                                                                  |
| Confined and Unbound Hoopa                                | [Hoopa Raid Day](https://pokemongo.com/news/hoopa-raid-day-2025) brought Unbound back to public five-star raids and removed the research prerequisite for changing either form.                                                                                                                  |
| Darkrai, all four Deoxys formes, all five Genesect drives | Recurring raids; exact-form raid histories appear in the [GO tables][go-list] and [mythical route history][mythical].                                                                                                                                                                            |
| Meltan, Melmetal                                          | Permanent Mystery Box/research and evolution routes; see the [mythical route history][mythical].                                                                                                                                                                                                 |

## Legendary forms that must not inherit event-only status

- **Solgaleo and Lunala** have independent five-star raid routes, including the official
  [Road of Legends 2026](https://pokemongo.com/news/road-of-legends-2026) roster. Cosmog's event
  gate does not apply to these catches. Individual Serebii obtaining-method summaries omit these
  newer raids, so they cannot be used alone to exclude them.
- **Dusk Mane and Dawn Wings Necrozma** have independently obtainable components and recurring raids
  that supply Fusion Energy. See
  [Fusion Raid Day](https://pokemongo.com/news/necrozma-fusion-raid-day-2024) and Road of
  Legends 2026. A defeated fusion yields Necrozma, not a directly caught fused Pokémon.
- **Black and White Kyurem** similarly use raid-acquired components and Fusion Energy; see
  [Kyurem Fusion Raid Day 2026](https://pokemongo.com/pl/news/kyurem-fusion-raid-day-2026).
- **Crowned Zacian and Zamazenta** use
  [raid-earned Crowned Energy](https://pokemongo.com/news/crowned-energy-resource-zacian-zamazenta)
  and Iron Head. Ticketed debut research is an alternative, not an exclusive prerequisite.
- **Both Enamorus forms** have public raid routes.
  [Therian Raid Day 2026](https://pokemongo.com/news/enamorus-therian-raid-day-2026?hl=en) and Road
  of Legends establish Therian's debut and return.
- **Mega Mewtwo X/Y** returned in public Super Mega Raids at the
  [September 2026 Mega Finale](https://pokemongo.com/gofest/megafinale); both stay ordinary.
- **Mega Rayquaza** requires a Meteorite, but these have also been rare raid-catch drops, documented
  in
  [GO Hub's mechanics review](https://pokemongohub.net/post/review/review-of-new-qol-updates-features-in-2023-so-far-pokemon-go/).
  Official announcements document guaranteed research alternatives
  ([2025 Raid Day](https://pokemongo.com/news/mega-rayquaza-raid-day-2025),
  [2026 Ozone Ascent](https://pokemongo.com/news/ozone-ascent-2026)). The rare-drop evidence is a
  community mechanics report rather than an official guarantee of today's drop rate.
- **All three Zygarde forms** retain permanent
  [Routes research and Cell collection](https://pokemongo.com/routes). Galarian birds retain Daily
  Adventure Incense routes; the remaining released legendary records retain their wild, recurring
  raid or supported transformation routes in the [GO tables][go-list].

Unreleased forms remain unchanged, including Dada Zarude, Pirouette Meloetta, Gigantamax Urshifu,
Gigantamax Melmetal and unreleased Mega forms. Missing exact-form source rows are not proof of
unavailability; the existing explicit form rules still apply.

## Maintenance

`go-event-availability.ts` lists the eight exact records. The resolver applies a rule only after the
GO table establishes release. Missing, future, explicitly unreleased and contradictory entries keep
their existing handling. Reports identify these decisions as rules with source links. Runtime
fetching remains limited to the two established Bulbapedia lists.

Revisit these exceptions when an announcement establishes permanent unlockable research or an
independent ordinary encounter route. Do not remove an event classification solely because old
research can still be completed, or add one solely because the debut happened at GO Fest.

## Validation

- Targeted GO resolver/report tests and Pokémon integrity checks: 8,114 tests passed.
- TypeScript `--noEmit` passed. Checks used installed local binaries because the pnpm launcher could
  not verify its configured release after a registry fetch failure.
- Offline comparison against the saved `.local/availability/go.html` source, evaluated as of
  September 24: all 188 scoped records had zero candidate membership differences. The table resolved
  103 ordinary, eight event-only and 75 unavailable records. Eternamax and Dada Zarude were the two
  missing identities; their researched no-GO classifications were preserved.
- A before/after comparison confirmed exactly seven data edits, limited to moving `go` between the
  two acquisition fields. Storage, shiny fields, other games, and Zeraora's working-tree and staged
  bytes were unchanged. This offline comparison validates parser consistency, while the linked
  research above establishes the event classifications.

[go-list]:
  https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO
[mythical]: https://bulbapedia.bulbagarden.net/wiki/Mythical_Pok%C3%A9mon#Pokémon_GO
