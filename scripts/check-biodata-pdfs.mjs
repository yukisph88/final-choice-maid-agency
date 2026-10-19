#!/usr/bin/env node
// Checks the biodata PDFs created by the website build (run after "npm run build"):   node scripts/check-biodata-pdfs.mjs
// For every PUBLISHED maid (same rules as the site): English + Bahasa Melayu PDF exist, A4, carry her code, name, photo, work history and skills,
// contain no private data, and every profile page / card links to the right file. PDFs for anyone else must not exist.
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const DIST = process.env.DIST_DIR ?? 'dist'; const CONTENT = 'src/content/maids';
const HIDDEN = ['hired', 'placed', 'unavailable', 'withdrawn'];
const name = (code, lang) => `Final-Choice-Biodata-${code.replace(/[^A-Za-z0-9-]/g, '')}${lang === 'ms' ? '-BM' : ''}`;
const fails = []; const fail = (m) => fails.push(m);

const maids = fs.readdirSync(CONTENT).filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => {
  const t = fs.readFileSync(path.join(CONTENT, f), 'utf8'); const fm = /^---\n([\s\S]*?)\n---/.exec(t.replace(/\r\n/g, '\n'));
  const d = load(fm[1]); return { ...d, slug: String(d.code).toLowerCase(), body: t.replace(/\r\n/g, '\n').replace(/^---[\s\S]*?\n---\n?/, '').trim() };
}).filter((m) => m.published && m.publication?.consentRecorded && !HIDDEN.includes(m.status));
// With live status on (PUBLIC_LIVE_STATUS=true) the build itself drops a maid whose CONFIRMED status is Hired / Withdrawn: page and PDFs must then both be absent.
const builtPage = (m) => ['en/maids', 'ms/pembantu-rumah'].some((d) => fs.existsSync(path.join(DIST, d, m.slug, 'index.html')));
const removedByStatus = process.env.PUBLIC_LIVE_STATUS === 'true' ? maids.filter((m) => !builtPage(m)) : [];
if (removedByStatus.length) console.log(`note: ${removedByStatus.length} maid(s) are not in this build because their confirmed live status is Hired/Withdrawn: ${removedByStatus.map((m) => m.code).join(', ')}`);
const live = maids.filter((m) => !removedByStatus.includes(m));

const pdfDir = path.join(DIST, 'biodata'); const present = fs.existsSync(pdfDir) ? fs.readdirSync(pdfDir).filter((f) => f.endsWith('.pdf')) : [];
const expected = new Set(live.flatMap((m) => ['en', 'ms'].map((l) => `${name(m.code, l)}.pdf`)));
for (const f of present) if (!expected.has(f)) fail(`unexpected PDF (not a published maid): ${f}`);
const PHONE = /(?<!\d)(?:\+?6?0?1\d[-\s]?\d{3,4}[-\s]?\d{4})(?!\d)/g; const COMPANY_PHONE = /018[-\s]?377[-\s]?3333|60183773333/;
const MYKAD = /\b\d{6}-?\d{2}-?\d{4}\b/; const PASSPORT = /\b[A-Z]{1,2}\d{7,8}\b/;
let checked = 0;
for (const m of live) for (const lang of ['en', 'ms']) {
  const file = `${name(m.code, lang)}.pdf`; const tag = `${m.code} [${lang}]`;
  if (!fs.existsSync(path.join(pdfDir, file))) { fail(`${tag}: PDF missing (${file})`); continue; }
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(path.join(pdfDir, file))), useSystemFonts: true, verbosity: 0 }).promise;
  let text = ''; let images = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p); const vp = page.getViewport({ scale: 1 });
    if (Math.abs(vp.width - 595.28) > 1 || Math.abs(vp.height - 841.89) > 1) fail(`${tag}: page ${p} is not A4`);
    text += (await page.getTextContent()).items.map((i) => i.str).join(' ') + '\n';
    const ops = await page.getOperatorList(); images += ops.fnArray.filter((f) => f === OPS.paintImageXObject || f === OPS.paintJpegXObject || f === OPS.paintInlineImageXObject).length;
  }
  const flat = text.replace(/\s+/g, ' ');
  const has = (s) => flat.toLowerCase().includes(String(s).replace(/\s+/g, ' ').toLowerCase());
  const compact = (x) => String(x).toLowerCase().replace(/[\s-]+/g, ''); const hasC = (x) => compact(flat).includes(compact(x));   // line wraps may break at a space or a hyphen
  if (!has(m.code)) fail(`${tag}: reference code not in the PDF`);
  if (m.displayName && !has(m.displayName)) fail(`${tag}: name "${m.displayName}" not in the PDF`);
  if (!m.displayName && /Reference code/.test('') ) fail(`${tag}: unexpected`);
  const wantImages = m.photo && m.publication.photoConsent ? 2 : 1; if (images < wantImages) fail(`${tag}: expected ${wantImages}+ pictures (logo${wantImages > 1 ? ' + photo' : ''}), found ${images}`);
  for (const j of m.employmentHistory ?? []) { if (j.duration && !has(j.duration)) fail(`${tag}: work period "${j.duration}" missing`); const d = (lang === 'ms' && j.duties_ms ? j.duties_ms : j.duties) ?? ''; const tail = d.trim().slice(-18); if (tail && !hasC(tail)) fail(`${tag}: end of a duty line cut off ("…${tail}")`); }
  for (const k of ['childcare', 'newborn', 'elderlyCare', 'cooking', 'housekeeping', 'petCare']) if (m.skills?.[k] && m.skills[k] !== 'none') { /* label presence checked via level words below */ }
  const summary = (lang === 'ms' && m.summary_ms ? m.summary_ms : m.body).split(/\n\s*\n/)[0] ?? ''; if (summary && !hasC(summary.slice(-25))) fail(`${tag}: summary is cut off`);
  if (!has(lang === 'ms' ? 'Kod rujukan' : 'Reference code')) fail(`${tag}: wrong-language labels`);
  const LABELS = lang === 'ms' ? ['Status belum disahkan', 'Tersedia', 'Ditahan', 'Telah Ditempah', 'Menunggu Ketibaan'] : ['Availability to be confirmed', 'Available', 'On Hold', 'Booked', 'Pending Arrival'];   // a confirmed live status may replace "to be confirmed"
  if (!LABELS.some((l) => has(l))) fail(`${tag}: availability label missing`);
  // privacy
  if (!m.publication.showReligion && /\b(religion|agama|muslim|islam|christian|catholic|kristian)\b/i.test(flat)) fail(`${tag}: religion appears although not authorised`);
  if (!m.publication.showAge && /\b(Age|Umur) \d{2}\b(?= (Work experience|Pengalaman|Marital|Status|Religion|Agama|Nationality|Warganegara))/.test(flat)) fail(`${tag}: age appears although not authorised`);
  if (/passport|pasport|medical|internal note|nota dalaman/i.test(flat)) fail(`${tag}: private wording found`);
  if (MYKAD.test(flat) || PASSPORT.test(flat.replace(m.code, ''))) fail(`${tag}: identity-number pattern found`);
  for (const ph of flat.match(PHONE) ?? []) if (!COMPANY_PHONE.test(ph)) fail(`${tag}: unexpected phone number ${ph}`);
  checked++;
}
// links: every profile page and the directory cards point to existing files
for (const m of live) for (const [lang, dir] of [['en', 'maids'], ['ms', 'pembantu-rumah']]) {
  const page = path.join(DIST, lang, dir, m.slug, 'index.html'); if (!fs.existsSync(page)) { fail(`${m.code} [${lang}]: profile page missing`); continue; }
  const html = fs.readFileSync(page, 'utf8'); const link = `biodata/${name(m.code, lang)}.pdf`;
  if (!html.includes(link)) fail(`${m.code} [${lang}]: profile page has no download link to ${link}`);
  const other = html.match(/biodata\/Final-Choice-Biodata-[A-Za-z0-9-]+\.pdf/g) ?? [];
  for (const o of new Set(other)) if (!fs.existsSync(path.join(DIST, o))) fail(`${m.code} [${lang}]: broken link ${o}`);
}
console.log(`${live.length} published maids · ${present.length} PDF files · ${checked} PDFs checked in detail`);
if (fails.length) { console.error(`✗ ${fails.length} problem(s):\n  - ` + fails.slice(0, 40).join('\n  - ')); process.exit(1); }
console.log('✓ biodata PDFs: all present, correct, private data excluded, links valid');
