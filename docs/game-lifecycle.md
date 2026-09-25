# Game lifecycle dates

Game records support these fields in order, immediately before `region`:

| Field            | Meaning                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `releaseDate`    | Existing first-release calendar date.                                                                                                                                                    |
| `delistedDate`   | Announced end of new digital purchases/downloads. Does not mean existing owners lose redownloads or offline play.                                                                        |
| `serviceEndDate` | Announced shutdown of the online service required to use the game itself. Does not describe a storefront or the loss of optional multiplayer, events or other ancillary online features. |

The two lifecycle fields accept `YYYY-MM-DD`, `null`, or omission. Null/omitted means no applicable
date is recorded: unknown, unannounced and not applicable are not distinguished. It does not prove
that a game is currently available or supported. Announced future dates are valid; consumers must
compare them with the current date before presenting a game as retired.

For the new fields, use the UTC calendar date when an official cutoff time is available. Otherwise
use the official announced calendar date and document its regional scope. These are day-level
metadata, not exact cutoff timestamps. A single date does not model every platform or regional
storefront; document any exceptions rather than inferring them from another release.

Lifecycle metadata does not remove historical acquisition routes, Pokédex entries, `storableIn`, or
feature flags. Those fields describe compatibility and established routes, not current service
status. `Pkds.Game` and the generated OpenAPI Game schema expose both optional fields.

## Storage services

Verified 2026-09-25:

| Game    | `delistedDate` | `serviceEndDate` |
| ------- | -------------- | ---------------- |
| `bank`  | `2023-03-28`   | `2027-02-26`     |
| `ranch` | `2019-01-31`   | `null`           |
| `home`  | `null`         | `null`           |
| `boxrs` | `null`         | `null`           |

- **Bank delisting:**
  [Nintendo's eShop notice](https://support.nintendo.com/jp/information/2022/0216.html) specifies
  2023-03-28 at 09:00 JST, or 00:00 UTC. North American notices call this March 27. New downloads
  ended separately from Bank's ongoing service.
- **Bank shutdown:**
  [The Pokémon Company's announcement](https://www.pokemon.co.jp/info/2022/02/220216_gm01.html)
  specifies 2027-02-26 at 12:00 JST, or 03:00 UTC.
  [Nintendo's US notice](https://en-americas-support.nintendo.com/app/answers/detail/a_id/61543/)
  gives the same instant as February 25 at 19:00 PST. Deposits, withdrawals and transfers to HOME
  end then; this remains a scheduled future shutdown as of the review date.
- **Ranch delisting:**
  [Nintendo's Wii Shop schedule](https://support.nintendo.com/jp/information/2018/0809.html) allows
  purchases through 2019-01-31 at 14:59 JST (05:59 UTC). The cutoff is January 31 in UTC; North
  American notices use January 30. The
  [Wii Shop FAQ](https://en-americas-support.nintendo.com/app/answers/detail/a_id/27560/)
  distinguishes new purchases from redownloading and continued play. Ranch stores Pokémon locally
  and communicates locally with DS cartridges, so shop closure is not a shutdown of its core storage
  functionality. Its ancillary WiiConnect24 functions are outside `serviceEndDate`.
- **HOME** has no announced lifecycle cutoff recorded. **Box RS** is an offline physical release, so
  these digital-service dates do not apply. Do not infer a retirement date from retail scarcity.
