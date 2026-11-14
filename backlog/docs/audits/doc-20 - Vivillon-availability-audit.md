---
id: doc-20
title: Vivillon availability audit
type: other
created_date: 2026-09-30 23:59
updated_date: '2026-11-14T22:32:00Z'
---
Reviewed 2026-09-22; Legends: Z-A column revised 2026-11-14. Covers all 20 dataset records, including `vivillon` = Icy Snow. The shared CLI
and editor use `vivillon-availability-rules.ts`; blanket base inheritance is removed.

O = `obtainableIn`, T = `transferOnlyIn`, E = `eventOnlyIn`, U = unavailable. Each acquisition cell belongs to only one
field. X/Y and US/UM depend on the 3DS region; O does not mean every pattern is native to every
save.

| Pattern     | XY / USUM | Scarlet / Violet | Legends: Z-A | Champions | GO  |
| ----------- | --------- | ---------------- | ------------ | --------- | --- |
| Icy Snow    | O         | T                | E            | T         | O   |
| Polar       | O         | T                | E            | T         | O   |
| Tundra      | O         | T                | E            | T         | O   |
| Continental | O         | T                | E            | T         | O   |
| Garden      | O         | T                | O            | T         | O   |
| Elegant     | O         | T                | E            | T         | O   |
| Meadow      | O         | T                | O            | T         | O   |
| Modern      | O         | T                | E            | T         | O   |
| Marine      | O         | T                | O            | T         | O   |
| Archipelago | O         | T                | E            | T         | O   |
| High Plains | O         | T                | E            | T         | O   |
| Sandstorm   | O         | T                | E            | T         | O   |
| River       | O         | T                | E            | T         | O   |
| Monsoon     | O         | T                | E            | T         | O   |
| Savanna     | O         | T                | E            | T         | O   |
| Sun         | O         | T                | E            | T         | O   |
| Ocean       | O         | T                | E            | T         | O   |
| Jungle      | O         | T                | E            | T         | O   |
| Fancy       | T         | O                | E            | T         | U   |
| Poké Ball   | T         | T                | E            | T         | U   |

ORAS, Sun/Moon and HOME are T for all patterns. Import-dependent breeding does not remove the
external acquisition requirement. Pre-Gen-6 games, Let's Go, Sword/Shield, BDSP and Legends: Arceus
are unavailable. These species-level exclusions follow the
[main availability table](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability).

The [form reference](<https://bulbapedia.bulbagarden.net/wiki/Vivillon_(Pok%C3%A9mon)#Form_data>)
establishes the regional 3DS patterns, native Fancy in S/V, Meadow in Lumiose, and Garden in
Hyperspace Lumiose. For S/V, the user explicitly requested T for GO postcard-dependent patterns,
including encounters shared through Union Circle. Poké Ball requires import. This is a dataset
simplification of the acquisition dependency, not a claim that postcards directly transfer Pokémon.

Marine in Z-A comes from evolving the
[museum's Spewpa reward](https://bulbapedia.bulbagarden.net/wiki/Lumiose_Museum#Pokémon_Legends:_Z-A).
The permanent side quest counts as ordinary acquisition. The
[Champions roster](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_in_Pok%C3%A9mon_Champions)
lists High Plains as recruitable and the other patterns as transfer-only. Under the
[dataset field definitions](../reference/doc-7%20-%20Pok%C3%A9mon-availability-fields.md), all 20 patterns are T in Champions: High
Plains can also visit from HOME, but local recruits cannot be exported, as documented in the
[official connectivity rules](https://champions.pokemon.com/en-gb/pokemon/). This is a current
snapshot, not an assumption about eventual roster expansion.

In Legends: Z-A the other 17 patterns are E, at the product owner's request (2026-11-14): their only
routes in that game are the Mystery Gifts of the 2026 Vivillon campaign listed on
[Serebii's Legends: Z-A events page](https://www.serebii.net/legendsz-a/internetevents.shtml). A
Spewpa distributed from 29 October to 19 November 2026 evolves into one of 16 patterns (Polar,
Tundra, Continental, Elegant, Icy Snow, Modern, Archipelago, High Plains, Sandstorm, River, Monsoon,
Savanna, Sun, Ocean, Jungle or Fancy), and a Poké Ball Pattern Vivillon was the campaign reward from
6 November 2026 to 26 February 2027. Meadow, Garden and Marine keep their ordinary routes.

The older Fancy/Poké Ball distributions in other games follow **Ev → T**, not the in-game event category EV. Their old
overlapping XY acquisition fields are removed. The distribution history is recorded in
[Vivillon's event tables](<https://bulbapedia.bulbagarden.net/wiki/Vivillon_(Pok%C3%A9mon)#In_events>).

GO stays under its
[availability parser](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO).
The saved 2026-09-22 source releases the 18 regional patterns and explicitly lists Fancy/Poké Ball
as unreleased. A future GO release must come from that source, not this matrix's main-game rules.

Existing `storableIn` lists are preserved: ordinary patterns include GO; all 20 include supported
Gen 6/7 games, HOME, S/V, Z-A and Champions. Acquisition and storage remain separate. Future games
and unknown patterns stay unresolved until researched. Source links are documentation; the runtime
still fetches only the two availability lists.
