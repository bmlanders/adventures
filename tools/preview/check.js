// Renders every page through the same pipeline the preview server uses, so
// Liquid/front-matter errors surface without needing a browser. Also checks
// the palette's text/background pairs against WCAG AA.
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const { Liquid } = require('liquidjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SITE_DIR = process.argv[2] || REPO_ROOT;
const engine = new Liquid({ extname: '.html' });
engine.registerFilter('relative_url', (v) => (!v ? '/' : v.startsWith('/') ? v : '/' + v));

function loadTrips() {
  const dir = path.join(SITE_DIR, '_trips');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const slug = f.replace(/\.md$/, '');
    const { data, content } = matter(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { ...data, slug, url: `/trips/${slug}/`, content_raw: content };
  });
}

const cfg = { ...yaml.load(fs.readFileSync(path.join(SITE_DIR, '_config.yml'), 'utf8')), baseurl: '' };

async function renderLayout(page, inner, layoutName) {
  const layout = matter(fs.readFileSync(path.join(SITE_DIR, '_layouts', `${layoutName}.html`), 'utf8'));
  const html = await engine.parseAndRender(layout.content, {
    site: { ...cfg, trips: loadTrips() }, page, content: inner,
  });
  if (layout.data.layout && layout.data.layout !== layoutName) return renderLayout(page, html, layout.data.layout);
  return html;
}

(async () => {
  let failures = 0;

  // ---- render every page ----
  const targets = [{ label: 'index', file: path.join(SITE_DIR, 'index.html'), layout: 'default' }];
  for (const f of fs.readdirSync(path.join(SITE_DIR, '_trips'))) {
    if (f.endsWith('.md')) targets.push({ label: `trip:${f}`, file: path.join(SITE_DIR, '_trips', f), layout: 'trip' });
  }

  for (const t of targets) {
    try {
      const { data, content } = matter(fs.readFileSync(t.file, 'utf8'));
      const page = { ...data, content };
      const inner = await engine.parseAndRender(content, { site: { ...cfg, trips: loadTrips() }, page });
      const html = await renderLayout(page, inner, data.layout || t.layout);
      // sanity: unrendered Liquid left behind, or stray markers
      const leftover = html.match(/\{\{|\{%/g);
      console.log(`OK   ${t.label}  (${html.length} bytes)${leftover ? '  !! leftover Liquid: ' + leftover.length : ''}`);
      if (leftover) failures++;
    } catch (e) {
      console.log(`FAIL ${t.label}: ${e.message}`);
      failures++;
    }
  }

  // ---- front matter sanity ----
  console.log('\n--- front matter ---');
  for (const tr of loadTrips().sort((a, b) => String(a.sort_date).localeCompare(String(b.sort_date)))) {
    const missing = ['title', 'status', 'dates', 'sort_date', 'route', 'blurb'].filter((k) => !tr[k]);
    console.log(`${tr.slug.padEnd(20)} ${String(tr.sort_date).slice(0, 10).padEnd(12)} ${String(tr.status).padEnd(9)} ${tr.dates}${missing.length ? '  !! missing: ' + missing : ''}`);
    if (missing.length) failures++;
  }

  // ---- marker integrity (admin page depends on these) ----
  console.log('\n--- admin markers ---');
  for (const f of fs.readdirSync(path.join(SITE_DIR, '_trips'))) {
    if (!f.endsWith('.md')) continue;
    const src = fs.readFileSync(path.join(SITE_DIR, '_trips', f), 'utf8');
    const need = ['<!-- DAYS_START -->', '<!-- DAYS_END -->', '<!-- MEMORIES_START -->', '<!-- MEMORIES_END -->'];
    const miss = need.filter((m) => !src.includes(m));
    console.log(`${f.padEnd(26)} ${miss.length ? '!! MISSING ' + miss.join(', ') : 'all four present'}`);
    if (miss.length) failures++;
  }

  // ---- contrast ----
  const lum = (hex) => {
    const c = hex.replace('#', '');
    const v = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
      .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  const css = fs.readFileSync(path.join(SITE_DIR, 'assets/css/main.css'), 'utf8');
  const tok = {};
  for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)) tok[m[1]] = m[2];

  const pairs = [
    ['body text', 'ink', 'paper'], ['muted text', 'stone', 'paper'],
    ['link/green on card', 'green', 'card'], ['entry time on card', 'green', 'card'],
    ['upcoming pill', 'upcoming', 'gold-soft'], ['live pill', 'live', 'live-soft'],
    ['rec category chip', 'green', 'green-pale'], ['tip label', 'gold-deep', 'gold-soft'],
    ['btn label', 'card', 'green'], ['soft body text', 'ink-soft', 'card'],
    ['stone on card', 'stone', 'card'],
  ];
  console.log('\n--- contrast (AA needs 4.5 normal / 3.0 large) ---');
  for (const [label, fg, bg] of pairs) {
    if (!tok[fg] || !tok[bg]) { console.log(`?    ${label}: token missing (${fg}/${bg})`); failures++; continue; }
    const r = ratio(tok[fg], tok[bg]);
    const ok = r >= 4.5;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'LOW '} ${label.padEnd(22)} ${tok[fg]} on ${tok[bg]}  ${r.toFixed(2)}:1`);
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' issue(s) found'}`);
})().catch((e) => { console.error(e); process.exit(1); });
