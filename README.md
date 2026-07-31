# Landers On Tour

A GitHub Pages site that archives every trip — plans before you leave, updates while you're
on the road, memories after. Built with Jekyll (free, automatic via GitHub Pages) plus a
lightweight admin page that writes straight to this repo through GitHub's API — no server,
no database, no hosting bill.

## Updating the site (recommended: the admin page)

Go to `https://bmlanders.github.io/adventures/admin/` — bookmark it (or your own domain, if
you've set one up; see "Using your own domain" below). From there you can add
memories, add itinerary days, start brand-new trips, log a show to the [concert log](https://bmlanders.github.io/adventures/shows/),
or edit a trip page's raw source directly, all from a form. It saves directly to
this repo and the site rebuilds itself within about a minute.

**One-time setup — create a GitHub token:**

1. Go to `github.com/settings/personal-access-tokens/new`
2. Under "Repository access," choose **Only select repositories** → pick `adventures`
3. Under "Permissions" → "Repository permissions," find **Contents** and set it to
   **Read and write**
4. Generate the token, copy it (starts with `github_pat_...`)
5. Paste it into the admin page's token field, click **Connect**

Treat this token like a password — it can edit this repo. It's saved only in your browser's
local storage (never sent anywhere but GitHub), so you only need to paste it once per device.
Because it's scoped to only this one repository, even if it ever leaked, nothing else in your
GitHub account is at risk. You can revoke or regenerate it anytime from that same Settings page.

**Adding photos:** Google Photos doesn't allow albums to be embedded directly on other sites,
so the admin page instead saves a link to the album — it shows up as a "View photos" button on
the trip page that opens the album in a new tab. In Google Photos: open the album → **Share** →
**Create link** → paste that link into the admin form.

**Logging a show:** doesn't need a whole trip, just artist, venue, and date. Setlists aren't
fetched automatically (no backend to call an API from, and most setlist sites block plain
requests anyway), so copy the song list from wherever you found it, one song per line, and
paste it into the "Setlist" field. A link to the source page is optional but nice to keep.

## Updating the site (manual / fallback)

Everything the admin page does, you can also do by hand on github.com — open a trip's `.md`
file in `_trips/`, click the pencil, edit directly. Just keep the `<!-- MEMORIES_START -->` /
`<!-- DAYS_START -->` comment markers intact — the admin page looks for those to know where to
insert new content.

## Adding a new trip manually

Copy any file in `_trips/`, rename it, and edit the front matter at the top (title, dates,
status, sort_date, route, blurb). `status` controls the badge: `upcoming`, `live` (while
you're actually on the trip), or `complete`.

## Local preview (optional)

Requires Ruby installed once:
```
bundle install
bundle exec jekyll serve
```
Then open `http://localhost:4000`.

## What's here

```
_config.yml       site settings (baseurl + url — see "Using your own domain")
_trips/           one file per trip — the whole archive
_layouts/         page templates (default + trip detail)
assets/css/       the visual design
admin/index.html  the admin page — talks to GitHub's API from your browser
robots.txt        keeps the site out of search engines
```

## Using your own domain

Right now the site lives at `bmlanders.github.io/adventures/`. You can point a real
domain at it (`landersontour.com`, or a subdomain like `trips.landersontour.com`) and
GitHub Pages will serve it there for free — you only pay the registrar for the domain
itself, usually $10–15/year. Nothing about the build, the admin page, or the hosting
changes.

**1. Buy the domain.** Any registrar works. Cloudflare and Porkbun sell close to cost;
Namecheap and Squarespace Domains are fine too.

**2. Tell GitHub about it.** In the repo: **Settings → Pages → Custom domain**, type the
domain, **Save**. That writes a `CNAME` file into the repo root, which is what makes it
stick across rebuilds.

**3. Point DNS at GitHub** (at your registrar, in their DNS panel):

*Simplest option — a subdomain* like `trips.landersontour.com`. One record:

| Type  | Name    | Value                  |
|-------|---------|------------------------|
| CNAME | `trips` | `bmlanders.github.io.` |

*Root domain* like `landersontour.com` needs four A records instead, because DNS doesn't
allow a CNAME at the root:

| Type | Name | Value             |
|------|------|-------------------|
| A    | `@`  | `185.199.108.153` |
| A    | `@`  | `185.199.109.153` |
| A    | `@`  | `185.199.110.153` |
| A    | `@`  | `185.199.111.153` |

Add a `CNAME` for `www` → `bmlanders.github.io.` as well so both spellings work.

**4. Update `_config.yml`.** This is the part that's easy to miss. With a custom domain
the site is served from the *root* of that domain, not from a `/adventures/` subfolder,
so `baseurl` has to become empty or every link and stylesheet will 404:

```yaml
baseurl: ""
url: "https://landersontour.com"
```

**5. Turn on HTTPS.** Once DNS resolves (minutes, occasionally up to a day), go back to
**Settings → Pages** and tick **Enforce HTTPS**. GitHub issues the certificate for free.

Then your admin bookmark becomes `https://landersontour.com/admin/`.

Two things worth knowing: the `repo:` value in `_config.yml` and the repository field on
the admin page still say `bmlanders/adventures` — those are the GitHub repo name, which a
domain doesn't change. And a custom domain doesn't make the site any more or less private
than it is now: it stays out of search engines because of `robots.txt` and the `noindex`
tag, but anyone who knows the URL can read it either way.

## Importing a trip from a PDF

On the admin page's "Start a new trip" step, you can drop in a PDF (a
confirmation packet, a run-of-show, an itinerary export) instead of typing
everything by hand. It's parsed entirely in your browser — the file itself
is never uploaded anywhere, only the text it finds gets used to prefill the
form. It'll take its best guess at a title, dates, route, and a day-by-day
itinerary; always read over the "Parsed itinerary" box before clicking
**Create trip**, since it's pattern-matching on text layout, not actually
understanding the document.
