---
name: champions-team-builder
description:
  Build competitive Pokémon Champions teams for 1v1 Singles or 2v2 Doubles using the requested
  ruleset, or the latest active ruleset when none is specified. Always verify the active ruleset,
  current usage statistics, tournament results, legality, and metagame before constructing teams.
  Supports meta, top-tier, anti-meta, counter-meta, and off-meta team building.
---

# Pokémon Champions Team Builder

Build competitive teams for **Pokémon Champions** using:

- the currently verified ruleset,
- live or current usage data,
- recent tournament results,
- current metagame trends,
- and Pokémon Champions' Stat Point system.

The skill supports:

- **1v1 / Singles**
- **2v2 / Doubles**

Never assume that a previously known regulation, season, ruleset, legality list, mechanic, usage
ranking, tournament result, or metagame is still current.

The core invariant is:

> **Rules are verified from official sources. The meta is verified from current databases. Teams are
> built only after both have been researched.**

---

# 1. Determine format and ruleset

The user may specify:

- Format: `1v1`, `Singles`, `2v2`, or `Doubles`
- Regulation or ruleset
- Number of teams
- Pokémon they want to use
- Pokémon they do not want to use
- Preferred playstyle
- Tournament or Ranked Battle focus
- Meta, anti-meta, counter-meta, or off-meta preference
- Additional restrictions

Examples:

- "Give me three 2v2 teams."
- "Build a Singles team for Regulation M-B."
- "Give me a 1v1 Mega Charizard team."
- "Make three teams for the newest ruleset."
- "Build me a doubles team around Mega Swampert."
- "Give me an anti-meta team."
- "Build me the strongest ladder team."

If the user does **not** specify a format, ask whether they want:

- **1v1 / Singles**
- **2v2 / Doubles**

Do not silently assume one.

If the user does **not** specify a ruleset:

1. Search first.
2. Determine the latest currently active Pokémon Champions regulation for the requested format.
3. Verify that it is actually active today.
4. Use that regulation.

Do not assume the latest ruleset from memory or from a previous conversation.

If the user explicitly names a ruleset, use that ruleset even if it is no longer current, but still
verify its rules and metagame data.

---

# 2. Always verify the ruleset first

Before building any current-format team, search the web.

Never rely purely on model knowledge for the active regulation.

Verify:

1. Regulation/ruleset name
2. Start date
3. End date
4. Singles or Doubles rules relevant to the request
5. Pokémon legality
6. Mega Evolution rules
7. Item restrictions
8. Team size
9. Battle-selection rules
10. Duplicate-item clauses
11. Any special clauses introduced by the regulation

Prefer official sources such as:

- Official Pokémon website
- Official Pokémon Champions website/news
- Pokémon HOME / official Champions announcements
- Other first-party Pokémon sources

Explicitly state which regulation is being used.

Example:

> Using Regulation M-B, currently active for Pokémon Champions Doubles.

If the current date falls near a regulation transition, verify which ruleset is active **on that
date** rather than assuming the newest announced one has already started.

---

# 3. Mandatory current metagame research

Do **not** construct current-format teams from memory alone.

After verifying the regulation, retrieve current metagame data for the exact requested:

- format: Singles or Doubles,
- regulation/ruleset,
- current season or closest available current period.

Before team construction, obtain data from all of these categories when available:

1. **Official rules source**
2. **At least one current Pokémon Champions usage-statistics source**
3. **At least one recent tournament-results or successful-team source**

Useful current-data sources include:

- `pkmnchamps.com`
- **PokéChamp DB**
- **ChampionsDex**
- **PokéStats**
- **Pokémon Showdown usage statistics**
- Official Pokémon / Pokémon Champions metagame articles

Prefer actual Pokémon Champions Ranked/in-game-derived usage data over Showdown data when both are
available.

Use Showdown data as supplementary evidence rather than automatically treating it as equivalent to
Pokémon Champions Ranked Battle data.

Use ChampionsDex or similar tournament databases to validate whether high-usage Pokémon, cores,
movesets, and archetypes are also succeeding in recent tournaments.

Never:

- use remembered usage percentages,
- fabricate usage statistics,
- fabricate tournament placements,
- assume a usage ranking from another regulation still applies,
- silently mix Singles and Doubles data.

If current data for the exact regulation is unavailable, use the closest available fallback and
explicitly say so.

Check, when available:

- date,
- regulation,
- format,
- season,
- sample size,
- whether data is Ranked, tournament, or Showdown-derived.

---

# 4. Required usage analysis before team construction

Before selecting the six Pokémon, identify the current metagame's:

- Top 10–20 most-used Pokémon
- Most-used Mega Evolutions
- Most common items
- Most common abilities
- Most common moves where available
- Common leads in Doubles
- Common partners and cores
- Common four-Pokémon selections in Doubles where available
- Most common openers in Singles
- Common speed-control options
- Common weather setters
- Common Trick Room setters and abusers
- Important priority users
- Common defensive pivots
- Major setup sweepers
- Major spread-move users
- Common Intimidate/stat-control Pokémon
- Common anti-priority or redirection tools

Do not interpret usage percentage as strength by itself.

Cross-reference usage with recent tournament performance to distinguish:

- Popular Pokémon
- Successful Pokémon
- Popular but underperforming Pokémon
- Lower-usage Pokémon with strong tournament results
- Proven cores
- Ladder-only trends
- Tournament trends

Use this information directly when selecting:

- Pokémon
- items
- abilities
- moves
- SP spreads
- leads
- speed benchmarks
- defensive benchmarks
- matchup plans

The preferred reasoning pipeline is:

> **Ranked usage → tournament results → successful cores → matchup coverage → team construction**

Do not use:

> remembered good Pokémon → six-Pokémon team

---

# 5. Team optimization mode

Infer the optimization goal from the user's wording.

## Meta / top-tier

If the user asks for:

- best teams
- strongest teams
- top-tier teams
- meta teams
- ladder teams
- tournament teams

Prioritize:

- proven high-performing cores,
- current usage,
- recent tournament success,
- consistent matchup coverage,
- stable game plans.

Do not avoid highly used Pokémon merely for originality.

A top-tier team should be justified by current evidence, not by historical reputation.

---

## Anti-meta / counter-meta

If the user asks for:

- anti-meta
- counter-meta
- counters to the meta
- teams that beat common teams
- teams designed for the current ladder field

First identify the highest-usage:

- Pokémon,
- Megas,
- leads,
- cores,
- speed-control structures,
- weather structures,
- Trick Room structures.

Then build specifically around favorable matchups into those structures.

An anti-meta team must still have a coherent general game plan.

Do not create six narrow counters that fail against everything else.

For anti-meta teams:

- explain in `Role and usage` what important current threat each Pokémon pressures when relevant,
- make `TOP COMMON` describe the team's default anti-meta game plan,
- make `POTENTIAL THREATS` identify what still gives the counter-team trouble.

---

## Off-meta

If the user asks for:

- off-meta
- unusual teams
- uncommon Pokémon
- creative teams

Prefer lower-usage Pokémon that still have demonstrable strategic value.

Do not intentionally make the team weaker merely to reduce usage.

Ideally support off-meta picks with:

- tournament success,
- favorable matchup data,
- specific meta-targeting utility,
- unique ability or speed-tier advantages.

---

# 6. Team construction principles

Build teams for the actual current metagame rather than selecting six individually strong Pokémon.

Each team should have:

- A clear primary win condition
- At least one secondary win condition
- Appropriate speed control
- Defensive or positional tools
- Answers to common metagame threats
- Logical item distribution
- Complementary offensive coverage
- A coherent battle plan
- A clear explanation of which matchups it is intended to perform well into

When multiple teams are requested, make them meaningfully different.

Possible archetypes include:

- Hyper offense
- Balance
- Rain
- Sun
- Trick Room
- Setup
- Bulky offense
- Tailwind offense
- Weather control
- Priority offense
- Anti-meta balance
- Counter-weather
- Speed-control denial

Whenever possible, use successful current tournament structures or established high-level builds as
a foundation.

Do not fabricate tournament teams or statistics.

---

# 7. Pokémon Champions Stat Points

Pokémon Champions uses **Stat Points (SPs)**.

Unless the currently verified rules specify otherwise:

- Maximum **32 SPs per stat**
- Maximum **66 SPs total per Pokémon**

Available stats:

- HP
- Atk
- Def
- SpA
- SpD
- Spe

Always include SPs for every Pokémon.

Use compact notation and omit stats with zero investment.

Examples:

`32 HP / 32 Atk / 2 Spe`

`11 HP / 32 Atk / 23 Spe`

`32 HP / 19 Def / 15 SpD`

Every spread must be checked so:

- no individual stat exceeds 32,
- total SPs do not exceed 66.

Do not automatically use:

`32 offensive stat / 32 Spe / 2 HP`

for every attacker.

Optimize SPs according to:

- speed benchmarks,
- Tailwind,
- Swift Swim,
- Trick Room,
- priority survival,
- common damage benchmarks,
- defensive thresholds,
- offensive KO thresholds,
- Mega Evolution stat changes,
- the Pokémon's role.

Prefer proven tournament spreads where available.

If importing a tournament spread, preserve it unless there is a specific reason to adapt it.

---

# 8. Speed and damage benchmarks

When possible, choose SP distributions based on meaningful current-format benchmarks.

Examples:

- Outspeeds Pokémon X
- Outspeeds Pokémon X after Tailwind
- Outspeeds Pokémon X under rain
- Outspeeds a common Choice Scarf benchmark
- Survives Kingambit Sucker Punch
- Survives Garchomp Earthquake
- Survives Mega Charizard Y Heat Wave
- Guarantees an OHKO against Pokémon X
- Avoids a 2HKO from a common spread move

Never invent a benchmark.

If a benchmark cannot be verified or calculated, describe the spread more generally.

If a tournament team provides an optimized spread but the exact benchmark is not documented, it is
acceptable to say:

> Uses a proven tournament spread optimized for bulk/speed.

Do not fabricate the reason.

---

# 9. 1v1 / Singles considerations

For Singles, prioritize:

- Individual matchup coverage
- Switching
- Setup sweepers
- Revenge killing
- Defensive pivots
- Choice-item users
- Priority
- Entry hazards if relevant
- Endgame win conditions
- Common opening matchups
- Current Singles speed tiers
- Current Singles item usage

Do not apply Doubles logic blindly.

Moves such as:

- Fake Out
- Rage Powder
- Helping Hand
- ally-targeting moves

should only be used when they make sense in Singles.

For Singles teams, the `TOP COMMON` row should describe:

- the most common opener,
- common selection,
- primary battle plan,
- or the team's usual win-condition sequence.

---

# 10. 2v2 / Doubles considerations

For Doubles, prioritize:

- Leads
- Pokémon brought in the back
- Protect
- Fake Out
- Tailwind
- Trick Room
- Redirection
- Intimidate
- Priority
- Spread attacks
- Weather control
- Board positioning
- Ally immunities
- Setup opportunities
- Common lead-vs-lead interactions
- Common partner combinations
- Current Doubles speed tiers

Pay particular attention to lead combinations.

For each team, identify the most common lead/core.

Example:

`Whimsicott + Charizard lead, with Garchomp + Kingambit in the back.`

Do not imply that the player must always bring the same four Pokémon.

---

# 11. REQUIRED output format for every team

Every team **MUST** be presented using exactly this table structure:

| Pokémon               | Item | Nature and Ability | Moves                             | SPs       | Role and usage                                                                         |
| --------------------- | ---- | ------------------ | --------------------------------- | --------- | -------------------------------------------------------------------------------------- |
| Pokémon 1             | Item | Nature · Ability   | Move 1 · Move 2 · Move 3 · Move 4 | SP spread | Short description                                                                      |
| Pokémon 2             | Item | Nature · Ability   | Move 1 · Move 2 · Move 3 · Move 4 | SP spread | Short description                                                                      |
| Pokémon 3             | Item | Nature · Ability   | Move 1 · Move 2 · Move 3 · Move 4 | SP spread | Short description                                                                      |
| Pokémon 4             | Item | Nature · Ability   | Move 1 · Move 2 · Move 3 · Move 4 | SP spread | Short description                                                                      |
| Pokémon 5             | Item | Nature · Ability   | Move 1 · Move 2 · Move 3 · Move 4 | SP spread | Short description                                                                      |
| Pokémon 6             | Item | Nature · Ability   | Move 1 · Move 2 · Move 3 · Move 4 | SP spread | Short description                                                                      |
| **TOP COMMON**        | —    | —                  | —                                 | —         | Most common lead, selection, core, or general battle plan.                             |
| **POTENTIAL THREATS** | —    | —                  | —                                 | —         | Important opposing Pokémon, archetypes, mechanics, or matchups that threaten the team. |

This exact six-column format is mandatory.

Do **not**:

- add extra columns,
- remove columns,
- move SPs elsewhere,
- put `TOP COMMON` outside the table,
- put `POTENTIAL THREATS` outside the table,
- replace the final two rows with separate paragraphs.

The final two rows are always part of the same table.

---

# 12. Column requirements

## Pokémon

Use the Pokémon species name.

Example:

`Charizard`

If it Mega Evolves, the Mega Stone and ability should make the intended form clear.

---

## Item

Use the exact held item.

Respect the current ruleset's item restrictions.

Do not accidentally duplicate an item when duplicate items are prohibited.

---

## Nature and Ability

Use:

`Nature · Ability`

Examples:

`Modest · Drought`

`Jolly · Rough Skin`

When useful, distinguish pre-Mega and post-Mega abilities:

`Adamant · Torrent → Swift Swim`

---

## Moves

Always list exactly four moves.

Separate them with:

`·`

Example:

`Heat Wave · Solar Beam · Weather Ball · Protect`

All moves must be legal in the current ruleset.

---

## SPs

Use Pokémon Champions SP notation.

Examples:

`32 HP / 32 Def / 2 SpA`

`11 HP / 32 Atk / 23 Spe`

`9 HP / 25 SpA / 32 Spe`

Omit zero-investment stats.

Always verify the total.

---

## Role and usage

Use one or two short sentences.

Describe:

1. The Pokémon's role
2. How it is normally used

For anti-meta teams, also mention which important current threat/core it pressures when useful.

Example:

`Primary Mega and sun setter. Usually leads with Whimsicott and applies immediate spread pressure.`

Keep this concise.

Do not write long strategy paragraphs inside the cell.

---

# 13. TOP COMMON row

The second-to-last row must always be:

`TOP COMMON`

For Doubles, describe:

- most common lead,
- common Pokémon in the back,
- main opening sequence if relevant.

Example:

| **TOP COMMON** | — | — | — | — | Whimsicott + Charizard lead, usually with Garchomp + Kingambit in
the back. |

For Singles, describe:

- most common opener,
- common selection,
- primary battle plan.

For anti-meta teams, describe the most common way the team attacks the dominant meta structures.

Keep it short.

---

# 14. POTENTIAL THREATS row

The final row must always be:

`POTENTIAL THREATS`

Mention the most relevant:

- Pokémon
- Megas
- Weather archetypes
- Trick Room
- Tailwind
- Priority
- Setup
- Defensive cores
- Specific problematic matchups

Example:

| **POTENTIAL THREATS** | — | — | — | — | Rain, Trick Room, Mega Aerodactyl, Rock pressure, and
opposing weather control. |

Threats must be based on the **current researched metagame**.

For a top-tier team, list genuinely unfavorable popular matchups.

For an anti-meta team, list the structures that still bypass or overload the intended counters.

---

# 15. Team heading

Before every table include:

## Team N — Team Name

**Archetype:** Archetype  
**Difficulty:** ★★★☆☆

Then give no more than one or two short sentences explaining the team's overall idea.

Example:

## Team 1 — Mega Swampert Rain

**Archetype:** Rain offense  
**Difficulty:** ★★★☆☆

Pelipper establishes rain while Mega Swampert and Basculegion apply immediate speed and offensive
pressure.

Then immediately show the required team table.

---

# 16. Multiple-team comparison

If the user requests multiple teams, finish with one short comparison table:

| Team | Archetype | Difficulty | Best for | Main weakness |
| ---- | --------- | ---------- | -------- | ------------- |

Do not repeat every Pokémon here.

When the user requests multiple teams, prefer meaningful strategic diversity.

For example:

1. Proven top-tier meta team
2. Different top-tier archetype
3. Anti-meta or counter-meta team

Do not force this pattern if the user explicitly requests something else.

---

# 17. Threat validation

Before finalizing a team, check it against:

- Most-used Pokémon
- Most-used Megas
- Major weather teams
- Trick Room
- Tailwind
- Priority
- Setup
- Intimidate / stat control
- Common spread attacks
- Defensive cores
- Common lead combinations
- Current ladder trends
- Recent tournament trends

Do not claim a team counters something merely because one Pokémon has a super-effective move.

Consider:

- speed order,
- common partners,
- abilities,
- items,
- board position,
- priority,
- damage ranges,
- weather,
- redirection,
- switching,
- matchup sequencing.

---

# 18. Mega Evolution rules

Always verify current Mega Evolution rules.

Do not assume:

- how many Mega Stones can be on a team,
- how many Pokémon can Mega Evolve during battle,
- which Mega Evolutions are legal,
- whether the mechanic works identically to older games.

If the team contains multiple possible Mega Pokémon, explain their matchup roles briefly in the
`Role and usage` column.

---

# 19. Final legality validation

Before outputting a team, verify every Pokémon:

- Pokémon is legal
- Item is legal
- Ability is correct
- Mega Ability is correct
- Moves are legal
- Nature makes sense
- SP total is legal
- No SP stat exceeds the maximum
- Item restrictions are respected
- Team construction respects the active regulation
- The chosen format is correct
- Tournament-imported sets come from the same or compatible regulation

For every standard 66-SP spread, check the arithmetic.

Example:

`11 + 32 + 23 = 66`

---

# 20. Sources and freshness

Cite current sources used for:

- Active regulation
- Regulation dates
- Usage statistics
- Tournament usage/results
- Imported tournament teams
- Imported SP spreads
- Current metagame claims

For every current team-building request, include enough citations that the user can verify why the
Pokémon/core is considered relevant.

Do not cite a database merely because it exists.

Use the actual current regulation/season/statistics/team page when possible.

Clearly label the origin of data:

- Official
- Pokémon Champions in-game-derived
- Tournament
- Showdown

Never present an unofficial database as an official Pokémon Company source.

---

# 21. Default workflow

When the user asks:

> "Give me three Pokémon Champions teams."

Follow this order:

1. Ask whether they want 1v1 Singles or 2v2 Doubles if not specified.
2. Search for the currently active ruleset.
3. Verify the regulation and its restrictions from official sources.
4. Search current Pokémon Champions usage statistics.
5. Search recent tournament results and successful teams.
6. Identify the important metagame threats and cores.
7. Determine whether the user wants meta, anti-meta, counter-meta, off-meta, or another optimization
   mode.
8. Build the requested number of distinct teams.
9. Choose optimized Pokémon Champions SP spreads.
10. Validate legality.
11. Output every team using the mandatory six-column table.
12. Include `TOP COMMON` as the second-to-last row of every team table.
13. Include `POTENTIAL THREATS` as the final row of every team table.
14. Add a short comparison table if multiple teams were requested.
15. Cite the current rules, usage data, and tournament evidence used.

Never assume that a ruleset, usage ranking, or tournament result mentioned in an earlier
conversation is still current.
