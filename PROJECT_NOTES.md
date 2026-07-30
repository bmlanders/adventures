# Project notes

Context for anyone (or any Claude session) picking this up. The user-facing
guide is [README.md](README.md); this file is the working history, the design
rules, and the traps.

## What this is

"Landers On Tour" — Brendan and Jen's family trip archive. Jekyll on GitHub
Pages, no backend, no hosting cost. Live at
<https://bmlanders.github.io/adventures/>. Deliberately unlisted: `robots.txt`
disallows everything and every page carries `noindex, nofollow`. Not secret,
just not indexed.

## Working rules

**Edit this repo directly.** An earlier session worked in a separate scratch
folder and copied files in, which was pure overhead and a chance to clobber
things. Clone, edit, commit, push.

**Preview before pushing.** `node tools/preview/server.js` then look at it in a
browser. `node tools/preview/check.js` catches template and contrast problems
without a browser. Do both; a bug that only shows up rendered (the sticky nav
one below) will not show up in the markup.

**Hard-refresh after deploying.** GitHub Pages rebuilds in roughly 20 to 60
seconds, and browsers hold onto `main.css` aggressively. Something looking
broken right after a push is usually a stale stylesheet. Confirm with
`curl -s <css-url> | grep <rule>` before believing it's a real bug.

**No em dashes in copy, and keep the tone human.** A standing preference of
the user's. Applies to site copy, not code comments.

## Design direction

The palette is **Boston Celtics green and gold, as an Irish theme**. This is
identity, not decoration: the user is 100% Irish and said the culture is a big
part of who he is. Lean into genuine Celtic and Irish motifs rather than
generic outdoorsy styling.

| Token | Value | Notes |
|---|---|---|
| `--green` | `#007A33` | Official Celtics green |
| `--gold` | `#BA9653` | Official Celtics gold |
| `--gold-deep` | `#7A5C1F` | Darkened so gold-on-gold text clears AA |
| `--live` | `#A34310` | Irish tricolour orange, darkened for AA |
| `--paper` | `#FAF7EF` | Warm Irish linen |
| `--ink` | `#0C120E` | Near-black with a green cast |

Official Celtics green and gold are *not* accessible at small sizes on light
backgrounds. The darkened variants exist for that reason — don't "fix" them
back to the brand values. `check.js` will fail if you do.

Dark hero bands carry a **Celtic knotwork interlace** (`--knot`, an inline SVG
data URI) plus a fine grain overlay. Type is Fraunces for display, Inter for
everything else.

### Components in `assets/css/main.css`

`.facts` logistics table · `.stop` numbered route stop with `.cat` chip
(`.cat.beer` for gold) and `.order` for what to get · `.places` pills for
what-to-see lists · `.tip` gold callout · `.tonight` dinner-and-show pair
(`.tonight.single` for a show alone) · `.recs`/`.rec` recommendation grid ·
`.photo-link` tap-through card for photo albums and maps · `.quote` pull quote
· `.sign-off` per-day closer · `.trip-map` the Leaflet route map (see below).

### Trip route map

Every trip's layout (`_layouts/trip.html`) renders a `.trip-map` under the
hero if the trip's front matter has a `map:` list. Leaflet + OpenStreetMap
tiles via cdnjs, no API key, no backend — one marker per waypoint, a dashed
line connecting them in the order listed (or just a centered marker if
there's only one). `default.html` only loads the Leaflet CSS when
`page.map` is set, so pages without a map don't pay for it.

Coordinates are deliberately **city or place level**, hand-picked from
general geographic knowledge, not a geocoding API — there's no key for one
and no backend to call it from. Good enough to show the shape of a route
(Lisbon to Porto, island to island in the Grenadines); not meant to pin an
exact restaurant. Keep new trips' `map:` entries at that same precision
rather than guessing a specific street address.

## Trips

| Slug | Trip | Status |
|---|---|---|
| `maui-2018` | A week in Maui, family trip, July | complete, stub |
| `punta-mita-2024` | 25th anniversary, Punta Mita, June | complete, stub |
| `portugal-2025` | Ten days, Lisbon → Aveiro → Porto | complete |
| `isbell-radio-city-2026` | Jason Isbell at Radio City, Feb 20–21 | complete |
| `vegas-2026` | The Sphere and The Palazzo, April | complete, stub |
| `rhythm-sails-2026` | Sailing charter, St. Vincent, May | complete |
| `nyc-2026` | Goose at MSG, two nights, June | complete |
| `pnw-2026` | Goose and Greensky, Pacific Northwest, August | upcoming |

Every trip file must keep all four marker comments (`DAYS_START`, `DAYS_END`,
`MEMORIES_START`, `MEMORIES_END`) — the admin page finds them to know where to
insert. `check.js` verifies this.

`vegas-2026`, `maui-2018`, and `punta-mita-2024` are still stubs: dates,
route, and (for the first two) a linked photo album, but no day-by-day
itinerary since there wasn't one to import.

## Traps and findings

**Google Photos cannot be embedded.** Tested in a live iframe: Google returns
a hard 403 by design. Albums render as `.photo-link` tap-through cards
instead. Also worth knowing: a Google Photos share link is "anyone with the
link", so a card versus a click-through is the same exposure either way.

**Custom domain needs `baseurl: ""`.** Currently `/adventures` because the
site is served from a subfolder. On a custom domain it serves from the root
and every stylesheet and link 404s unless `baseurl` is emptied. Change it
*last*, after DNS resolves — otherwise the github.io URL breaks in the
meantime. Full walkthrough is in the README.

**PDF import is heuristic.** `assets/js/pdf-import.js` is shared by the admin
page and `tools/preview/dump-pdf.js` so there's one copy to fix. Real PDFs
found three bugs worth not reintroducing:

- `MAY 2026` parsed as May *20th*, taking digits out of the year. Strip the
  year before looking for a day number.
- Time ranges crossing noon inverted the meridiem: `9:30-12:30pm` became
  9:30 PM. `halfIndex()` handles the 12-then-1..11 ordering.
- Bare times glued onto running page headers, giving entries like
  `12:00 PM | TONIGHT`. `looksLikeDescription()` guards that.

Simple one-column PDFs import well. Heavily designed multi-column ones pair
some times with the wrong text, because the time badges don't share a baseline
with their descriptions. It saves typing; it is not a parser. Always review
the parsed itinerary box before saving.

**Sticky day-nav needs an opaque background.** It's `position: sticky` with no
card behind it, so without a background band the page text shows through the
gaps between pills while scrolling.

## Deploying

Push to `main`; GitHub Pages builds automatically. Git Credential Manager's
popup and device-code flows both failed on the machine this was built on;
pushing from the GitHub Desktop clone worked. If a push seems to hang, check
whether it actually landed before retrying:

```bash
git ls-remote https://github.com/bmlanders/adventures.git refs/heads/main
```

Never handle the user's GitHub token. The admin page's whole security model is
that the token stays in their browser's localStorage and only ever talks to
GitHub.

## Not yet verified

**The admin save round-trip has never been tested end to end.** It needs the
user's personal access token, which no assistant should hold. The unverified
path: open `/adventures/admin/`, connect, add a memory, confirm it appears.
The underlying GitHub API code is unchanged from a working earlier version,
but nobody has run it since the redesign.

## Ideas not yet built

- Photo albums for Portugal and the other trips, once links exist.
- A custom domain (`landersontour.com` looked available).
- Filling in `vegas-2026`.
- Letting the admin page edit an existing trip's front matter. Right now
  dates and titles can only be fixed by editing the file, which is why the
  Isbell trip needed a manual rename.
