#!/usr/bin/env node
// Final Choice — copy maid records from the existing private CSV system into Supabase (office PC only).
//
//   npm run db:migrate                         DRY RUN: shows what would be added / updated / skipped. Changes nothing.
//   npm run db:migrate -- --apply              Add new maids, update changed ones, upload their private photos.
//   npm run db:migrate -- --synthetic          DRY RUN with 3 made-up TEST records (no real data) — for testing.
//   npm run db:migrate -- --synthetic --apply  Add the 3 TEST records.
//   npm run db:migrate -- --remove-synthetic   Delete the TEST records and their photos again.
//
// Safety:
//   • Matches by reference code, so running it twice never creates duplicates.
//   • Never publishes anyone (published is always false) — staff publish in the dashboard after checking consent.
//   • A local backup is taken first (npm run db:backup) whenever --apply changes the database.
//   • Original PDFs, passports and other documents are NOT uploaded. Only the cropped 720×900 WebP working photo goes
//     to the PRIVATE bucket.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { adminClient } from './db-lib.mjs';
import { parseCsv, csvRowToDb, validateRow, changedFields, restrictToColumns } from '../src/staff/mapping.js';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const SYNTH = args.has('--synthetic') || args.has('--remove-synthetic');

// SAFETY LOCK — checked BEFORE the script connects to the database at all.
// Real personal data may be uploaded only after management's written data-processing approval is recorded on this PC:
// copy supabase/data-processing-approval.TEMPLATE.json to private-biodata/approval/data-processing-approval.json and fill it in.
function approvalGate() {
  const f = 'private-biodata/approval/data-processing-approval.json';
  if (!existsSync(f)) return { ok: false, why: `no approval record (${f})` };
  let a; try { a = JSON.parse(readFileSync(f, 'utf8')); } catch { return { ok: false, why: 'approval record is not valid JSON' }; }
  const missing = [];
  if (a.confirmed !== true) missing.push('"confirmed" is not true');
  if (!String(a.approvedBy || '').trim() || /^name and position/i.test(a.approvedBy)) missing.push('approvedBy');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.approvedDate || ''))) missing.push('approvedDate (YYYY-MM-DD)');
  if (!String(a.region || '').trim() || /^region of/i.test(a.region)) missing.push('region');
  if (!String(a.reference || '').trim() || /^where the written/i.test(a.reference)) missing.push('reference');
  if (a.dpaAccepted !== true) missing.push('dpaAccepted');
  if (a.privacyNoticeUpdated !== true) missing.push('privacyNoticeUpdated');
  return missing.length ? { ok: false, why: `approval record incomplete: ${missing.join(', ')}` } : { ok: true, why: `approved by ${a.approvedBy} on ${a.approvedDate} (region: ${a.region})` };
}
const gate = SYNTH ? { ok: true, why: 'synthetic test data — no approval needed' } : approvalGate();
if (args.has('--check-lock')) { console.log(`Approval lock: ${gate.ok ? 'OPEN' : 'LOCKED'} — ${gate.why}`); process.exit(0); }
if (APPLY && !gate.ok) {
  console.error(`✗ LOCKED: real maid records cannot be uploaded yet — ${gate.why}.\n  Management's written data-processing approval is required first (see supabase/DATA-PROCESSING-CHECKLIST.md).\n  Nothing was changed.`);
  process.exit(1);
}
const db = adminClient();

const SYNTHETIC = [
  { code: 'TEST-ID-0001', internalName: 'TEST CANDIDATE ONE', nationality: 'indonesian', age: '30', religion: 'Test', experienceYears: '3', overseasExperience: 'yes', childcare: 'experienced', housekeeping: 'experienced', cooking: 'some-experience', languages: 'Bahasa Indonesia: fluent; English: basic', employmentHistory: 'Test Country|2020 – 2023|Synthetic test duties|Tugas ujian sintetik', summary: 'SYNTHETIC TEST RECORD — not a real person.', summary_ms: 'REKOD UJIAN SINTETIK — bukan orang sebenar.', status: 'available', statusSetBy: 'TEST' },
  { code: 'TEST-PH-0002', internalName: 'TESTER, SAMPLE PERSON', nationality: 'filipino', age: '35', experienceYears: '5', childcare: 'experienced', elderlyCare: 'experienced', housekeeping: 'experienced', languages: 'English: fluent', employmentHistory: 'Test Country|2019 – 2024|Synthetic test duties|Tugas ujian sintetik', summary: 'SYNTHETIC TEST RECORD — not a real person.', summary_ms: 'REKOD UJIAN SINTETIK — bukan orang sebenar.', status: 'reserved', statusSetBy: 'TEST' },
  { code: 'TEST-ID-0003', internalName: 'TEST CANDIDATE THREE', nationality: 'indonesian', age: '27', childcare: 'willing-to-learn', housekeeping: 'experienced', summary: 'SYNTHETIC TEST RECORD — not a real person.', summary_ms: 'REKOD UJIAN SINTETIK — bukan orang sebenar.', status: 'available', statusSetBy: '' },
];

if (args.has('--remove-synthetic')) {
  const { data, error } = await db.from('maids').delete().like('code', 'TEST-%').select('code, photo_path');
  if (error) { console.error('✗', error.message); process.exit(1); }
  const files = data.map((r) => r.photo_path).filter(Boolean);
  if (files.length) await db.storage.from('maid-private').remove(files);
  await db.storage.from('maid-public').remove(data.map((r) => `${r.code.toLowerCase()}.webp`));
  console.log(`✓ removed ${data.length} TEST record(s): ${data.map((r) => r.code).join(', ') || '—'}`);
  process.exit(0);
}

const source = args.has('--synthetic') ? SYNTHETIC : parseCsv(readFileSync('private-biodata/import/maids.csv', 'utf8')).filter((r) => r.code && !/^EXAMPLE/i.test(r.code));
console.log(`${APPLY ? 'APPLYING' : 'DRY RUN (nothing will change)'} — ${source.length} record(s) from ${args.has('--synthetic') ? 'synthetic TEST data' : 'private-biodata/import/maids.csv'}\n`);

// duplicates inside the source
const seen = new Map();
for (const r of source) { const c = String(r.code).toUpperCase(); seen.set(c, (seen.get(c) || 0) + 1); }
const dupes = [...seen].filter(([, n]) => n > 1).map(([c]) => c);
if (dupes.length) { console.error(`✗ The source lists these codes more than once: ${dupes.join(', ')} — fix it first. Nothing changed.`); process.exit(1); }

const { data: existing, error: exErr } = await db.from('maids').select('*');
if (exErr) { console.error('✗ Cannot read the database:', exErr.message, '\n  Did you run supabase/migrations/0001 and 0002 in the SQL Editor?'); process.exit(1); }
const byCode = new Map(existing.map((m) => [m.code, m]));

const plan = { add: [], update: [], same: [], bad: [] };
for (const r of source) {
  const row = csvRowToDb(r);
  const photo = join('private-biodata/staging/photos', `${row.code.toLowerCase()}.webp`);
  if (existsSync(photo)) row.photo_path = `${row.code.toLowerCase()}.webp`;
  const { errors } = validateRow(row);
  // Extra guard for EVERYTHING that would be uploaded (including private notes and file names):
  // no passport / IC / phone numbers, and no document files.
  const everything = JSON.stringify(Object.entries(row).filter(([k]) => k !== 'skills'));
  if (/\b[A-Z]{1,2}\d{7,8}\b/.test(everything.replace(/[A-Z0-9]+(-[A-Z0-9]+)+/g, ''))) errors.push('looks like a passport number in an uploaded field'); // reference codes are removed first
  if (/\b\d{6}-\d{2}-\d{4}\b/.test(everything)) errors.push('looks like an IC number in an uploaded field');
  if (/\+?6?01\d[- ]?\d{3,4}[- ]?\d{4}/.test(everything)) errors.push('looks like a phone number in an uploaded field');
  if (row.biodata_pdf_path) errors.push('biodata PDFs are never uploaded by the migration');
  if (errors.length) { plan.bad.push({ code: row.code, errors }); continue; }
  const old = byCode.get(row.code);
  if (!old) plan.add.push({ row, photo: existsSync(photo) ? photo : null });
  else {
    // never change publication of an existing record, and touch ONLY the columns the file really contains
    const part = restrictToColumns(row, Object.keys(r), old);
    const diff = changedFields(old, part);
    const needPhoto = existsSync(photo) && !old.photo_path;
    if (needPhoto) part.photo_path = row.photo_path;
    if (diff.length || needPhoto) plan.update.push({ row: part, diff, photo: needPhoto ? photo : null });
    else plan.same.push(row.code);
  }
}
for (const x of plan.add) console.log(`+ add     ${x.row.code}${x.photo ? '  (+ private photo)' : '  (no photo)'}`);
for (const x of plan.update) console.log(`~ update  ${x.row.code}: ${x.diff.join(', ') || '—'}${x.photo ? ' + private photo' : ''}`);
for (const x of plan.bad) console.log(`✗ skip    ${x.code}: ${x.errors.join('; ')}`);
console.log(`\n${plan.add.length} new · ${plan.update.length} changed · ${plan.same.length} already identical · ${plan.bad.length} with problems · database now has ${existing.length}`);

if (!APPLY) { console.log('\nDry run only. Run again with --apply to make these changes.'); process.exit(plan.bad.length ? 1 : 0); }
if (plan.bad.length) { console.error('\n✗ Fix the records with problems first. Nothing changed.'); process.exit(1); }
if (!plan.add.length && !plan.update.length) { console.log('\nNothing to do.'); process.exit(0); }

if (existing.length) { console.log('\nTaking a backup first…'); execSync('node scripts/db-backup.mjs', { stdio: 'inherit' }); }

let done = 0;
for (const x of [...plan.add, ...plan.update]) {
  if (x.photo) {
    const { error } = await db.storage.from('maid-private').upload(x.row.photo_path, readFileSync(x.photo), { contentType: 'image/webp', upsert: true });
    if (error) { console.error(`✗ ${x.row.code} photo: ${error.message}`); continue; }
  }
  const isNew = !byCode.has(x.row.code);
  const { code, ...changes } = x.row;
  const { error } = isNew ? await db.from('maids').insert(x.row) : await db.from('maids').update(changes).eq('code', code);
  if (error) { console.error(`✗ ${x.row.code}: ${error.message}`); continue; }
  done++;
}
const { count } = await db.from('maids').select('*', { count: 'exact', head: true });
console.log(`\n✓ ${done} record(s) saved. Database now has ${count} maid record(s). Nobody was published.`);
