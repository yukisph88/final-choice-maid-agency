#!/usr/bin/env node
// Final Choice — apply the staff approval checklist to the DATABASE (office PC only).
//   npm run db:approvals                 DRY RUN: shows who would be published / unpublished. Changes nothing.
//   npm run db:approvals -- --apply      Publish approved maids, unpublish the rest (a backup is taken first).
//   npm run db:approvals -- --file x.xlsx   use another checklist file (testing)
//
// Source: private-biodata/approval/Maid_Approval_Checklist.xlsx (sheet "Checklist") — the same file staff already use.
// A row is APPROVED only when ALL of these are filled in:
//   Publication consent = Yes · Consent date · Discrepancies resolved = Yes · Approved for website = Yes · Approved by (initials)
// Approving a row publishes the profile with the name/age/religion/photo permissions chosen in the checklist.
// It NEVER confirms availability: unverified statuses stay "Availability to be confirmed" (use the status tools for that).
// Anyone who is not approved, or whose status is Placed / Unavailable / Withdrawn, is unpublished and her public photo removed.
// The database itself refuses to publish without consent, consent date and approver (a second, independent check).
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { readSheet } from 'read-excel-file/node';
import { adminClient, anonClient } from './db-lib.mjs';
import { HIDDEN } from '../src/staff/mapping.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const file = args.includes('--file') ? args[args.indexOf('--file') + 1] : 'private-biodata/approval/Maid_Approval_Checklist.xlsx';
if (!existsSync(file)) { console.error(`✗ Not found: ${file}`); process.exit(1); }

const cell = (v) => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && 'result' in v) return cell(v.result);
  return String(v).trim();
};
const isoDate = (t) => {
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : 'INVALID';
};

const sheet = await readSheet(file, 'Checklist').catch(() => { console.error('✗ The workbook has no "Checklist" sheet'); process.exit(1); });
const col = {}; sheet[0].forEach((v, i) => { col[cell(v)] = i; });
const need = ['Reference code', 'Publication consent', 'Consent date', 'Photo consent', 'Name display (Full / First / None)', 'Show age', 'Show religion', 'Discrepancies resolved', 'Approved for website', 'Approved by (initials)'];
for (const n of need) if (col[n] === undefined) { console.error(`✗ Checklist column missing: "${n}" — do not rename the headings`); process.exit(1); }

const db = adminClient();
const { data: maids, error } = await db.from('maids').select('*');
if (error) { console.error('✗ Cannot read the database:', error.message); process.exit(1); }
const byCode = new Map(maids.map((m) => [m.code, m]));

const publish = []; const unpublish = []; const same = []; const problems = []; const seen = new Set();
for (const row of sheet.slice(1)) {
  const g = (h) => cell(row[col[h]]);
  const code = g('Reference code').toUpperCase();
  if (!code || !code.includes('-') || code.startsWith('EXAMPLE')) continue;
  if (seen.has(code)) { problems.push(`${code}: listed twice in the checklist`); continue; }
  seen.add(code);
  const m = byCode.get(code);
  if (!m) { problems.push(`${code}: not in the database yet (run db:migrate first)`); continue; }
  const Y = (h) => g(h).toLowerCase() === 'yes';
  const date = isoDate(g('Consent date'));
  if (date === 'INVALID') { problems.push(`${code}: consent date "${g('Consent date')}" — use DD/MM/YYYY`); continue; }
  const nameConsent = (g('Name display (Full / First / None)') || 'none').toLowerCase();
  if (!['full', 'first', 'none'].includes(nameConsent)) { problems.push(`${code}: Name display must be Full, First or None`); continue; }
  const initials = g('Approved by (initials)').slice(0, 10);
  const approved = Y('Approved for website') && Y('Publication consent') && date && Y('Discrepancies resolved') && initials && !HIDDEN.includes(m.status);
  if (!approved) { if (m.published) unpublish.push({ m, why: HIDDEN.includes(m.status) ? `status is ${m.status}` : 'no longer approved in the checklist' }); else same.push(code); continue; }
  const want = { consent_recorded: true, consent_date: date, photo_consent: Y('Photo consent'), name_consent: nameConsent, show_age: Y('Show age'), show_religion: Y('Show religion'), approved_by: initials, published: true };
  const wantPhoto = want.photo_consent && Boolean(m.photo_path);
  const changed = Object.keys(want).filter((k) => String(m[k] ?? '') !== String(want[k])).concat((wantPhoto ? !m.public_photo_path : Boolean(m.public_photo_path)) ? ['public photo'] : []);
  if (!changed.length) same.push(code); else publish.push({ m, want, wantPhoto, changed });
}

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN (nothing will change)'} — checklist ${file}\n`);
for (const x of publish) console.log(`+ publish   ${x.m.code}  name:${x.want.name_consent}  photo:${x.wantPhoto ? 'yes' : 'no'}  age:${x.want.show_age ? 'shown' : 'hidden'}  religion:${x.want.show_religion ? 'shown' : 'hidden'}   (${x.changed.join(', ')})`);
for (const x of unpublish) console.log(`- unpublish ${x.m.code}  (${x.why})`);
for (const p of problems) console.log(`✗ problem   ${p}`);
console.log(`\n${publish.length} to publish · ${unpublish.length} to unpublish · ${same.length} unchanged · ${problems.length} problem(s) · ${maids.filter((m) => m.published).length} published now`);
if (problems.length) { console.error('\n✗ Fix the checklist first. Nothing was changed.'); process.exit(1); }
if (!APPLY) { console.log('\nDry run only. Add --apply to make these changes.'); process.exit(0); }
if (!publish.length && !unpublish.length) { console.log('\nNothing to do.'); process.exit(0); }

console.log('\nTaking a backup first…'); execSync('node scripts/db-backup.mjs', { stdio: 'inherit' });

for (const x of unpublish) {
  const slug = `${x.m.code.toLowerCase()}.webp`;
  const { error: e } = await db.from('maids').update({ published: false, public_photo_path: '' }).eq('id', x.m.id);
  if (e) { console.error(`✗ ${x.m.code}: ${e.message}`); process.exitCode = 1; continue; }
  await db.storage.from('maid-public').remove([slug]);
  console.log(`✓ ${x.m.code} unpublished, public photo removed`);
}
for (const x of publish) {
  const slug = `${x.m.code.toLowerCase()}.webp`;
  // 1. record consent and publish (the database re-checks consent, date and approver)
  const { error: e } = await db.from('maids').update(x.want).eq('id', x.m.id);
  if (e) { console.error(`✗ ${x.m.code}: ${e.message}`); process.exitCode = 1; continue; }
  // 2. public photo only with photo consent; otherwise make sure none is left
  if (x.wantPhoto) {
    const { data: blob, error: de } = await db.storage.from('maid-private').download(x.m.photo_path);
    if (de) { console.error(`✗ ${x.m.code}: private photo missing (${de.message})`); process.exitCode = 1; continue; }
    const up = await db.storage.from('maid-public').upload(slug, blob, { contentType: 'image/webp', upsert: true, cacheControl: '300' });
    if (up.error) { console.error(`✗ ${x.m.code}: ${up.error.message}`); process.exitCode = 1; continue; }
    await db.from('maids').update({ public_photo_path: slug }).eq('id', x.m.id);
  } else {
    await db.from('maids').update({ public_photo_path: '' }).eq('id', x.m.id);
    await db.storage.from('maid-public').remove([slug]);
  }
  console.log(`✓ ${x.m.code} published`);
}

// independent check with the website's own (public) view
const pub = await anonClient().rpc('public_maids');
console.log(`\n✓ The public website view now lists ${pub.data?.length ?? '?'} maid(s). The website shows them after its next rebuild.`);
