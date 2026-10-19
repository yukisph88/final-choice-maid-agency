#!/usr/bin/env node
// Live check of the deployed site: every published maid's profile page (EN + BM) links to a PDF that downloads, is a PDF, and contains her code and name.
//   node scripts/check-live-biodata.mjs [https://yukisph88.github.io/final-choice-maid-agency]
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const BASE = (process.argv[2] ?? 'https://yukisph88.github.io/final-choice-maid-agency').replace(/\/$/, '');
const HIDDEN = ['hired', 'placed', 'unavailable', 'withdrawn']; const CONTENT = 'src/content/maids'; const fails = [];
const maids = fs.readdirSync(CONTENT).filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => load(/^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(path.join(CONTENT, f), 'utf8').replace(/\r\n/g, '\n'))[1]))
  .filter((m) => m.published && m.publication?.consentRecorded && !HIDDEN.includes(m.status));
let ok = 0; let bytes = 0;
for (const m of maids) for (const [lang, dir, label] of [['en', 'maids', 'Download Biodata (PDF)'], ['ms', 'pembantu-rumah', 'Muat Turun Biodata (PDF)']]) {
  const page = `${BASE}/${lang}/${dir}/${m.code.toLowerCase()}/`; const res = await fetch(`${page}?c=${Date.now()}`); const html = await res.text();
  const link = new RegExp(`href="([^"]*biodata/Final-Choice-Biodata-[^"]+\\.pdf)"[^>]*download="([^"]+)"`).exec(html);
  if (!res.ok || !link) { fails.push(`${m.code} [${lang}]: no download link on ${page}`); continue; }
  const expectName = `Final-Choice-Biodata-${m.code}${lang === 'ms' ? '-BM' : ''}.pdf`;
  if (link[2] !== expectName || !link[1].endsWith(`/${expectName}`)) fails.push(`${m.code} [${lang}]: wrong file name ${link[2]}`);
  if (!html.includes(label)) fails.push(`${m.code} [${lang}]: button label "${label}" missing`);
  const url = new URL(link[1], page).href; const pdf = await fetch(url); const buf = new Uint8Array(await pdf.arrayBuffer()); bytes += buf.length;
  if (!pdf.ok || pdf.headers.get('content-type') !== 'application/pdf' || new TextDecoder().decode(buf.slice(0, 5)) !== '%PDF-') { fails.push(`${m.code} [${lang}]: ${url} is not a downloadable PDF (HTTP ${pdf.status})`); continue; }
  const doc = await getDocument({ data: buf, useSystemFonts: true, verbosity: 0 }).promise; let text = '';
  for (let p = 1; p <= doc.numPages; p++) text += (await (await doc.getPage(p)).getTextContent()).items.map((i) => i.str).join(' ') + ' ';
  const flat = text.replace(/\s+/g, ' ').toLowerCase();
  if (!flat.includes(m.code.toLowerCase())) fails.push(`${m.code} [${lang}]: code not in PDF`); else if (m.displayName && !flat.includes(String(m.displayName).toLowerCase())) fails.push(`${m.code} [${lang}]: name not in PDF`); else ok++;
}
console.log(`${maids.length} maids · ${ok}/${maids.length * 2} live PDFs verified (link → download → PDF → code and name) · ${(bytes / 1048576).toFixed(1)} MB`);
if (fails.length) { console.error('✗ ' + fails.slice(0, 30).join('\n  ')); process.exit(1); }
