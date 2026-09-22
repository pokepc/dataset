import { readFileSync } from 'node:fs'

/** Selected real rows from the supplied main availability page, fetched 2026-09-22. */
export function mainPage(): string {
  return readFileSync(new URL('./fixtures/main.html', import.meta.url), 'utf8')
}

/** A released species plus an explicitly unreleased species, using the page's markup. */
export function goPage(): string {
  return `<h2><span id="List_of_Pokémon_by_date">List of Pokémon by date</span></h2>
  <table><tr><th>Date</th><th>Pokémon</th><th>Notes</th></tr>
    <tr><td>Jul 6, 2016</td><td><a href="/wiki/Pikachu_(Pok%C3%A9mon)"><img src="/GO0025.png" alt="Pikachu"></a></td><td>Initial release.</td></tr>
  </table>
  <h2><span id="Unreleased_Pokémon">Unreleased Pokémon</span></h2>
  <p>The following species have yet to become available:</p>
  <table><tr><th>Generation</th><th>Total</th><th>Pokémon</th></tr>
    <tr><th>IV</th><td>1</td><td><a href="/wiki/Manaphy_(Pok%C3%A9mon)"><img src="/GO0490.png" alt="Manaphy"></a></td></tr>
  </table>`
}
