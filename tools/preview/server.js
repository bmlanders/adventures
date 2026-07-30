// Minimal Jekyll-lite preview server — mimics just enough of Jekyll's
// rendering (collections, layouts, front matter, a handful of Liquid
// filters) to preview this specific site live without Ruby installed.
const express = require('express');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const { Liquid } = require('liquidjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SITE_DIR = process.argv[2] || REPO_ROOT;
const PORT = process.argv[3] || 4000;

const engine = new Liquid({ extname: '.html' });

// relative_url: for local preview, baseurl is "" so this is a no-op join.
engine.registerFilter('relative_url', (v) => {
  if (!v) return '/';
  return v.startsWith('/') ? v : '/' + v;
});

function loadConfig() {
  const raw = fs.readFileSync(path.join(SITE_DIR, '_config.yml'), 'utf8');
  const cfg = yaml.load(raw);
  cfg.baseurl = ''; // local preview serves from root
  return cfg;
}

function loadTrips() {
  const dir = path.join(SITE_DIR, '_trips');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  return files.map((f) => {
    const slug = f.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const { data, content } = matter(raw);
    return { ...data, slug, url: `/trips/${slug}/`, content_raw: content };
  });
}

function loadLayout(name) {
  const raw = fs.readFileSync(path.join(SITE_DIR, '_layouts', `${name}.html`), 'utf8');
  return matter(raw); // { data, content }
}

async function renderWithLayout(cfg, page, innerHtml, layoutName) {
  const layout = loadLayout(layoutName);
  const html = await engine.parseAndRender(layout.content, {
    site: { ...cfg, trips: loadTrips() },
    page,
    content: innerHtml,
  });
  // layouts can themselves declare a parent layout via front matter
  if (layout.data.layout && layout.data.layout !== layoutName) {
    return renderWithLayout(cfg, page, html, layout.data.layout);
  }
  return html;
}

async function renderPage(cfg, filePath, defaultLayout) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  const page = { ...data, content };
  const inner = await engine.parseAndRender(content, {
    site: { ...cfg, trips: loadTrips() },
    page,
  });
  const layoutName = data.layout || defaultLayout;
  if (!layoutName) return inner;
  return renderWithLayout(cfg, page, inner, layoutName);
}

const app = express();

app.get('/', async (req, res) => {
  try {
    const cfg = loadConfig();
    const html = await renderPage(cfg, path.join(SITE_DIR, 'index.html'), 'default');
    res.set('Content-Type', 'text/html').send(html);
  } catch (e) {
    res.status(500).send(`<pre>${e.stack}</pre>`);
  }
});

app.get('/trips/:slug/', async (req, res) => {
  try {
    const cfg = loadConfig();
    const filePath = path.join(SITE_DIR, '_trips', `${req.params.slug}.md`);
    if (!fs.existsSync(filePath)) return res.status(404).send('Trip not found');
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(raw);
    const page = { ...data, content, url: `/trips/${req.params.slug}/` };
    const inner = await engine.parseAndRender(content, {
      site: { ...cfg, trips: loadTrips() },
      page,
    });
    const html = await renderWithLayout(cfg, page, inner, data.layout || 'trip');
    res.set('Content-Type', 'text/html').send(html);
  } catch (e) {
    res.status(500).send(`<pre>${e.stack}</pre>`);
  }
});

app.get('/admin/', async (req, res) => {
  const candidates = [
    path.join(SITE_DIR, 'admin', 'index.html'),
    path.join(SITE_DIR, 'admin.html'),
  ];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) return res.status(404).send('Admin page not found');
  res.set('Content-Type', 'text/html').send(fs.readFileSync(filePath, 'utf8'));
});

app.use('/assets', express.static(path.join(SITE_DIR, 'assets')));

app.listen(PORT, () => {
  console.log(`Preview serving ${SITE_DIR}`);
  console.log(`→ http://localhost:${PORT}/`);
});
