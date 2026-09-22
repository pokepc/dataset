import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Seed the real source readers; browser tests do not depend on live upstreams.
export function seedAvailabilityFixtures(cacheRoot) {
  function write(path, value) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(value))
  }
  function page(source, url, html) {
    const filename = createHash('sha256').update(url).digest('hex') + '.json'
    write(join(cacheRoot, source, filename), { version: 1, url, html })
  }
  page(
    'bulbapedia',
    'https://bulbapedia.bulbagarden.net/wiki/Zygarde_(Pok%C3%A9mon)',
    `
    <h1 id="firstHeading">Zygarde (Pokémon)</h1>
    <h3><span id="Game_locations">Game locations</span></h3>
    <table>
      <tr><th>Alpha Sapphire</th><td>Transfer from Pokémon Bank</td></tr>
      <tr><th>Ultra Moon</th><td>Event</td></tr>
      <tr><th>Sword</th><th>Shield</th><td>Trade</td></tr>
      <tr><th>The Crown Tundra</th><td><a href="/wiki/Dynamax_Adventure">Dynamax Adventures</a> <span title="50% Forme; changes form in battle">50% Forme</span></td></tr>
      <tr><th>Scarlet</th><th>Violet</th><td>Unobtainable</td></tr>
    </table>
    <h3><span id="Form_data">Form data</span></h3><p>Power Construct changes Zygarde's form during battle.</p>
  `,
  )
  for (const path of [
    'pokedex-xy/718.shtml',
    'pokedex-sm/718.shtml',
    'pokedex-swsh/zygarde/',
    'pokedex-sv/zygarde/',
  ]) {
    page(
      'serebii',
      `https://www.serebii.net/${path}`,
      `
      <title>Zygarde - #718 - Serebii.net Pokédex</title>
      <table><tr><td>Locations</td></tr>
        <tr><td>Alpha Sapphire</td><td>Transfer from Pokémon Bank</td></tr>
        <tr><td>Ultra Moon</td><td>Event</td></tr>
        <tr><td>Sword</td><td><a href="/swordshield/dynamaxadventures.shtml">Dynamax Adventures</a></td></tr>
        <tr><td>Shield</td><td>Dynamax Adventures</td></tr>
        <tr><td>Scarlet</td><td>Not available in this game</td></tr>
        <tr><td>Violet</td><td>Not available in this game</td></tr>
      </table>
      <table><tr><td>Alternate Forms</td></tr><tr><td>50% Forme / Complete Forme</td></tr></table>
    `,
    )
  }
  write(join(cacheRoot, 'pokeapi/pokeapi.co/api/v2/pokemon/718/encounters.json'), [
    {
      location_area: { name: 'max-lair', url: 'https://pokeapi.co/api/v2/location-area/999/' },
      version_details: [
        {
          version: { name: 'sword', url: 'https://pokeapi.co/api/v2/version/33/' },
          encounter_details: [
            {
              method: { name: 'gift', url: 'https://pokeapi.co/api/v2/encounter-method/18/' },
              condition_values: [],
            },
          ],
        },
      ],
    },
  ])
  write(join(cacheRoot, 'pokeapi/pokeapi.co/api/v2/pokemon/10181/encounters.json'), [])
}
