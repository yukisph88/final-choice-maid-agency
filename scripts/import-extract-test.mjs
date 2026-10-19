#!/usr/bin/env node
// Accuracy test for the biodata extractor (Node, no database, no uploads).
//   node scripts/import-extract-test.mjs "<folder with biodata PDFs>" [--show CODE]
// Reads every PDF in the folder (recursively), extracts it with the same code the staff portal uses, and compares the result with the
// already-verified records in private-biodata/import/maids.csv (matched by reference code). Prints per-field agreement.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractFields, extractWork, extractTicks, buildDraft, toItems, pickPortrait } from '../src/staff/import/extract-core.js';
import { parseCsv } from '../src/staff/mapping.js';

const dir = process.argv[2]; const show = process.argv.includes('--show') ? process.argv[process.argv.indexOf('--show') + 1] : '';
if (!dir) { console.error('usage: node scripts/import-extract-test.mjs <folder> [--show CODE]'); process.exit(1); }
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.pdf$/i.test(e.name) ? [path.join(d, e.name)] : []));

/** image placements on page 1 (same logic as the browser module) */
async function placements(page, vp, OPS, Util) {
  const ops = await page.getOperatorList(); const out = []; const stack = []; let ctm = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]; const a = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm.slice()); else if (fn === OPS.restore) ctm = stack.pop() || ctm; else if (fn === OPS.transform) ctm = Util.transform(ctm, a);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintJpegXObject) {
      const m = Util.transform(vp.transform, ctm); const xs = [0, 1].flatMap((u) => [0, 1].map((v) => m[0] * u + m[2] * v + m[4])); const ys = [0, 1].flatMap((u) => [0, 1].map((v) => m[1] * u + m[3] * v + m[5]));
      out.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    }
  }
  return out;
}
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const truth = new Map(parseCsv(fs.readFileSync('private-biodata/import/maids.csv', 'utf8').replace(/^﻿/, '')).map((r) => [r.code, r]));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
const files = walk(dir); const seen = new Set(); const tally = {}; const bump = (k, ok) => { (tally[k] ||= { ok: 0, n: 0 }); tally[k].n++; if (ok) tally[k].ok++; };
let total = 0; let withPortrait = 0; const problems = [];
for (const f of files) {
  let doc;
  try { doc = await getDocument({ data: new Uint8Array(fs.readFileSync(f)), useSystemFonts: true, verbosity: 0 }).promise; } catch (e) { problems.push(`${path.basename(f)}: cannot open (${e.message})`); continue; }
  const page = await doc.getPage(1); const vp = page.getViewport({ scale: 1 }); const tc = await page.getTextContent();
  const items = toItems(tc.items, vp.height); const fields = extractFields(items, vp.width); const work = extractWork(items); const { draft, flags } = buildDraft(fields, work, path.basename(f), extractTicks(items));
  const imgs = await placements(page, vp, pdfjs.OPS, pdfjs.Util); const portrait = pickPortrait(imgs, vp.width, vp.height);
  if (!draft.code) { problems.push(`${path.basename(f)}: no code extracted`); continue; }
  const t = truth.get(draft.code); if (!t || seen.has(draft.code)) continue; seen.add(draft.code); total++;
  if (portrait.box) withPortrait++;
  bump('code', true);
  bump('nationality', draft.nationality === t.nationality);
  bump('name', norm(draft.full_name) === norm(t.internalName));
  bump('age', String(draft.age) === String(t.age));
  const rel = (x) => norm(x).replace(/islam|moeslem|moslem/g, 'muslim').replace(/roman catholic|catholic/g, 'catholic'); bump('religion (Islam=Muslim)', rel(draft.religion) === rel(t.religion));
  for (const k of ['childcare', 'newborn', 'elderlyCare']) bump('skill ' + k + ' (vs staff-curated)', (draft.skills[k] === 'experienced') === (t[k] === 'experienced'));
  const tl = norm(t.languages); bump('language: Bahasa Melayu', draft.languages.some((l) => /melayu/i.test(l.language)) === /melayu/.test(tl)); bump('language: English', draft.languages.some((l) => /english/i.test(l.language)) === /english/.test(tl));
  const tj = (t.employmentHistory || '').split('\n').filter(Boolean).length; bump('work entries (count)', draft.employment_history.length === tj);
  const tc0 = (t.employmentHistory || '').split('\n')[0]?.split('|')[0]?.toLowerCase() || ''; const dc0 = (draft.employment_history[0]?.country || '').toLowerCase();
  bump('first job country', !!dc0 && (tc0.includes(dc0) || dc0.includes(tc0.replace(/\(.*\)/, '').trim())));
  bump('overseas flag', draft.overseas_experience === (t.overseasExperience === 'yes'));
  if (process.argv.includes('--detail')) { if (false) problems.push(`${draft.code} religion "${draft.religion}" vs "${t.religion}"`); if (!(dc0 && (tc0.includes(dc0) || dc0.includes(tc0.replace(/\(.*\)/, '').trim())))) problems.push(`${draft.code} country "${dc0}" vs "${tc0}" (jobs: ${draft.employment_history.map((j) => j.country).join('/')})`); }
  if (show && draft.code === show) console.log(JSON.stringify({ draft, flags, portrait, truth: t }, null, 1));
  if (draft.nationality !== t.nationality || norm(draft.full_name) !== norm(t.internalName) || String(draft.age) !== String(t.age) || draft.employment_history.length !== tj) problems.push(`${draft.code}: name "${draft.full_name}" vs "${t.internalName}", age ${draft.age} vs ${t.age}, jobs ${draft.employment_history.length} vs ${tj}, nat ${draft.nationality} vs ${t.nationality}`);
}
console.log(`\n${files.length} PDFs read · ${total} matched to a verified record by code · portrait found on ${withPortrait}`);
for (const [k, v] of Object.entries(tally)) console.log(`  ${k.padEnd(22)} ${v.ok}/${v.n}  (${Math.round((v.ok / v.n) * 100)}%)`);
if (problems.length) { console.log(`\nDifferences / problems (${problems.length}):`); problems.slice(0, 40).forEach((p) => console.log('  - ' + p)); }
void pathToFileURL;
