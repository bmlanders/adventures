# Local preview

GitHub Pages builds this site with Jekyll, which needs Ruby. If Ruby isn't
installed (it isn't, on the machine this was built on), these Node scripts
render the real `_trips/`, `_layouts/`, and `_config.yml` well enough to
preview and validate changes locally.

They are a **development convenience, not the build**. GitHub Pages is still
the thing that actually builds the site. If a page renders here it will
almost certainly render there, but Pages is the source of truth.

## Setup, once

```bash
cd tools/preview
npm install
```

## Preview the site

```bash
node tools/preview/server.js
```

Then open <http://localhost:4000>. It serves the homepage, every trip at
`/trips/<slug>/`, and the admin page at `/admin/`. Edit any file and reload;
there's no build step to re-run.

Note `baseurl` is forced to empty here, so local URLs have no `/adventures`
prefix even though the live site does.

## Validate without a browser

```bash
node tools/preview/check.js
```

Renders every page (catching Liquid and front-matter errors), confirms each
trip still has all four `DAYS_START` / `MEMORIES_START` marker comments that
the admin page writes into, and checks every text-on-background colour pair
in the palette against WCAG AA. Useful as a fast pre-commit check.

## Inspect a trip PDF

```bash
node tools/preview/dump-pdf.js "path/to/itinerary.pdf"
```

Prints the reconstructed text lines exactly as `assets/js/pdf-import.js`
sees them, then what the importer would guess. Handy for working out why a
particular PDF imports badly. Needs the optional `pdfjs-dist` dependency.
