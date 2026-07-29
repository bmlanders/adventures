# Landers On Tour

A GitHub Pages site that archives every trip — plans before you leave, updates while you're
on the road, memories after. Built with Jekyll (free, automatic via GitHub Pages) plus a
lightweight admin page that writes straight to this repo through GitHub's API — no server,
no database, no hosting bill.

## Updating the site (recommended: the admin page)

Go to `https://bmlanders.github.io/adventures/admin/` — bookmark it. From there you can add
memories, add itinerary days, and start brand-new trips, all from a form. It saves directly to
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
_config.yml       site settings (baseurl must stay "/adventures")
_trips/           one file per trip — the whole archive
_layouts/         page templates (default + trip detail)
assets/css/       the visual design
admin.html        the admin page — talks to GitHub's API from your browser
robots.txt        keeps the site out of search engines
```
