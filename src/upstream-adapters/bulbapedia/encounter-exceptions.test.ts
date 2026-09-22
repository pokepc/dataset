import { expect, it } from 'vitest'
import { findEncounterException } from './encounter-exceptions'

it('excludes only confirmed wrong-stripe Ultra Moon fishing records from the red endpoint', () => {
  const encounter = {
    gameId: 'usum-um',
    versionId: 30,
    version: 'ultra-moon',
    location: 'brooklet-hill-north',
  }
  const method = { name: 'super-rod', conditions: [] }
  expect(findEncounterException('550', encounter, method)?.reason).toContain('Blue-Striped')
  expect(findEncounterException('10016', encounter, method)).toBeUndefined()
  expect(
    findEncounterException(
      '550',
      { ...encounter, gameId: 'usum-us', versionId: 29, version: 'ultra-sun' },
      method,
    ),
  ).toBeUndefined()
  expect(
    findEncounterException('550', encounter, { name: 'npc-trade', conditions: [] }),
  ).toBeUndefined()
})

it.each([
  ['204', 'c'],
  ['213', 'g'],
  ['216', 'e'],
  ['228', 'd'],
  ['234', 'h'],
  ['235', 'i'],
])('excludes documented unreleased species %s only in its exact cave slot %s', (id, slot) => {
  const method = { name: 'walk', conditions: [] }
  for (const version of [
    { gameId: 'frlg-fr', versionId: 10, version: 'firered' },
    { gameId: 'frlg-lg', versionId: 11, version: 'leafgreen' },
  ]) {
    const encounter = { ...version, location: `kanto-altering-cave-${slot}` }
    expect(findEncounterException(id, encounter, method)?.reason).toContain('never released')
    expect(findEncounterException('41', encounter, method)).toBeUndefined()
    expect(
      findEncounterException(id, { ...encounter, location: 'kanto-altering-cave-a' }, method),
    ).toBeUndefined()
    expect(
      findEncounterException(id, { ...encounter, location: 'hoenn-safari-zone' }, method),
    ).toBeUndefined()
  }
})

it.each([
  { gameId: 'frlg-fr', versionId: 10, version: 'firered' },
  { gameId: 'frlg-lg', versionId: 11, version: 'leafgreen' },
])('documents the unreleased Aipom slot in $version', (version) => {
  const encounter = { ...version, location: 'kanto-altering-cave-f' }
  const method = { name: 'walk', conditions: [] }
  expect(findEncounterException('190', encounter, method)?.reason).toContain('never released')
  expect(
    findEncounterException('190', { ...encounter, location: 'kanto-altering-cave-b' }, method),
  ).toBeUndefined()
  expect(findEncounterException('41', encounter, method)).toBeUndefined()
})

it.each([
  { gameId: 'frlg-fr', versionId: 10, version: 'firered' },
  { gameId: 'frlg-lg', versionId: 11, version: 'leafgreen' },
])('excludes only the documented unreleased Mareep slot in $version', (version) => {
  const encounter = { ...version, location: 'kanto-altering-cave-b' }
  const method = { name: 'walk', conditions: [] }
  expect(findEncounterException('179', encounter, method)?.reason).toContain('never released')
  expect(findEncounterException('41', encounter, method)).toBeUndefined()
  expect(
    findEncounterException('179', { ...encounter, location: 'hoenn-safari-zone-area' }, method),
  ).toBeUndefined()
  expect(
    findEncounterException(
      '179',
      { ...encounter, versionId: 9, version: 'emerald', gameId: 'e' },
      method,
    ),
  ).toBeUndefined()
  expect(findEncounterException('179', encounter, { ...method, name: 'gift' })).toBeUndefined()
  expect(
    findEncounterException('179', encounter, { ...method, conditions: ['new-condition'] }),
  ).toBeUndefined()
})
