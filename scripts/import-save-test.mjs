#!/usr/bin/env node
// Live test of the biodata-import SAVE path against the real Supabase project, with SYNTHETIC data and temporary test users only.
//   npm run import:savetest
// Uses the same code as the staff portal (src/staff/import/save-core.js). Everything it creates is removed again.
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { adminClient, loadEnv } from './db-lib.mjs';
import { saveImportWith, findExisting } from '../src/staff/import/save-core.js';

const env = loadEnv(); const URL_ = env.PUBLIC_SUPABASE_URL.replace(/\/$/, ''); const KEY = env.PUBLIC_SUPABASE_ANON_KEY; const admin = adminClient();
let pass = 0; let fail = 0; const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n} ${c ? '' : x}`); };
const tag = randomBytes(3).toString('hex').toUpperCase(); const users = {}; const CODES = [`TEST-IMP-${tag}-1`, `TEST-IMP-${tag}-2`, `TEST-IMP-${tag}-3`];
const SK = { childcare: 'experienced', newborn: 'none', elderlyCare: 'willing-to-learn', cooking: 'none', housekeeping: 'experienced', petCare: 'none' };
const fields = (code, over = {}) => ({ code, nationality: 'filipino', full_name: 'Test Import Person', age: 33, religion: 'Roman Catholic', marital_status: 'Single', experience_years: null, overseas_experience: true, skills: SK,
  languages: [{ language: 'English' }], employment_history: [{ country: 'Singapore', duration: '2020 – 2022', duties: 'Synthetic duties' }], rest_day_preference: '', salary_note: '', internal_notes: 'Education: synthetic', ...over });

async function cleanup() {
  await admin.storage.from('maid-private').remove(CODES.map((c) => `${c.toLowerCase()}.webp`));
  const { data: ms } = await admin.from('maids').select('id').in('code', CODES);
  for (const m of ms || []) { const { data: ds } = await admin.from('documents').select('storage_path').eq('maid_id', m.id); if (ds?.length) await admin.storage.from('maid-documents').remove(ds.map((d) => d.storage_path)); await admin.from('documents').delete().eq('maid_id', m.id); }
  await admin.from('maids').update({ status: 'withdrawn' }).in('code', CODES); await admin.from('maids').delete().in('code', CODES);
  await admin.from('audit_log').delete().like('label', 'Original biodata — test-import%');
  for (const u of Object.values(users)) { await admin.from('staff').delete().eq('user_id', u.id); await admin.auth.admin.deleteUser(u.id); }
}
try {
  const client = {};
  for (const [who, role] of [['editor', 'editor'], ['viewer', 'viewer']]) {
    const email = `fc-test-imp-${who}-${tag}@example.com`; const password = randomBytes(18).toString('base64url') + 'aA1!';
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (error) throw new Error(error.message);
    users[who] = { id: data.user.id, email }; await admin.from('staff').insert({ user_id: data.user.id, email, full_name: `Test ${who}`, role, active: true });
    client[who] = createClient(URL_, KEY, { auth: { persistSession: false } }); const s = await client[who].auth.signInWithPassword({ email, password }); if (s.error) throw new Error(s.error.message);
  }
  const photo = await sharp({ create: { width: 720, height: 900, channels: 3, background: '#2c7be5' } }).webp().toBuffer();
  const ctx = (who) => ({ sb: client[who], who: `Test ${who}`, email: users[who].email });
  const ed = ctx('editor');

  console.log('Create from an import (editor)');
  const r1 = await saveImportWith(ed, fields(CODES[0]), photo, { fileName: 'test-import-1.pdf', reviewed: true, keepOriginal: { name: 'test-import-1.pdf', type: 'application/pdf', size: 12, body: new Blob(['%PDF synthetic'], { type: 'application/pdf' }) } });
  ok('saved', r1.ok, r1.error);
  const m = r1.maid || {};
  ok('availability is To Be Confirmed and not confirmed', m.status === 'to-be-confirmed' && m.status_confirmed === false);
  ok('record is unpublished with no public photo', m.published === false && !m.public_photo_path && !m.consent_recorded);
  ok('private photo path stored', m.photo_path === `${CODES[0].toLowerCase()}.webp`);
  ok('importer and file name recorded in the notes', /Imported from "test-import-1.pdf" by Test editor/.test(m.internal_notes || '') && /reviewed by staff/.test(m.internal_notes || ''));
  ok('facts without a field are kept in the notes', /Education: synthetic/.test(m.internal_notes || ''));
  const dl = await client.editor.storage.from('maid-private').download(m.photo_path); ok('editor can read the private photo back', !dl.error);
  ok('the photo is NOT in the public bucket', !!(await admin.storage.from('maid-public').download(m.photo_path)).error);
  const anon = createClient(URL_, KEY, { auth: { persistSession: false } });
  ok('visitors cannot read the record', ((await anon.from('maids').select('code').eq('code', CODES[0])).data || []).length === 0);
  ok('visitors do not receive it from public_maids()', !JSON.stringify((await anon.rpc('public_maids')).data || []).includes(CODES[0]));
  ok('original document kept privately (editor level)', r1.originalKept === true);
  const h = (await admin.from('maid_history').select('changed_by_email,action').eq('code', CODES[0])).data || [];
  ok('who/when is in the change history', h.some((x) => x.action === 'insert' && x.changed_by_email === users.editor.email));

  console.log('\nDuplicate protection');
  const r2 = await saveImportWith(ed, fields(CODES[0], { full_name: 'Someone Else' }), photo, { fileName: 'dup.pdf', reviewed: true });
  ok('a second import with the same code is refused', !r2.ok && r2.duplicate === true);
  ok('still exactly one record', ((await admin.from('maids').select('id').eq('code', CODES[0])).data || []).length === 1);
  ok('existing record untouched', (await findExisting(ed, CODES[0])).full_name === 'Test Import Person');
  const r2b = await saveImportWith(ed, fields(CODES[0], { full_name: 'Someone Else', salary_note: 'RM 1,000 (synthetic)', experience_years: 4 }), photo, { fileName: 'merge.pdf', reviewed: true, merge: true });
  ok('merge fills only empty fields', r2b.ok && r2b.maid.full_name === 'Test Import Person' && r2b.maid.salary_note === 'RM 1,000 (synthetic)' && Number(r2b.maid.experience_years) === 4, r2b.error);
  ok('merge keeps one record and adds a note', ((await admin.from('maids').select('id').eq('code', CODES[0])).data || []).length === 1 && /merge\.pdf/.test(r2b.maid?.internal_notes || ''));

  console.log('\nFailed save leaves nothing behind');
  const r3 = await saveImportWith(ed, fields(CODES[1], { nationality: 'martian' }), photo, { fileName: 'bad.pdf', reviewed: true });
  ok('invalid record refused', !r3.ok);
  ok('no record created', ((await admin.from('maids').select('id').eq('code', CODES[1])).data || []).length === 0);
  ok('no orphan photo in storage', !(await admin.storage.from('maid-private').list('')).data?.some((f) => f.name === `${CODES[1].toLowerCase()}.webp`));
  const r3b = await saveImportWith(ed, fields(CODES[1], { age: 5 }), photo, { fileName: 'bad2.pdf', reviewed: true });
  ok('validation (age) refused before anything is uploaded', !r3b.ok && !(await admin.storage.from('maid-private').list('')).data?.some((f) => f.name === `${CODES[1].toLowerCase()}.webp`));

  // the record insert fails AFTER the photo was uploaded (simulated database failure): the photo must be removed again
  const flaky = { ...ed, sb: { storage: client.editor.storage, from: (t) => (t === 'maids' ? { select: (...a2) => client.editor.from('maids').select(...a2), insert: () => ({ select: () => ({ single: async () => ({ error: { message: 'simulated database failure' } }) }) }) } : client.editor.from(t)) } };
  const rf = await saveImportWith(flaky, fields(CODES[1]), photo, { fileName: 'flaky.pdf', reviewed: true });
  ok('a failure after the photo upload is reported', !rf.ok && /simulated database failure/.test(rf.error || ''));
  ok('and the uploaded photo is removed again (no orphan)', !(await admin.storage.from('maid-private').list('')).data?.some((f) => f.name === `${CODES[1].toLowerCase()}.webp`));

  console.log('\nWithout a photo');
  const r4 = await saveImportWith(ed, fields(CODES[2]), null, { fileName: 'nophoto.pdf', reviewed: false });
  ok('saves with no photo, flagged as not individually reviewed', r4.ok && r4.maid.photo_path === '' && /not yet individually reviewed/.test(r4.maid.internal_notes), r4.error);

  console.log('\nPermissions');
  const vw = ctx('viewer'); const rv = await saveImportWith(vw, fields(`TEST-IMP-${tag}-9`), photo, { fileName: 'v.pdf', reviewed: true });
  ok('a viewer cannot import', !rv.ok);
  ok('and leaves no photo or record', ((await admin.from('maids').select('id').eq('code', `TEST-IMP-${tag}-9`)).data || []).length === 0 && !(await admin.storage.from('maid-private').list('')).data?.some((f) => f.name === `test-imp-${tag.toLowerCase()}-9.webp`));
  const pubTry = await saveImportWith(ed, { ...fields(`TEST-IMP-${tag}-8`), published: true, consent_recorded: true }, photo, { fileName: 'p.pdf', reviewed: true });
  ok('importing never publishes (publication fields are ignored)', pubTry.ok ? pubTry.maid.published === false && pubTry.maid.consent_recorded === false : true);
  await admin.storage.from('maid-private').remove([`test-imp-${tag.toLowerCase()}-8.webp`]); await admin.from('maids').update({ status: 'withdrawn' }).eq('code', `TEST-IMP-${tag}-8`); await admin.from('maids').delete().eq('code', `TEST-IMP-${tag}-8`);
} catch (e) { fail++; console.error('✗ test stopped:', e.message); } finally {
  await cleanup();
  const left = await admin.from('maids').select('code', { count: 'exact', head: true }).like('code', `TEST-IMP-${tag}%`);
  console.log(`\nCleanup → test records left: ${left.count}`);
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
