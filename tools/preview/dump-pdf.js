// Dump reconstructed visual lines from any PDF, using the shipped parser's
// line reconstruction so what I read matches what the importer would see.
const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
globalThis.pdfjsLib = pdfjsLib;
const REPO_ROOT = require('path').resolve(__dirname, '..', '..');
new Function(fs.readFileSync(REPO_ROOT + '/assets/js/pdf-import.js', 'utf8'))();
const { extractPdfLines, guessFromLines } = globalThis.TripPdfImport;

(async () => {
  const file = process.argv[2];
  const lines = await extractPdfLines(new Uint8Array(fs.readFileSync(file)), pdfjsLib);
  lines.forEach((l) => console.log(`[p${l.page} ${l.size.toFixed(0)}] ${l.text}`));
  const g = guessFromLines(lines);
  console.log('\n--- importer would guess ---');
  console.log('title:', g.title, '| dates:', g.dates, '| sortdate:', g.sortdate);
  console.log('route:', g.route);
  console.log('themes:', g.themes.join(', '), '| days:', g.days.length);
})().catch((e) => { console.error(e); process.exit(1); });
