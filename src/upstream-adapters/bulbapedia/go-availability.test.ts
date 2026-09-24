import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  availabilityJson,
  createAvailabilityReport,
  type AvailabilityGame,
  type AvailabilityPokemon,
} from './availability.ts'
import { parseGoAvailability, resolveGoAvailability } from './go-availability.ts'

const pokemon = (id: string): AvailabilityPokemon =>
  JSON.parse(readFileSync(new URL(`../../../data/pokemon/${id}.json`, import.meta.url), 'utf8'))
const image = (sprite: string, species?: string) => {
  const img = `<img src="https://archives.bulbagarden.net/media/upload/thumb/a/ab/${sprite}/60px-${sprite}" alt="${species ?? 'Pokémon'}">`
  return species
    ? `<a href="/wiki/${encodeURIComponent(species)}_(Pok%C3%A9mon)#Pokémon_GO">${img}</a>`
    : img
}
const release = (images: string, date = 'Jul 6, 2016', notes = '') =>
  `<tr><td>${date}</td><td>${images}</td><td>${notes}</td></tr>`
const table = (rows: string, column = 'Pokémon') =>
  `<table><tr><th>Date</th><th>${column}</th><th>Notes</th></tr>${rows}</table>`
const page = (rows: string, rest = '') =>
  `<h1 id="firstHeading">List of Pokémon by availability in Pokémon GO</h1>
   <h2>List of Pokémon by date</h2>${table(rows)}${rest}`
const unreleasedTable = (images: string, column = 'Pokémon') =>
  `<table><tr><th>Generation</th><th>Total</th><th>${column}</th></tr>
   <tr><th>IX</th><td>1</td><td>${images}</td></tr></table>`
const parse = (html: string) => parseGoAvailability(html, '2026-09-22T00:00:00Z')
const resolve = (html: string, id: string, parent?: string) =>
  resolveGoAvailability(parse(html), pokemon(id), [
    pokemon(id),
    ...(parent ? [pokemon(parent)] : []),
  ])

describe('GO availability lists', () => {
  it.each([
    ['cosmog', 'GO0789.png'],
    ['cosmoem', 'GO0790.png'],
    ['kubfu', 'GO0891.png'],
    ['urshifu', 'GO0892.png'],
    ['urshifu-rapid-strike', 'GO0892R.png'],
    ['eternatus', 'GO0890.png'],
    ['zarude', 'GO0893.png'],
    ['zeraora', 'GO0807.png'],
  ])(
    'retains the researched event gate for released %s in reports and patch candidates',
    (id, sprite) => {
      const saved = pokemon(id)
      const go: AvailabilityGame = JSON.parse(
        readFileSync(new URL('../../../data/games/go.json', import.meta.url), 'utf8'),
      )
      const parsed = parse(page(release(image(sprite), 'Jul 11, 2026', 'Event debut.')))
      // Simulate the old parser's ordinary classification to prove the candidate corrects it.
      const input = {
        ...saved,
        obtainableIn: [...saved.obtainableIn.filter((game) => game !== 'go'), 'go'],
        eventOnlyIn: saved.eventOnlyIn.filter((game) => game !== 'go'),
      }
      const report = createAvailabilityReport({ go: parsed, gameIds: new Set(['go']) }, input, [go])
      expect(report.rows[0]).toMatchObject({
        status: 'eventOnlyIn',
        basis: 'rule',
        methods: [{ sourceUrl: expect.stringMatching(/^https:/), note: expect.any(String) }],
      })
      const candidate = availabilityJson(report)
      expect(candidate.obtainableIn).toEqual(saved.obtainableIn)
      expect(candidate.eventOnlyIn).toEqual(expect.arrayContaining(saved.eventOnlyIn))
      expect(candidate.eventOnlyIn).toContain('go')
      expect(candidate.transferOnlyIn).toEqual(saved.transferOnlyIn)
      expect(candidate.storableIn).toEqual(saved.storableIn)
      expect(saved.eventOnlyIn).toContain('go')
      expect(saved.obtainableIn).not.toContain('go')
    },
  )

  it('does not let an event rule establish release or override uncertain source evidence', () => {
    const released = release(image('GO0807.png'), 'May 29, 2026')
    expect(
      resolveGoAvailability(
        parseGoAvailability(page(released), '2026-05-28'),
        pokemon('zeraora'),
        [],
      )?.status,
    ).toBe('unavailable')
    expect(resolve(page(release(image('GO0807.png'), 'TBA 2026')), 'zeraora')?.status).toBe(
      'unavailable',
    )
    expect(resolve(page(release(image('GO0807.png'), 'Unknown date')), 'zeraora')?.status).toBe(
      'unknown',
    )
    expect(resolve(page(release(image('GO0001.png'))), 'zeraora')).toBeUndefined()
    const explicitlyUnreleased = `<h3>Unreleased Pokémon</h3><p>The following species have yet to become available:</p>${unreleasedTable(image('Menu_HOME_0807.png'))}`
    expect(
      resolve(page(release(image('GO0001.png')), explicitlyUnreleased), 'zeraora')?.status,
    ).toBe('unavailable')
    expect(resolve(page(released, explicitlyUnreleased), 'zeraora')?.status).toBe('unknown')
    expect(resolve(page(released), 'zeraora-mega')).toBeUndefined()
    expect(resolve(page(release(image('GO0893.png'))), 'zarude-dada')).toBeUndefined()
  })

  it.each([
    ['mew', 'GO0151.png'],
    ['celebi', 'GO0251.png'],
    ['jirachi', 'GO0385.png'],
    ['shaymin', 'GO0492.png'],
    ['shaymin-sky', 'GO0492S.png'],
    ['victini', 'GO0494.png'],
    ['keldeo', 'GO0647.png'],
    ['keldeo-resolute', 'GO0647R.png'],
    ['meloetta', 'GO0648.png'],
    ['diancie', 'GO0719.png'],
    ['diancie-mega', 'GO0719M.png'],
    ['hoopa', 'GO0720.png'],
    ['hoopa-unbound', 'GO0720U.png'],
    ['volcanion', 'GO0721.png'],
    ['marshadow', 'GO0802.png'],
    ['solgaleo', 'GO0791.png'],
    ['lunala', 'GO0792.png'],
    ['necrozma-dusk-mane', 'GO0800DM.png'],
    ['necrozma-dawn-wings', 'GO0800DW.png'],
    ['kyurem-black', 'GO0646B.png'],
    ['kyurem-white', 'GO0646W.png'],
    ['zacian-crowned', 'GO0888C.png'],
    ['zamazenta-crowned', 'GO0889C.png'],
    ['enamorus-therian', 'GO0905T.png'],
    ['mewtwo-mega-x', 'GO0150MX.png'],
    ['mewtwo-mega-y', 'GO0150MY.png'],
    ['rayquaza-mega', 'GO0384M.png'],
    ['zygarde-10', 'GO0718T.png'],
    ['zygarde', 'GO0718.png'],
    ['zygarde-complete', 'GO0718C.png'],
  ])('keeps %s ordinary despite an event debut or an event-only relative', (id, sprite) => {
    expect(
      resolve(page(release(image(sprite), 'Jul 11, 2026', 'GO Fest event debut.')), id)?.status,
    ).toBe('obtainableIn')
    expect(pokemon(id).obtainableIn).toContain('go')
    expect(pokemon(id).eventOnlyIn).not.toContain('go')
  })

  it('aliases only the researched shared GO identities, while exact entries take precedence', () => {
    const parsed = parse(
      page(release(image('GO0716.png', 'Xerneas') + image('GO0849L.png', 'Toxtricity'))),
    )
    expect(resolveGoAvailability(parsed, pokemon('xerneas-active'), [])).toMatchObject({
      status: 'obtainableIn',
      note: expect.stringContaining('shared GO form identity'),
    })
    expect(resolveGoAvailability(parsed, pokemon('toxtricity-low-key-gmax'), [])).toBeUndefined()
    parsed.entries.push({
      dexNum: 716,
      sprite: 'exact.png',
      form: 'active',
      speciesWide: false,
      status: 'unavailable',
      text: 'GO: explicitly unreleased',
    })
    expect(resolveGoAvailability(parsed, pokemon('xerneas-active'), [])?.status).toBe('unavailable')
  })

  it('uses historical releases, including event releases, and ignores other page tables', () => {
    const html = page(
      release(image('GO0001.png', 'Bulbasaur'), 'Jul 6, 2016', 'Event research reward.'),
      `<h2>Region-exclusive Pokémon</h2>${table(release(image('GO0006.png', 'Charizard')))}`,
    )
    expect(resolve(html, 'bulbasaur')).toMatchObject({
      status: 'obtainableIn',
      text: expect.stringContaining('Event research reward'),
    })
    expect(resolve(html, 'charizard')).toBeUndefined()
  })

  it('identifies letter and regional forms without assigning the species to every form', () => {
    const html = page(release(image('GO0201B.png', 'Unown') + image('GO0037A.png', 'Vulpix')))
    expect(resolve(html, 'unown-b')?.status).toBe('obtainableIn')
    expect(resolve(html, 'unown')).toBeUndefined()
    expect(resolve(html, 'unown-c')).toBeUndefined()
    expect(resolve(html, 'vulpix-alola')?.status).toBe('obtainableIn')
    expect(resolve(html, 'vulpix')).toBeUndefined()
  })

  it('distinguishes Nidoran species even though their only name difference is the gender symbol', () => {
    const html = page(release(image('GO0029.png', 'Nidoran♀')))
    expect(resolve(html, 'nidoranf')?.status).toBe('obtainableIn')
    expect(resolve(html, 'nidoranm')).toBeUndefined()
  })

  it('maps GO defaults that differ from the dataset default and from HOME menu icons', () => {
    const html = page(
      release(image('GO0666.png', 'Vivillon') + image('GO0999.png', 'Gimmighoul')),
      `<h3>Unreleased Pokémon</h3><p>The following forms have yet to be made available:</p>${unreleasedTable(image('Menu_HOME_0999.png', 'Gimmighoul'))}`,
    )
    expect(resolve(html, 'vivillon-meadow')?.status).toBe('obtainableIn')
    expect(resolve(html, 'vivillon')).toBeUndefined()
    expect(resolve(html, 'gimmighoul-roaming')?.status).toBe('obtainableIn')
    expect(resolve(html, 'gimmighoul')?.status).toBe('unavailable')
  })

  it('inherits only cosmetic female forms and respects explicit female entries', () => {
    const html = page(
      release(image('GO0003.png', 'Venusaur') + image('GO0678.png', 'Meowstic')),
      `<h3>Unreleased Pokémon</h3><p>The following forms have yet to be made available:</p>${unreleasedTable(image('GO0003_f.png', 'Venusaur'))}`,
    )
    expect(resolve(html, 'venusaur-f', 'venusaur')?.status).toBe('unavailable')
    const baseOnly = page(
      release(image('GO0003.png', 'Venusaur') + image('GO0678.png', 'Meowstic')),
    )
    expect(resolve(baseOnly, 'venusaur-f', 'venusaur')?.status).toBe('obtainableIn')
    expect(resolve(baseOnly, 'meowstic-f', 'meowstic')).toBeUndefined()
    expect(resolve(page(release(image('GO0678_f.png', 'Meowstic'))), 'meowstic-f')?.status).toBe(
      'obtainableIn',
    )
  })

  it('applies explicit unreleased species to all forms but scopes unreleased form entries exactly', () => {
    const html = page(
      release(image('GO0001.png', 'Bulbasaur')),
      `<h3>Unreleased Pokémon</h3><p>The following species have yet to become available:</p>${unreleasedTable(image('Menu_HOME_0869.png', 'Alcremie'))}
       <p>Some Pokémon have additional forms. The following forms have yet to be made available:</p>${unreleasedTable(image('GO0555GZ.png', 'Darmanitan'))}`,
    )
    expect(resolve(html, 'alcremie-ruby-swirl-ribbon')?.status).toBe('unavailable')
    expect(resolve(html, 'alcremie-gmax')?.status).toBe('unavailable')
    expect(resolve(html, 'darmanitan-galar-zen')?.status).toBe('unavailable')
    expect(resolve(html, 'darmanitan-galar')).toBeUndefined()
  })

  it('parses transformations, fusions and Gigantamax separately from the ordinary forms', () => {
    const html = page(
      release(image('GO0001.png', 'Bulbasaur')),
      `<h3>Mega Evolution and Primal Reversion</h3>${table(release(image('GO0006MX.png', 'Charizard')), 'Transformation')}
       <p>The following Mega Evolutions have yet to be released:</p>${unreleasedTable(image('HOME0670M.png', 'Floette'))}
       <h3>Fusions</h3>${table(release(image('GO0800DM.png', 'Necrozma')), 'Fusion')}
       <p>The following Fusions have yet to be released:</p>${unreleasedTable(image('Menu_HOME_0898-Ice_Rider.png', 'Calyrex'))}
       <h3>Gigantamax</h3>${table(release(image('GO0849GMax.png', 'Toxtricity')), 'Gigantamax')}`,
    )
    expect(resolve(html, 'charizard-mega-x')?.status).toBe('obtainableIn')
    expect(resolve(html, 'charizard')).toBeUndefined()
    expect(resolve(html, 'floette-eternal-mega')?.status).toBe('unavailable')
    expect(resolve(html, 'necrozma-dusk-mane')?.status).toBe('obtainableIn')
    expect(resolve(html, 'calyrex-ice')?.status).toBe('unavailable')
    expect(resolve(html, 'toxtricity-gmax')?.status).toBe('obtainableIn')
    expect(resolve(html, 'toxtricity-low-key-gmax')?.status).toBe('obtainableIn')
  })

  it('uses linked species names when the page reuses an identical form image', () => {
    const html = page(
      release(image('GO0001.png', 'Bulbasaur')),
      `<h3>Gigantamax</h3><p>The following Gigantamax forms have yet to be released:</p>${unreleasedTable(image('HOME0841Gi.png', 'Flapple') + image('HOME0841Gi.png', 'Appletun'))}`,
    )
    expect(resolve(html, 'flapple-gmax')?.status).toBe('unavailable')
    expect(resolve(html, 'appletun-gmax')?.status).toBe('unavailable')
  })

  it('distinguishes released Mega forms from their explicitly unreleased Z transformations', () => {
    const html = page(
      release(
        image('GO0359.png', 'Absol') +
          image('GO0445.png', 'Garchomp') +
          image('GO0448.png', 'Lucario'),
      ),
      `<h3>Mega Evolution and Primal Reversion</h3>
       <p>The following Pokémon transformations are currently available:</p>
       ${table(
         release(
           image('GO0359M.png', 'Absol'),
           'Oct 22, 2021',
           'Mega Absol was released for the Halloween 2021 event.',
         ) +
           release(
             image('GO0445M.png', 'Garchomp'),
             'Nov 11, 2023',
             'Mega Garchomp was released for Mega Garchomp Raid Day.',
           ) +
           release(
             image('GO0448M.png', 'Lucario'),
             'Jul 27, 2024',
             'Mega Lucario was released for Mega Lucario Raid Day.',
           ),
         'Transformation',
       )}
       <p>The following Mega Evolutions have yet to be released:</p>
       ${unreleasedTable(image('HOME0359MZ.png', 'Absol') + image('HOME0445MZ.png', 'Garchomp') + image('HOME0448MZ.png', 'Lucario'), 'Mega Evolution')}`,
    )
    for (const species of ['absol', 'garchomp', 'lucario']) {
      expect(resolve(html, `${species}-mega`)?.status).toBe('obtainableIn')
      expect(resolve(html, `${species}-mega-z`)?.status).toBe('unavailable')
    }
  })

  it('keeps compound Mega identities distinct in the unreleased transformation table', () => {
    const html = page(
      release(
        image('GO0670.png', 'Floette') +
          image('GO0718.png', 'Zygarde') +
          image('GO0978.png', 'Tatsugiri'),
      ),
      `<h3>Mega Evolution and Primal Reversion</h3>
       <p>The following Mega Evolutions have yet to be released:</p>
       ${unreleasedTable(
         image('HOME0670M.png', 'Floette') +
           image('HOME0718M.png', 'Zygarde') +
           image('HOME0801M.png', 'Magearna') +
           image('HOME0801MO.png', 'Magearna') +
           image('HOME0978M.png', 'Tatsugiri') +
           image('HOME0978DM.png', 'Tatsugiri') +
           image('HOME0978SM.png', 'Tatsugiri'),
         'Mega Evolution',
       )}`,
    )
    for (const id of [
      'floette-eternal-mega',
      'zygarde-complete-mega',
      'magearna-mega',
      'magearna-original-mega',
      'tatsugiri-mega',
      'tatsugiri-droopy-mega',
      'tatsugiri-stretchy-mega',
    ])
      expect(resolve(html, id)?.status, id).toBe('unavailable')
    expect(resolve(html, 'floette-eternal')).toBeUndefined()
    expect(resolve(html, 'zygarde-complete')).toBeUndefined()
    expect(resolve(html, 'tatsugiri-droopy')).toBeUndefined()
    expect(resolve(html, 'magearna-original')).toBeUndefined()
  })

  it('uses transformation release dates for Primal, Mega X/Y and announced transformations', () => {
    const html = page(
      release(
        image('GO0382.png', 'Kyogre') +
          image('GO0383.png', 'Groudon') +
          image('GO0026.png', 'Raichu') +
          image('GO0609.png', 'Chandelure'),
      ),
      `<h3>Mega Evolution and Primal Reversion</h3>
       <p>The following Pokémon transformations are currently available:</p>
       ${table(
         release(
           image('GO0382P.png', 'Kyogre') + image('GO0383P.png', 'Groudon'),
           'Feb 18, 2023',
           'Primal Kyogre and Groudon were released for Pokémon GO Tour: Hoenn.',
         ) +
           release(
             image('GO0026MX.png', 'Raichu') + image('GO0026MY.png', 'Raichu'),
             'Jul 18, 2026',
             'Mega Raichu X and Y were released for Raichu Super Mega Raid Day.',
           ) +
           release(
             image('GO0609M.png', 'Chandelure'),
             'TBA 2026',
             'Mega Chandelure will be released during the Twilight Trails season.',
           ),
         'Transformation',
       )}`,
    )
    for (const id of ['kyogre-primal', 'groudon-primal', 'raichu-mega-x', 'raichu-mega-y'])
      expect(resolve(html, id)?.status, id).toBe('obtainableIn')
    const beforeRelease = parseGoAvailability(html, '2026-07-17')
    for (const id of ['raichu-mega-x', 'raichu-mega-y'])
      expect(resolveGoAvailability(beforeRelease, pokemon(id), [])?.status, id).toBe('unavailable')
    expect(resolve(html, 'chandelure')?.status).toBe('obtainableIn')
    expect(resolve(html, 'chandelure-mega')).toMatchObject({
      status: 'unavailable',
      note: 'Announced release date is not yet known.',
    })
  })

  it('does not infer a Gigantamax variant from an ordinary form release', () => {
    const html = page(
      release(
        image('GO0849L.png', 'Toxtricity') + image('GO0849A.png', 'Toxtricity'),
        'Nov 16, 2024',
        'Both forms of Toxtricity debuted during the Pokémon GO Wild Area. Toxel also debuted in 10 km Eggs.',
      ) +
        release(
          image('GO0892.png', 'Urshifu') + image('GO0892R.png', 'Urshifu'),
          'May 21, 2025',
          'Both forms of Urshifu could now evolve from Kubfu.',
        ),
      `<h3>Gigantamax</h3>
       <p>The following Gigantamax Pokémon are currently available:</p>
       ${table(release(image('GO0849GMax.png', 'Toxtricity'), 'Nov 16, 2024', 'Gigantamax Toxtricity was released during the GO Wild Area event.'), 'Gigantamax')}
       <p>The following Gigantamax forms have yet to be released:</p>
       ${unreleasedTable(image('GO0892GMax.png', 'Urshifu') + image('GO0892RGMax.png', 'Urshifu'), 'Gigantamax')}`,
    )
    expect(resolve(html, 'toxtricity')?.status).toBe('obtainableIn')
    expect(resolve(html, 'toxtricity-low-key')?.status).toBe('obtainableIn')
    expect(resolve(html, 'toxtricity-gmax')?.status).toBe('obtainableIn')
    expect(resolve(html, 'toxtricity-low-key-gmax')?.status).toBe('obtainableIn')
    expect(resolve(html, 'urshifu')?.status).toBe('eventOnlyIn')
    expect(resolve(html, 'urshifu-rapid-strike')?.status).toBe('eventOnlyIn')
    expect(resolve(html, 'urshifu-gmax')?.status).toBe('unavailable')
    expect(resolve(html, 'urshifu-rapid-strike-gmax')?.status).toBe('unavailable')
  })

  it('handles future dates and TBA without treating them as completed releases', () => {
    const html = page(
      release(image('GO0001.png'), 'Nov 6, 2026') +
        release(image('GO0002.png'), 'TBA 2026') +
        release(image('GO0003.png'), 'Feb 31, 2026'),
    )
    expect(resolve(html, 'bulbasaur')?.status).toBe('unavailable')
    expect(resolve(html, 'ivysaur')?.status).toBe('unavailable')
    expect(resolve(html, 'venusaur')?.status).toBe('unknown')
    expect(parse(html).warnings).toEqual(['Unrecognized GO release date: Feb 31, 2026.'])
    expect(
      resolveGoAvailability(parseGoAvailability(html, '2026-11-06'), pokemon('bulbasaur'), [])
        ?.status,
    ).toBe('obtainableIn')
  })

  it('keeps previous releases available and rejects source contradictions', () => {
    const html = page(
      release(image('GO0001.png'), 'Jul 6, 2016') + release(image('GO0001.png'), 'Nov 6, 2026'),
    )
    expect(resolve(html, 'bulbasaur')?.status).toBe('obtainableIn')
    const conflicting = `${html}<h3>Unreleased Pokémon</h3><p>The following species have yet to become available:</p>${unreleasedTable(image('Menu_HOME_0001.png'))}`
    expect(resolve(conflicting, 'bulbasaur')?.status).toBe('unknown')
  })

  it('uses an explicit all-sizes statement only for the species it names', () => {
    const html = page(
      release(
        image('GO0710.png', 'Pumpkaboo') + image('GO0711.png', 'Gourgeist'),
        'Oct 22, 2021',
        'Phantump and all sizes of Pumpkaboo debuted in the wild and Raid Battles.',
      ),
    )
    expect(resolve(html, 'pumpkaboo-super')?.status).toBe('obtainableIn')
    expect(resolve(html, 'gourgeist-super')).toBeUndefined()
  })

  it('leaves unknown forms unresolved, warns about image changes, and rejects invalid pages', () => {
    const html = page(release(image('GO0003Unexpected.png') + image('Other0006.png')))
    expect(resolve(html, 'venusaur')).toBeUndefined()
    expect(resolve(html, 'charizard')).toBeUndefined()
    expect(parse(html).warnings).toHaveLength(2)
    expect(() => parse('<h1>Access denied</h1>')).toThrow('No GO release tables found')
    expect(() => parse('<h1 id="firstHeading">Other page</h1>')).toThrow(
      'Unexpected GO availability page title',
    )
  })
})
