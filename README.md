# Landers On Tour

A GitHub Pages site that archives every trip — plans before you leave, updates while you're
on the road, memories after. Built with Jekyll, which GitHub Pages runs for free, automatically,
every time you push a change.

## 1. Get it on GitHub (10 minutes, one time)

1. Create a new repo at github.com — name it something like `trips` or `landers-on-tour`.
   Public repo (required for free Pages hosting), but nothing links to it and search engines
   are told to ignore it (see `robots.txt`), so it's effectively unlisted.
2. Push these files into that repo (ask Claude Code to do this for you if you'd rather not
   use git commands directly).
3. In the repo, go to **Settings → Pages**. Under "Build and deployment," set Source to
   **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. Wait ~1–2 minutes, then your site is live at `https://<your-username>.github.io/<repo-name>/`.
   Bookmark that URL for the family.

## 2. Adding a new trip

Copy `_trips/pnw-2026.md`, rename it (e.g. `_trips/tahoe-2027.md`), and edit the front matter
at the top (title, dates, status, blurb). Add day blocks in the same `<div class="day-block">`
pattern. Push — the site rebuilds itself.

`status` controls the little badge on the homepage: `upcoming`, `live` (turns the stripe green
while you're actively on the trip), or `complete`.

## 3. Updating live from your phone

Install the **GitHub mobile app** (iOS/Android), sign into your account, and open this repo.
You can:
- Edit any trip's `.md` file directly and add a line under "Memories" — commit, and it's live
  in about a minute.
- Add a photo: tap into `photos/pnw-2026/` (or the matching folder for whichever trip) →
  "Add file" → upload from your camera roll.
  Then reference it in that trip's Memories section: `![](../photos/pnw-2026/yourfile.jpg)`

This is deliberately low-friction — no separate app, no login beyond GitHub itself, works from
any phone. You won't post every day and that's fine; the plan content is already there whether
you touch it or not.

## 4. Local preview (optional, only if you want to see changes before pushing)

Requires Ruby installed once:
```
bundle install
bundle exec jekyll serve
```
Then open `http://localhost:4000`.

## 5. What's here

```
_config.yml       site settings
_trips/           one file per trip — this is the whole archive
_layouts/         page templates (default + trip detail)
assets/css/       the navy/gold visual theme
robots.txt        keeps the site out of search engines
```
