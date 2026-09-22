import { describe, expect, it } from 'vitest'
import { parseSerebiiCatalog, parseSerebiiPage } from './serebii.ts'

describe('Serebii location catalog', () => {
  it('rejects a missing catalog instead of silently importing a partial list', () => {
    expect(() => parseSerebiiCatalog('<h1>Temporarily unavailable</h1>')).toThrow(
      'no location entries',
    )
  })
  it('reads and deduplicates location options, retaining unknown regions for review', () => {
    const entries = parseSerebiiCatalog(`
      <select>
        <option value="/pokearth/index.shtml">Pokéarth</option>
        <option value="/pokearth/kanto/index.shtml">Pokéarth: Kanto</option>
        <option value="/pokearth/kanto/route1.shtml">Route 1</option>
        <option value="/pokearth/kanto/route1.shtml">Route 1</option>
        <option value="/pokearth/kitakami/applehills.shtml">Apple Hills</option>
        <option value="/pokearth/terarium/coastalbiome.shtml">Coastal Biome</option>
        <option value="/pokearth/lumiosecity/wildzone1.shtml">Wild Zone 1</option>
        <option value="/pokearth/fiore/fallcity.shtml">Fall City</option>
        <option value="https://example.com/pokearth/kanto/fake.shtml">Fake</option>
      </select>
      <a href="/pokearth/kanto/route2.shtml">Route 2</a>
    `)
    expect(entries.map(({ name, region }) => ({ name, region }))).toEqual([
      { name: 'Route 1', region: 'kanto' },
      { name: 'Apple Hills', region: 'kitakami' },
      { name: 'Coastal Biome', region: 'unova' },
      { name: 'Wild Zone 1', region: 'kalos' },
      { name: 'Fall City', region: 'fiore' },
    ])
    expect(entries[0]).toEqual({
      source: 'serebii',
      sourceId: '/pokearth/kanto/route1.shtml',
      url: 'https://www.serebii.net/pokearth/kanto/route1.shtml',
      name: 'Route 1',
      region: 'kanto',
      games: [],
      pokeApiId: null,
      pages: ['https://www.serebii.net/pokearth/kanto/route1.shtml'],
    })
  })
})

describe('Serebii location page editions', () => {
  it('reads the legacy content cell without using sidebar game headings', () => {
    const page = parseSerebiiPage(
      `<table><tr>
      <td width="1%"><h2>Legends: Z-A</h2></td>
      <td width="99%"><font><table class="tab"><tr><td>Team Flare HQ</td></tr></table>
      <table><tr><td class="x">Pokémon X</td><td class="y">Pokémon Y</td></tr></table>
      </font></td></tr></table>`,
      'https://www.serebii.net/pokearth/kalos/teamflarehq.shtml',
    )
    expect(page.games).toEqual(['xy-x', 'xy-y'])
  })

  it('uses visible version labels instead of metadata keywords or reused palette classes', () => {
    const page = parseSerebiiPage(
      `
      <meta name="keywords" content="Red, Blue, Yellow, Gold, Silver, Crystal, FireRed, LeafGreen">
      <nav><h3>Scarlet / Violet</h3></nav>
      <main>
        <table class="anctab"><tr><td>Game Anchors</td></tr><tr>
          <td class="sapphire"><a href="/pokearth/kanto/1st/oneisland.shtml">Gen I</a></td>
        </tr></table>
        <table><tr><td class="firered">Pokémon FireRed</td></tr>
        <tr><td class="leafgreen">Pokémon LeafGreen</td></tr></table>
        <a href="/pokedex-sv/001.shtml">Pokémon Scarlet</a>
      </main>`,
      'https://www.serebii.net/pokearth/kanto/oneisland.shtml',
    )
    expect(page.games).toEqual(['frlg-fr', 'frlg-lg'])
    expect(
      parseSerebiiPage(
        '<main><table><tr><td class="ruby">Pokémon Omega Ruby</td><td class="col">Pokémon XD</td></tr></table></main>',
        'https://www.serebii.net/pokearth/hoenn/seamauville.shtml',
      ).games,
    ).toEqual(['oras-or'])
    expect(
      parseSerebiiPage(
        '<main><table><tr><td class="col">Pokémon XD</td></tr></table></main>',
        'https://www.serebii.net/pokearth/orre/cavepokespot.shtml',
      ).games,
    ).toEqual(['xd'])
  })

  it('returns only linked edition pages of the same location without inferring generation games', () => {
    const page = parseSerebiiPage(
      `<main>
      <table class="anctab"><tr><td>Game Anchors</td></tr><tr>
        <td class="eevee"><a href="#">Let's Go</a></td>
        <td class="heartgold"><a href="/pokearth/kanto/4th/route1.shtml">Gen IV</a></td>
        <td><a href="/pokearth/kanto/3rd/route1.shtml">Gen III</a></td>
        <td><a href="/pokearth/johto/route1.shtml">Other region</a></td>
        <td><a href="/pokearth/kanto/route2.shtml">Other location</a></td>
      </tr></table>
      <table class="anctab"><tr><td>Area Anchors</td><td><a href="/pokearth/kanto/2nd/route1.shtml">Other</a></td></tr></table>
      <table><tr><td class="lgpika">Pokémon: Let's Go, Pikachu!</td></tr>
      <tr><td class="lgeevee">Pokémon: Let's Go, Eevee!</td></tr></table>
    </main>`.replace(/>\s+</g, '><'),
      'https://www.serebii.net/pokearth/kanto/route1.shtml',
    )
    expect(page).toEqual({
      games: ['lgpe-lgp', 'lgpe-lge'],
      pages: [
        'https://www.serebii.net/pokearth/kanto/4th/route1.shtml',
        'https://www.serebii.net/pokearth/kanto/3rd/route1.shtml',
      ],
    })
  })

  it('uses explicit location descriptions for locations without encounter tables', () => {
    expect(
      parseSerebiiPage(
        `<meta name="description" content="Route 1 in the Kalos Region in Pokémon X &amp; Y. Details all available Pokémon, Trainers and Items"><main><table class="tab"><tr><td>Route 1 is a direct path.</td></tr></table></main>`,
        'https://www.serebii.net/pokearth/kalos/route1.shtml',
      ).games,
    ).toEqual(['xy-x', 'xy-y'])
    expect(
      parseSerebiiPage(
        `<meta name="keywords" content="Scarlet, Violet"><meta name="description" content="Wild Zone 1 in the Lumiose City Region in Pokémon Legends: Z-A. Details all available Pokémon, Trainers and Items"><main><h3>Legends: Z-A</h3></main>`,
        'https://www.serebii.net/pokearth/lumiosecity/wildzone1.shtml',
      ).games,
    ).toEqual(['lza'])
  })

  it('respects original version exclusivity despite shared trainer headings and metadata', () => {
    const page = parseSerebiiPage(
      `<meta name="description" content="White Forest in the Unova Region in Pokémon Black &amp; White. Details all available Pokémon, Trainers and Items"><main>
      <table class="tab"><tr><td>White Forest is an area that only exists in Pokémon White. In White 2, the area has been augmented by the White Treehollow.</td></tr></table>
      <p><font><b>Black &amp; White</b></font></p>
      <p><font><b>Black 2 &amp; White 2</b></font></p>
    </main>`,
      'https://www.serebii.net/pokearth/unova/whiteforest.shtml',
    )
    expect(page.games).toEqual(['bw-w', 'b2w2-b2', 'b2w2-w2'])
  })

  it('reads trainer-only game headings, leaving ambiguous pages unresolved', () => {
    expect(
      parseSerebiiPage(
        '<main><h2>XD</h2><h3>Trainers</h3></main>',
        'https://www.serebii.net/pokearth/orre/cavepokespot.shtml',
      ).games,
    ).toEqual(['xd'])
    expect(
      parseSerebiiPage(
        '<main><p><font><b>Let’s Go, Pikachu! &amp; Eevee!</b></font></p></main>',
        'https://www.serebii.net/pokearth/kanto/pallettown.shtml',
      ).games,
    ).toEqual(['lgpe-lgp', 'lgpe-lge'])
    expect(
      parseSerebiiPage(
        '<main><p>No Pokémon found here.</p></main>',
        'https://www.serebii.net/pokearth/kanto/4th/route1.shtml',
      ),
    ).toEqual({ games: [], pages: [] })
    expect(() =>
      parseSerebiiPage(
        '<nav><h2>XD</h2></nav>',
        'https://www.serebii.net/pokearth/orre/cavepokespot.shtml',
      ),
    ).toThrow('no main content')
  })

  it('uses only active explicit Game Anchors and game-labelled location map images', () => {
    expect(
      parseSerebiiPage(
        `<main><table class="anctab"><tr><td>Game Anchors</td></tr><tr>
      <td><a href="#">Let's Go</a></td>
      <td><a href="/pokearth/kanto/3rd/silphco.shtml">Gen III</a></td>
    </tr></table></main>`,
        'https://www.serebii.net/pokearth/kanto/silphco.shtml',
      ).games,
    ).toEqual(['lgpe-lgp', 'lgpe-lge'])
    expect(
      parseSerebiiPage(
        `<main><table class="tab"><tr><td class="picturetd">
      <a href="/pokearth/maps/hoenn-em/83.png"><img src="/pokearth/maps/hoenn-th/83.png"></a>
    </td></tr></table><a href="/platinum/battletower.shtml">Related facility</a>
    <img src="/pokearth/maps/johto-hgss/53.png"></main>`,
        'https://www.serebii.net/pokearth/hoenn/trainerhill.shtml',
      ).games,
    ).toEqual(['e'])
    expect(
      parseSerebiiPage(
        `<main><table><tr><td class="picturetd">
      <img src="/pokearth/maps/johto-hgss/62.png">
    </td></tr></table></main>`,
        'https://www.serebii.net/pokearth/johto/bellchimetrail.shtml',
      ).games,
    ).toEqual(['hgss-hg', 'hgss-ss'])
  })

  it('reads edition-specific item and shop headings without trusting generic Unova descriptions', () => {
    const meta =
      '<meta name="description" content="Join Avenue in the Unova Region in Pokémon Black, White, Black 2 &amp; White 2. Details all available Pokémon, Trainers and Items">'
    expect(
      parseSerebiiPage(
        `${meta}<main>
      <p><font><b>Items - Black 2 &amp; White 2</b></font></p>
      <p><font><b>Shops - Black 2 &amp; White 2</b></font></p>
    </main>`,
        'https://www.serebii.net/pokearth/unova/joinavenue.shtml',
      ).games,
    ).toEqual(['b2w2-b2', 'b2w2-w2'])
    expect(
      parseSerebiiPage(
        `${meta}<main><table><tr><td class="picturetd"><img src="/pokearth/maps/unova/75.png"></td></tr></table></main>`,
        'https://www.serebii.net/pokearth/unova/caveofbeing.shtml',
      ).games,
    ).toEqual([])
  })

  it('rejects copied metadata across regions and prefers concrete edition evidence within a region', () => {
    const copied =
      '<meta name="description" content="Grand Lake Hotel in the Sinnoh Region in Pokémon Sword &amp; Shield. Details all available Pokémon, Trainers and Items">'
    expect(
      parseSerebiiPage(
        `${copied}<main><h3>Sword / Shield</h3><h3>Items - Sword &amp; Shield</h3></main>`,
        'https://www.serebii.net/pokearth/sinnoh/grandlakehotel.shtml',
      ).games,
    ).toEqual([])
    expect(
      parseSerebiiPage(
        `${copied}<main><table><tr><td class="diamond">Pokémon Diamond</td></tr></table></main>`,
        'https://www.serebii.net/pokearth/sinnoh/grandlakehotel.shtml',
      ).games,
    ).toEqual(['dp-d'])
    expect(
      parseSerebiiPage(
        `<meta name="description" content="Distortion World in the Sinnoh Region in  Pokémon Brilliant Diamond &amp; Shining Pearl. Details all available Pokémon, Trainers and Items">
      <main><table><tr><td class="picturetd"><img src="/pokearth/maps/sinnoh-pt/82.png"></td></tr></table></main>`,
        'https://www.serebii.net/pokearth/sinnoh/distortionworld.shtml',
      ).games,
    ).toEqual(['pt'])
  })
})
