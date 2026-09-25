# Pokémon Box RS, My Pokémon Ranch and Pokémon Bank

Reviewed 2026-09-25. IDs are `boxrs` and `ranch`, both `series: storage`, following Bank/HOME. The
game index uses their first release dates: 2003-05-30 and 2008-03-25 respectively.

Store delisting and required-service shutdown are separate metadata; see
[game lifecycle dates](../game-lifecycle.md) for the verified Bank and Ranch cutoffs.

## Box RS

[Box's compatibility and bonus Eggs](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Box_Ruby_%26_Sapphire)
establish 25 boxes of 60, connectivity with R/S/E/FR/LG, and four permanent gifts: Swablu,
Zigzagoon, Skitty and Pichu. These are `obtainableIn`; their evolved relatives require imports. Eggs
hatch on the connected cartridge. Playing that cartridge through Box's emulator does not reclassify
its encounters as Box-native.

All 386 species and all 28 Unown forms are supported. Box uses
[RS personal data and PK3 slots](https://github.com/kwsch/PKHeX/blob/master/PKHeX.Core/Saves/SAV3RSBox.cs).
[Gen III's form representation](https://github.com/kwsch/PKHeX/blob/master/PKHeX.Core/PKM/Shared/G3PKM.cs)
persists Unown through personality data, but no alternate Deoxys form. Consequently only Normal
Deoxys is modeled in Box. Castform weather states are temporary battle forms.

`national-boxrs` contains 413 entries: 386 species and 27 additional Unown letters/symbols. It omits
separate cosmetic female appearances, matching the pre-Gen-IV national checklists. `storableIn`
still includes the corresponding female records because Gen III stores gender, following the
dataset's explicit female-record convention.

## Ranch

[Ranch's release and connectivity](https://bulbapedia.bulbagarden.net/wiki/My_Pok%C3%A9mon_Ranch)
and the [Platinum update](https://www.serebii.net/ranch/platinum.shtml) define the single `ranch`
entry. Its 1,500-place capacity and Platinum compatibility require the Japan-only update released
2008-11-05. Other regions have 1,000 places and D/P connectivity. Withdrawals require the original
depositing save, so storage membership does not imply unrestricted transfers.

The update supports all five Rotom appliances and Origin Giratina holding its Griseous Orb. Rotom's
appliance survives storage but reverts on withdrawal. Sky Shaymin appears after touching the
Gracidea toy only during that visit; this is form availability, not persistent storage. Sunshine
Cherrim is likewise a display transformation. The
[Ranch executable research](https://gist.github.com/quatric/44f12ed57b128aa25b12d2fa2926530e)
describes its clock-dependent model and Castform's forced Normal model. That research uses a fan
localization of the update, so it is corroborating implementation evidence, not a live test of an
official Japanese release.

`national-ranch` contains 646 entries: 493 species and 153 additional forms/gender records,
including the visit-only transformations. Persistent storage has 644 exact records. Later forms and
the later female Eevee tail appearance are excluded from both services.

[Hayley's trades](https://bulbapedia.bulbagarden.net/wiki/Hayley%27s_trades) provide 22 permanent,
non-shiny rewards and five historical guest trades. Permanent rewards use `obtainableIn` and
`shinyLockedIn`; the guest trades use `eventOnlyIn`. All other supported records require imports.
The
[PKHeX Ranch gift table](https://github.com/kwsch/PKHeX/blob/master/PKHeX.Core/Legality/Encounters/Data/Gen4/Encounters4DPPt.cs)
confirms exact forms/genders, notably East Sea Shellos and female Combee, Pachirisu and Finneon. The
five guest rewards are female Octillery, Flygon, Meowth, Slaking and Metagross. Hayley's untradeable
residents do not count as ordinary acquisition.

## Bank acquisition completeness

Bank's original integration populated `storableIn` without any acquisition fields, leaving consumers
that use `obtainableIn` / `transferOnlyIn` / `eventOnlyIn` unable to classify its supported Pokémon.

[Bank's compatibility and restrictions](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Bank#Restrictions)
establish transfers from the compatible Gen VI/VII games and Poké Transporter. The CLI now models
that route independently of saved arrays, with an explicit whitelist of persistent alternate forms.
It excludes held-item forms, battle transformations, fusions, Furfrou trims, Sky Shaymin, and forms
without a 3DS route. Hoopa Unbound from Gen VII remains supported. Meltan/Melmetal and Original
Color Magearna are excluded despite their species-generation metadata. The `eevee-f` tail appearance
also postdates Bank's games; its old Bank storage entry was removed without changing other games.

Of the 1,032 supported exact records, 1,019 use `transferOnlyIn`. The other 13 use `eventOnlyIn` for
[Bank's historical gift distributions](https://www.serebii.net/bank/events.shtml): Celebi; Meganium
(male and female records), Typhlosion and Feraligatr; Regirock, Regice and Registeel; Decidueye,
Incineroar and Primarina; Oranguru and Passimian. These time-limited Bank rewards are delivered into
the connected games through Pokémon Link or Mystery Gift. They are historical service-origin events,
not ordinary native encounters; their availability is retained after the distribution windows close.
The female Meganium record is included because the gift's gender is random. No Hisuian form or
pre-evolution inherits one of these rewards. The Mewnium Z distribution supplies an item, not Mew.

## Maintenance and artwork

`storage-game-availability.ts` applies these rules during main-source CLI reviews, after existing
storage inheritance. GO-only reviews preserve them. National checklists are derived from the full
National Pokédex, retain its slot flags and numbering, and are separate from storage membership. The
focused regression suite checks exact forms, rewards, chronological registration and all saved
service classifications against an offline CLI review.

Square tiles, 128 × 128 PNG icons, original images and source/prompt manifests are collected in the
ignored local directory `.local/imgs/`. The Box tile and both icons use AI-generated/refined
artwork; the Ranch tile remains the sourced original because its AI refinement was rejected by the
image tool. They are not published by the dataset package. The CDN targets are
`images/games/gametiles/{boxrs,ranch}.webp` and `images/games/icons/{boxrs,ranch}.png`.
