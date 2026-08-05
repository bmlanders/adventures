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
· `.sign-off` per-day closer · `.trip-map` the Leaflet route map (see below)
· `.show-entry`/`.setlist` concert log cards (see "Shows" below).

### Shows (`/shows/`)

A running concert log, separate from `_trips` since not every show has a
whole trip built around it. `shows/index.html` is a single page (not a
collection) with `<!-- SHOWS_START -->`/`<!-- SHOWS_END -->` markers, same
prepend-on-save pattern as a trip's Memories section. The admin page's "Log a
show" step writes `.show-entry` blocks there: artist, venue, date, optional
notes, an optional link back to a related trip (embeds a literal
`{{ '/trips/SLUG/' | relative_url }}` Liquid tag in the generated HTML, same
trick the "Start a new trip" flow uses for its admin-page link), an optional
pasted setlist (one song per line, rendered as a two-column numbered list,
no attempt to detect set breaks or encores), and an optional link out to the
source (setlist.fm, elgoose.net, etc.).

Setlists are pasted in by hand, not fetched live. A real integration would
need an API key and a backend to call it from (this site has neither), and a
plain `fetch()` to most setlist sites gets blocked by their bot protection
even with a key. elgoose.net specifically 403s a bare fetch but loads fine
in an actual browser, so pulling one over is a copy/paste-assisted job, not
an automated one.

**Quick-add.** A floating `+` button on `/shows/` itself opens a small modal
for when the full admin form is more than you need, especially for shows
that came from someone else buying the tickets so there's no confirmation
email to work from. Three fields: band, date, setlist. Band is an
`<input list>` against a datalist built by scraping this page's own
`.show-entry h3` elements at open time, native dropdown-plus-free-text, no
separate list to maintain and no custom combobox. Rule is (band AND date) OR
setlist: paste only a setlist and it tries to infer the other two, a date
regex (`Month D, YYYY` / ISO / `M/D/YYYY`) and a band match against that
same known-bands list. Band inference can only recognize a band that's
already been logged before; it can't invent one from unstructured text, so
a genuinely new band still needs to be typed in. Reuses whatever token is
already in `localStorage` from the admin page rather than asking again;
if there isn't one, it says so and points at `/admin/`.

**Setlist by link, not just pasted text.** The setlist field also accepts a
URL. A bare cross-origin `fetch()` to another site is blocked by CORS from
this page's own origin (confirmed directly: phantasytour.com refuses it
outright), so links go through `r.jina.ai`, a free public reader proxy with
permissive CORS, fetched server-side, no key needed. It only ever sees
what's in the *initial* server-rendered HTML, not anything a page loads in
afterward with its own JS:

- **phantasytour.com** — works well, fully server-rendered. Parses the
  `# {Band} Show • {Date}` heading and the numbered `Set N:`/`Encore:` list.
- **setlist.fm** — works well too, different markup (`# **[Band](…) Setlist**`
  heading, a `_{Date} Setlist_` string, numbered list with segues marked
  `(->)`/`(>)` as separate tokens rather than inline arrows). Both parsers
  run in sequence; whichever matches wins.
- **elgoose.net** — confirmed broken, on both a query-filtered URL and a
  show's own permalink. Its setlist body loads in dynamically after the
  page renders, so the proxy's snapshot never contains it, only the nav
  chrome. The tool detects the elgoose.net hostname specifically and says
  so rather than failing with a generic error.
- Any other site: falls back to the same loose date-regex/known-band
  matching the plain-text-paste path already used, no attempt at a setlist
  since there's no known structure to trust.

**Adding the same show twice updates it instead of duplicating it.** Both
the link path and manual entry compute the same `id` (`date-slugified-band`)
either way, so saving finds a `.show-entry` with that id first
(`findEntryBlock`, depth-counts `<div>`/`</div>` rather than a naive regex,
since a `.setlist` block nests one level deep) and merges the new setlist
and source link into the existing card instead of prepending a new one.

The helper functions here (`ghGet`/`ghPut`/`insertIntoMarkers`/etc.) are
deliberately duplicated from admin/index.html rather than pulled into a
shared module. The admin round-trip had just been confirmed working
end-to-end for the first time; refactoring it to share code with a brand
new feature felt like the wrong moment to introduce risk to something that
finally worked. Worth revisiting if a third page ever needs the same logic.

**New shows insert in date order, not at the top.** First real use of the
quick-add tool put a June 2025 show above a December 2026 one, a plain
prepend, same bug shape as the original "Log a show" admin form. Fixed in
both places with `insertShowSorted`: since every id starts with
`YYYY-MM-DD`, it walks the existing entries and inserts right before the
first one whose id-date is the same day or older, so the list stays sorted
without needing to parse the human-readable `.show-date` text at all.
`insertIntoMarkers` (used for memories/days elsewhere) is untouched; this
is shows-specific.

**Filters and a stats strip on `/shows/`, entirely client-side.** Three
selects, band/year/state, populate from the page's own rendered
`.show-entry` elements (band from `h3`, year from the leading 4 digits of
`id`, state from the trailing `, XX` on `.show-venue`, when there is one)
and just toggle `display:none` on the ones that don't match, no page
reload. The compact stats (`Shows`/`Bands`/`States`) reuse the homepage's
`.masthead .stats` styling, now shared with `.trip-hero .stats` since this
page uses that hero, and recompute from whatever's currently visible, so
they reflect the active filters, not just the full list. Quick-add-only
entries with no venue (that form never collects one) simply don't count
toward any state; that's expected, not a bug to chase.

`shows/index.html` needs its own route in `tools/preview/server.js` and its
own entry in `check.js`'s render targets — it isn't picked up by the trips
loop since it isn't a collection file.

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

## Verified

**The admin save round-trip works.** Confirmed 2026-07-31: the user logged a
real show (Goose, MSG, June 19) from `/adventures/admin/` with their own
token, and it landed as a real commit on `main`. Covers connect, ghGet/ghPut,
and the prepend-into-markers logic, at least for the "Log a show" form; the
memory/day/new-trip/edit-page forms share the same helpers so there's no
reason to think they'd behave differently, but only "Log a show" has
actually been exercised by a human with a token.

## Ideas not yet built

- Photo albums for Portugal and the other trips, once links exist.
- A custom domain (`landersontour.com` looked available).
- Filling in `vegas-2026`.
- Letting the admin page edit an existing trip's front matter. Right now
  dates and titles can only be fixed by editing the file, which is why the
  Isbell trip needed a manual rename.
