import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import OpenAI from 'openai'
import pikachu from '../../../data/pokemon/pikachu.json'
import {
  availabilityJson,
  bulbapediaUrl,
  parseAvailability,
  type AvailabilityReport,
} from './availability'
import {
  extractVerificationHtml,
  applyAiReview,
  formatAiReview,
  readVerificationApiKey,
  validateAiReview,
  verifyAvailabilityWithAi,
  VERIFICATION_MODEL,
} from './ai-verification'

const html = `<h1>Pikachu (Pokémon)</h1><div id="mw-content-text"><div class="mw-parser-output">
  <p>Species introduction.</p><nav>Navigation noise</nav><script>doNotSend()</script>
  <div class="mw-heading"><h2 id="Biology">Biology</h2></div><p>Biology context.</p>
  <h3 id="Forms">Forms</h3><p>Some forms revert on deposit.</p>
  <h2 id="Game_data">Game data</h2><h3>Pokédex entries</h3><p>Flavor text noise.</p>
  <h3><span id="Game_locations">Game locations</span></h3>
  <table style="color:red"><tr><th colspan="2">Red</th><td>
  <a href="/wiki/Viridian_Forest" title="Viridian Forest">Viridian Forest</a><sup title="Condition">*</sup>
  </td></tr></table><h4 id="In_events">In events</h4><p>Event context.</p>
  <h3 id="Stats">Stats</h3><p>Stat noise.</p><h3 id="Learnset">Learnset</h3><p>Move noise.</p>
  <h2>In side games</h2><h3>Pokémon GO</h3><p>GO context.</p>
  </div></div>`
const pokemon = {
  ...pikachu,
  obtainableIn: ['home'],
  transferOnlyIn: [],
  eventOnlyIn: [],
  storableIn: ['home', 'rb-r'],
  reviewContext: { fullRecord: true },
}
const games = [
  {
    id: 'rb-r',
    name: 'Red',
    gen: 1,
    type: 'game' as const,
    gameSet: 'rb',
    gameSuperSet: null,
    features: { storage: true },
  },
  { id: 'home', name: 'HOME', gen: 8, type: 'game' as const, gameSet: null, gameSuperSet: null },
]
const report = parseAvailability(html, pokemon, games)
const review = {
  candidateJson: availabilityJson(report),
  differenceReason: null,
  summary: 'The parsed route agrees with the supplied HTML; HOME is retained.',
  checks: [
    { gameId: 'rb-r', result: 'accurate', evidence: 'Red: Viridian Forest.' },
    {
      gameId: 'home',
      result: 'retained',
      evidence: 'No HOME acquisition evidence; existing values preserved.',
    },
  ],
  findings: [],
  conflictResolutions: [],
}

function clientFor(result: unknown = review, overrides: Record<string, unknown> = {}) {
  const request = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: 'resp_test',
        object: 'response',
        status: 'completed',
        model: VERIFICATION_MODEL,
        output: [
          {
            type: 'message',
            role: 'assistant',
            id: 'msg_test',
            status: 'completed',
            content: [{ type: 'output_text', text: JSON.stringify(result), annotations: [] }],
          },
        ],
        ...overrides,
      }),
      { headers: { 'content-type': 'application/json' } },
    ),
  )
  return { client: new OpenAI({ apiKey: 'test-key', fetch: request, maxRetries: 0 }), request }
}

describe('source conflict review', () => {
  const source = html.replace('Viridian Forest</a>', 'Trade</a>')
  const conflictReport: AvailabilityReport = {
    ...parseAvailability(source, pokemon, games),
    crossChecks: {
      pokeApi: {
        url: 'https://pokeapi.co/api/v2/pokemon/25/encounters/',
        status: 'checked',
        formSpecific: true,
        encounters: [
          {
            gameId: 'rb-r',
            versionId: 1,
            version: 'red',
            location: 'viridian-forest',
            methods: [{ name: 'walk', conditions: [] }],
          },
        ],
      },
      serebii: [
        {
          url: 'https://www.serebii.net/pokedex/025.shtml',
          gameIds: ['rb-r'],
          html: '<table><tr><td>Red</td><td>Viridian Forest</td></tr></table>',
        },
      ],
      conflicts: [
        {
          id: 'pokeapi:rb-r',
          gameId: 'rb-r',
          message: 'PokéAPI encounter contradicts transfer-only.',
          evidence: 'Red: walk in Viridian Forest.',
        },
      ],
      unresolvedConflictIds: ['pokeapi:rb-r'],
      warnings: [],
    },
  }
  const resolution = {
    conflictId: 'pokeapi:rb-r',
    result: 'resolved',
    evidence:
      'The supplied location anchor contradicts its Trade label; PokéAPI and Serebii identify a wild encounter in Red.',
    sourceUrls: [
      bulbapediaUrl(pokemon),
      conflictReport.crossChecks!.pokeApi.url!,
      conflictReport.crossChecks!.serebii[0].url,
    ],
  }
  const corrected = {
    ...review,
    candidateJson: availabilityJson(report),
    differenceReason:
      'PokéAPI and Serebii confirm the wild encounter behind the mislabeled Bulbapedia location link.',
    conflictResolutions: [resolution],
  }

  it('supplies all source evidence in one structured AI request and applies a resolved correction', async () => {
    const { client, request } = clientFor(corrected)
    const result = await verifyAvailabilityWithAi(conflictReport, source, games, { client })
    expect(result.verdict).toBe('pass')
    const body = JSON.parse(String(request.mock.calls[0][1]?.body))
    expect(JSON.parse(body.input[0].content).additionalSources).toEqual(conflictReport.crossChecks)
    expect(body.text.format.schema.required).toContain('conflictResolutions')
    expect(request).toHaveBeenCalledOnce()
    const updated = applyAiReview(conflictReport, result)
    expect(updated.crossChecks?.unresolvedConflictIds).toEqual([])
    expect(availabilityJson(updated).obtainableIn).toContain('rb-r')
    expect(conflictReport.crossChecks?.unresolvedConflictIds).toEqual(['pokeapi:rb-r'])
    expect(formatAiReview(result)).toContain('pokeapi:rb-r: resolved')
  })

  it('derives uncertain from an unresolved conflict even when all game checks claim accuracy', () => {
    const result = validateAiReview(
      {
        ...review,
        candidateJson: availabilityJson(conflictReport),
        conflictResolutions: [
          {
            ...resolution,
            result: 'uncertain',
            evidence: 'The conflicting source claims cannot be reconciled.',
          },
        ],
      },
      conflictReport,
    )
    expect(result.verdict).toBe('uncertain')
    expect(() => applyAiReview(conflictReport, result)).toThrow('did not pass')
  })

  it.each([
    [],
    [resolution, resolution],
    [{ ...resolution, conflictId: 'invented' }],
    [{ ...resolution, evidence: ' ' }],
    [{ ...resolution, sourceUrls: [] }],
    [{ ...resolution, sourceUrls: [bulbapediaUrl(pokemon)] }],
    [{ ...resolution, sourceUrls: [...resolution.sourceUrls, 'https://example.com/invented'] }],
  ])('rejects incomplete or unsupported conflict resolutions: %j', (...entries) => {
    expect(() =>
      validateAiReview({ ...corrected, conflictResolutions: entries }, conflictReport),
    ).toThrow()
  })
})

describe('AI evidence', () => {
  it('retains important HTML independently of the parsed rows and removes unrelated sections', () => {
    const evidence = extractVerificationHtml(html)
    for (const text of [
      'Species introduction',
      'Biology context',
      'revert on deposit',
      'Game_locations',
      'Event context',
      'GO context',
      'colspan="2"',
      'href="/wiki/Viridian_Forest"',
      'title="Condition"',
    ])
      expect(evidence).toContain(text)
    for (const text of [
      'Navigation noise',
      'doNotSend',
      'Flavor text noise',
      'Stat noise',
      'Move noise',
      'style=',
    ])
      expect(evidence).not.toContain(text)
  })
  it('refuses missing or oversized evidence instead of silently truncating', () => {
    expect(() => extractVerificationHtml('<h1>Access denied</h1>')).toThrow(
      'missing Game locations',
    )
    expect(() =>
      extractVerificationHtml(html.replace('Biology context.', 'a'.repeat(500_001))),
    ).toThrow('refusing to silently truncate')
  })
  it.each([false, true])(
    'sends full context and structured output with low reasoning (harder: %s)',
    async (harder) => {
      const model = harder ? 'gpt-5.6-terra' : 'gpt-5.6-luna'
      const { client, request } = clientFor(review, { model })
      const result = await verifyAvailabilityWithAi(report, html, games, { client, harder })
      expect(result.verdict).toBe('pass')
      const body = JSON.parse(String(request.mock.calls[0][1]?.body))
      expect(body.model).toBe(model)
      expect(body.reasoning.effort).toBe('low')
      expect(body.store).toBe(false)
      expect(body.tools).toBeUndefined()
      expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true })
      expect(body.instructions).toContain('untrusted DATA')
      const input = JSON.parse(body.input[0].content)
      expect(input.currentPokemon).toEqual(pokemon)
      expect(input.currentGames).toEqual(games)
      expect(input.candidateJson).toEqual(availabilityJson(report))
      expect(input.sourceHtml).toContain('revert on deposit')
      expect(input.parsedGameRows.map((row: { gameId: string }) => row.gameId)).toEqual([
        'rb-r',
        'home',
      ])
      expect(formatAiReview(result)).toContain('1 retained without independent source verification')
      expect(formatAiReview(result, harder)).toContain(`AI verification (${model}): PASS`)
    },
  )
})

describe('AI verdict validation', () => {
  const correction = {
    ...review,
    candidateJson: { ...review.candidateJson, obtainableIn: ['home'], transferOnlyIn: ['rb-r'] },
    differenceReason: 'The encounter belongs to another form; the selected form requires transfer.',
    findings: [
      {
        scope: 'parsing',
        severity: 'warning',
        gameId: 'rb-r',
        field: 'obtainableIn',
        message: 'Corrected form attribution.',
        evidence: 'The encounter annotation names another form.',
      },
    ],
  }

  it('accepts an evidenced correction and uses the AI candidate without changing the input record', async () => {
    const { client, request } = clientFor(correction)
    const result = await verifyAvailabilityWithAi(report, html, games, { client })
    expect(result.verdict).toBe('pass')
    expect(result.candidateJson).toEqual(correction.candidateJson)
    const updated = applyAiReview(report, result)
    expect(availabilityJson(updated)).toEqual(correction.candidateJson)
    expect(updated.pokemon).toBe(report.pokemon)
    expect(updated.rows[0]).toMatchObject({ status: 'transferOnlyIn', basis: 'ai' })
    expect(report.rows[0].status).toBe('obtainableIn')
    expect(formatAiReview(result)).toContain(`AI difference: ${correction.differenceReason}`)
    const body = JSON.parse(String(request.mock.calls[0][1]?.body))
    expect(body.text.format.schema.required).toContain('candidateJson')
    expect(body.text.format.schema.required).toContain('differenceReason')
  })

  it('allows 25 words but rejects longer, absent, empty, or unnecessary explanations', () => {
    expect(
      validateAiReview(
        { ...correction, differenceReason: Array(25).fill('word').join(' ') },
        report,
      ).verdict,
    ).toBe('pass')
    for (const differenceReason of [null, '', ' ', Array(26).fill('word').join(' ')]) {
      expect(() => validateAiReview({ ...correction, differenceReason }, report)).toThrow()
    }
    expect(() => validateAiReview({ ...review, differenceReason: 'No changes.' }, report)).toThrow(
      'difference reason',
    )
  })

  it('normalizes ordering without calling it an AI difference', () => {
    const result = validateAiReview(
      {
        ...review,
        candidateJson: {
          ...review.candidateJson,
          obtainableIn: [...review.candidateJson.obtainableIn].reverse(),
          storableIn: [...review.candidateJson.storableIn].reverse(),
        },
      },
      report,
    )
    expect(result.candidateJson).toEqual(review.candidateJson)
    expect(result.differenceReason).toBeNull()
  })

  it.each([
    { id: 'wrong-pokemon' },
    { nid: 'wrong-nid' },
    { obtainableIn: ['invented-game'] },
    { obtainableIn: ['rb-r', 'rb-r'] },
    { transferOnlyIn: ['rb-r'] },
    { storableIn: ['rb-r'] },
    { unexpectedProperty: true },
  ])('rejects an invalid AI candidate: %j', (changes) => {
    expect(() =>
      validateAiReview(
        { ...review, candidateJson: { ...review.candidateJson, ...changes } },
        report,
      ),
    ).toThrow()
  })

  it('rejects female Gen 1 corrections and corrections without an accurate evidence check', () => {
    const femaleReport = parseAvailability(html, { ...pokemon, isFemaleForm: true }, games)
    expect(() => validateAiReview(review, femaleReport)).toThrow('Generation I')
    for (const result of ['retained', 'uncertain', 'inaccurate']) {
      expect(() =>
        validateAiReview(
          {
            ...correction,
            checks: [{ ...review.checks[0], result }, review.checks[1]],
          },
          report,
        ),
      ).toThrow()
    }
    expect(() =>
      applyAiReview(report, { ...validateAiReview(review, report), verdict: 'fail' }),
    ).toThrow('did not pass')
  })

  it('does not allow AI to invent changes to groups without a concrete game row', () => {
    const groupReport = { ...report, gameOrder: ['rb', ...report.gameOrder] }
    expect(() =>
      validateAiReview(
        {
          ...correction,
          candidateJson: { ...correction.candidateJson, obtainableIn: ['home', 'rb'] },
        },
        groupReport,
      ),
    ).toThrow('requires an accurate check')
  })

  it('requires the AI to verify female Gen 1 exclusions against the explicit rule', async () => {
    const femaleReport = parseAvailability(html, { ...pokemon, isFemaleForm: true }, games)
    const femaleReview = { ...review, candidateJson: availabilityJson(femaleReport) }
    const { client, request } = clientFor(femaleReview)
    expect((await verifyAvailabilityWithAi(femaleReport, html, games, { client })).verdict).toBe(
      'pass',
    )
    const body = JSON.parse(String(request.mock.calls[0][1]?.body))
    expect(body.instructions).toContain('isFemaleForm=true')
    const input = JSON.parse(body.input[0].content)
    expect(input.parsedGameRows[0]).toMatchObject({ status: 'unavailable', basis: 'rule' })
    expect(input.candidateJson.obtainableIn).not.toContain('rb-r')
    expect(() =>
      validateAiReview(
        {
          ...femaleReview,
          checks: [{ ...review.checks[0], result: 'retained' }, review.checks[1]],
        },
        femaleReport,
      ),
    ).toThrow('rule-derived')
  })
  it.each(['inaccurate', 'uncertain'])('does not pass a game marked %s', (result) => {
    const value = { ...review, checks: [{ ...review.checks[0], result }, review.checks[1]] }
    expect(validateAiReview(value, report).verdict).toBe(
      result === 'inaccurate' ? 'fail' : 'uncertain',
    )
  })
  it('treats error findings as failures even when all per-game checks claim accuracy', () => {
    const value = {
      ...review,
      findings: [
        {
          scope: 'input',
          severity: 'error',
          gameId: null,
          field: 'identity',
          message: 'Wrong form',
          evidence: 'The selected form differs from the table annotation.',
        },
      ],
    }
    expect(validateAiReview(value, report).verdict).toBe('fail')
  })
  it.each([
    { ...review, checks: review.checks.slice(0, 1) },
    { ...review, checks: [review.checks[0], review.checks[0]] },
    { ...review, checks: [{ ...review.checks[0], gameId: 'invented' }, review.checks[1]] },
    { ...review, checks: [{ ...review.checks[0], result: 'retained' }, review.checks[1]] },
    { ...review, checks: [{ ...review.checks[0], evidence: '' }, review.checks[1]] },
    { ...review, summary: null },
  ])('rejects incomplete, unsupported, or malformed reviews', (value) => {
    expect(() => validateAiReview(value, report)).toThrow()
  })
  it.each([
    { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] },
    { output: [] },
    { model: 'some-other-model' },
  ])('rejects incomplete responses and model substitutions', async (overrides) => {
    await expect(
      verifyAvailabilityWithAi(report, html, games, {
        client: clientFor(review, overrides).client,
      }),
    ).rejects.toThrow()
  })
  it('does not expose API error bodies or credentials on failure', async () => {
    const client = new OpenAI({
      apiKey: 'test-key',
      maxRetries: 0,
      fetch: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: 'secret-value-should-not-appear', type: 'invalid_request_error' },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
      ),
    })
    await expect(verifyAvailabilityWithAi(report, html, games, { client })).rejects.toThrow(
      'HTTP 401',
    )
    await expect(verifyAvailabilityWithAi(report, html, games, { client })).rejects.not.toThrow(
      'secret-value-should-not-appear',
    )
  })
  it('rejects a Luna response when Terra was requested', async () => {
    await expect(
      verifyAvailabilityWithAi(report, html, games, {
        client: clientFor().client,
        harder: true,
      }),
    ).rejects.toThrow('unexpected model: gpt-5.6-luna')
  })
})

describe('existing API key lookup', () => {
  it('prefers the environment and otherwise reads only the repository env key', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pokepc-ai-key-test-'))
    try {
      const file = join(directory, '.env')
      await writeFile(file, 'OPENAI_API_KEY="test-file-key"\nUNRELATED_VARIABLE=unused\n')
      expect(await readVerificationApiKey(file, { OPENAI_API_KEY: 'test-env-key' })).toBe(
        'test-env-key',
      )
      expect(await readVerificationApiKey(file, {})).toBe('test-file-key')
      await expect(readVerificationApiKey(join(directory, 'missing'), {})).rejects.toThrow(
        'AI verification requires OPENAI_API_KEY',
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
