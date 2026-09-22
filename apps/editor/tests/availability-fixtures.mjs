import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Synthetic tables preserve the published game order, legend, headers and cell colors.
const games = [
  ['Red', 'I'],
  ['Green', 'I'],
  ['Blue', 'I'],
  ['Yellow', 'I'],
  ['Gold', 'II'],
  ['Silver', 'II'],
  ['Crystal', 'II'],
  ['Ruby', 'III'],
  ['Sapphire', 'III'],
  ['FireRed', 'III'],
  ['LeafGreen', 'III'],
  ['Emerald', 'III'],
  ['Colosseum', 'GCN'],
  ['XD', 'GCN'],
  ['Diamond', 'IV'],
  ['Pearl', 'IV'],
  ['Platinum', 'IV'],
  ['HeartGold', 'IV'],
  ['SoulSilver', 'IV'],
  ['Black', 'V'],
  ['White', 'V'],
  ['Black 2', 'V'],
  ['White 2', 'V'],
  ['X', 'VI'],
  ['Y', 'VI'],
  ['Omega Ruby', 'VI'],
  ['Alpha Sapphire', 'VI'],
  ['Sun', 'VII'],
  ['Moon', 'VII'],
  ['Ultra Sun', 'VII'],
  ['Ultra Moon', 'VII'],
  ["Let's Go, Pikachu!", 'VII'],
  ["Let's Go, Eevee!", 'VII'],
  ['Sword', 'VIII'],
  ['Shield', 'VIII'],
  ['Brilliant Diamond', 'VIII'],
  ['Shining Pearl', 'VIII'],
  ['Legends: Arceus', 'VIII'],
  ['Scarlet', 'IX'],
  ['Violet', 'IX'],
  ['Legends: Z-A', 'IX'],
]
const legend = {
  C: 'Catchable in the wild.',
  S: 'Available as a starter.',
  R: 'Received as a gift.',
  E: 'Available through evolution.',
  B: 'Available through breeding.',
  CD: 'Catchable with DLC.',
  D: 'Available with DLC.',
  DA: 'Available in Dynamax Adventures.',
  ET: 'Available through trade evolution.',
  TE: 'Trade from another game and evolve.',
  CC: 'Catchable with additional conditions.',
  DS: 'Available through dual-slot mode.',
  FS: 'Available in Friend Safari.',
  EV: 'Catchable through an event.',
  PW: 'Transfer from Pokéwalker.',
  DR: 'Transfer from Dream Radar.',
  DW: 'Transfer from Dream World.',
  Ev: 'Transfer from an event distribution.',
  T: 'Transfer from another game.',
  '—': 'Unavailable in this game.',
}

// Seed the real source readers; browser tests do not depend on live upstreams.
export function seedAvailabilityFixtures(cacheRoot) {
  function page(slug, html) {
    const url = `https://bulbapedia.bulbagarden.net/wiki/${slug}`
    const filename = createHash('sha256').update(url).digest('hex') + '.json'
    const path = join(cacheRoot, 'bulbapedia', filename)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify({ version: 2, url, html }))
  }
  const labels = { 'Alpha Sapphire': 'T', 'Ultra Moon': 'EV', Sword: 'DA', Shield: 'DA' }
  page(
    'List_of_Pok%C3%A9mon_by_availability',
    `
    <h1 id="firstHeading">List of Pokémon by availability</h1>
    <p>Games are ordered ${games.map(([name]) => `<a href="/wiki/${name === 'Blue' ? 'Pokémon_Blue_(Japanese)' : name}">${name}</a>`).join(', ')}.</p>
    <table><tr><th>Symbol</th> <th>Meaning</th></tr>
      ${Object.entries(legend)
        .map(([symbol, meaning]) => `<tr><td>${symbol}</td><td>${meaning}</td></tr>`)
        .join('')}
    </table>
    <table>
      <tr><th rowspan="2">#</th> <th rowspan="2">Icon</th> <th rowspan="2">Name</th> <th colspan="41">Game</th></tr>
      <tr>${games.map(([, generation]) => `<th>${generation === 'GCN' ? 'GCN' : `Generation ${generation}`}</th>`).join('')}</tr>
      <tr><td>0718</td><td></td><td>Zygarde</td>
        ${games.map(([name], index) => `<th style="color:#${(0x100000 + index).toString(16)}">${labels[name] ?? '—'}</th>`).join('')}
      </tr>
    </table>
  `,
  )
  page(
    'List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO',
    `
    <h1 id="firstHeading">List of Pokémon by availability in Pokémon GO</h1>
    <h2>List of Pokémon by date</h2>
    <table><tr><th>Date</th><th>Pokémon</th><th>Notes</th></tr>
      <tr><td>Jul 20, 2023</td><td>
        <a href="/wiki/Zygarde_(Pok%C3%A9mon)"><img alt="Zygarde" src="/GO0718.png" /></a>
        <a href="/wiki/Zygarde_(Pok%C3%A9mon)"><img alt="Zygarde" src="/GO0718T.png" /></a>
      </td><td>Zygarde released in Special Research; forms change with Zygarde Cells.</td></tr>
    </table>
  `,
  )
}
