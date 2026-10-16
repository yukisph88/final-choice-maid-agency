#!/usr/bin/env node
// Final Choice — live role and security test against the real Supabase project (office PC only).
//   npm run db:roletest
// Creates TEMPORARY test logins (viewer, editor, admin, and one signed-in non-staff user) and SYNTHETIC test records, signs
// in as each of them exactly like the dashboard does, tries everything each role may and may not do, then deletes all test
// users, records, files and history. No real data is touched or uploaded.
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { adminClient, loadEnv } from './db-lib.mjs';

const env = loadEnv();
const URL_ = env.PUBLIC_SUPABASE_URL.replace(/\/$/, ''); const KEY = env.PUBLIC_SUPABASE_ANON_KEY;
const admin = adminClient();
let pass = 0; let fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };
const tag = randomBytes(3).toString('hex');
const people = { admin: 'admin', editor: 'editor', viewer: 'viewer', stranger: null };
const users = {};

async function cleanup() {
  await admin.storage.from('maid-public').remove(['test-rt-0001.webp', 'test-rt-0002.webp']);
  await admin.storage.from('maid-private').remove(['test-rt-0001.webp', 'test-rt-0002.webp']);
  await admin.from('maids').delete().like('code', 'TEST-RT-%');
  await admin.from('maid_history').delete().like('code', 'TEST-RT-%');
  for (const u of Object.values(users)) { await admin.from('staff').delete().eq('user_id', u.id); await admin.auth.admin.deleteUser(u.id); }
}

try {
  console.log('Creating temporary test users…');
  for (const [who, role] of Object.entries(people)) {
    const email = `fc-test-${who}-${tag}@example.com`; const password = randomBytes(18).toString('base64url') + 'aA1!';
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`create ${who}: ${error.message}`);
    users[who] = { id: data.user.id, email, password };
    if (role) { const r = await admin.from('staff').insert({ user_id: data.user.id, email, full_name: `Test ${who}`, role, active: true }); if (r.error) throw new Error(r.error.message); }
  }
  const client = {};
  for (const who of Object.keys(people)) {
    client[who] = createClient(URL_, KEY, { auth: { persistSession: false } });
    const { error } = await client[who].auth.signInWithPassword({ email: users[who].email, password: users[who].password });
    if (error) throw new Error(`sign in ${who}: ${error.message}`);
  }
  const wrong = await createClient(URL_, KEY, { auth: { persistSession: false } }).auth.signInWithPassword({ email: users.admin.email, password: 'not-the-password' });
  ok('login with a wrong password is refused', !!wrong.error);

  const img = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900"><rect width="720" height="900" fill="#1f6feb"/></svg>')).webp().toBuffer();
  const SK = { childcare: 'experienced', newborn: 'none', elderlyCare: 'none', cooking: 'none', housekeeping: 'experienced', petCare: 'none' };
  const rec = (n) => ({ code: `TEST-RT-000${n}`, full_name: `Role Test ${n}`, first_name: 'Role', nationality: 'indonesian', skills: SK, summary_en: 'SYNTHETIC', summary_ms: 'SINTETIK', status: 'available', status_set_by: 'TEST', photo_path: `test-rt-000${n}.webp` });

  console.log('\nRole: role-less signed-in user (not staff)');
  ok('staff_role() is empty', (await client.stranger.rpc('staff_role')).data === '');
  ok('cannot read any maid', ((await client.stranger.from('maids').select('*')).data || []).length === 0);
  ok('cannot add a maid', !!(await client.stranger.from('maids').insert(rec(1))).error);
  ok('cannot read private files', !!(await client.stranger.storage.from('maid-private').list('')).error || ((await client.stranger.storage.from('maid-private').list('')).data || []).length === 0);

  console.log('\nRole: editor');
  ok('staff_role() = editor', (await client.editor.rpc('staff_role')).data === 'editor');
  const ins = await client.editor.from('maids').insert([rec(1), rec(2)]).select();
  ok('can add maids', !ins.error && ins.data.length === 2, ins.error?.message);
  const up = await client.editor.storage.from('maid-private').upload('test-rt-0001.webp', img, { contentType: 'image/webp', upsert: true });
  ok('can upload a photo to the PRIVATE bucket', !up.error, up.error?.message);
  ok('can read the private photo back', !(await client.editor.storage.from('maid-private').download('test-rt-0001.webp')).error);
  const st = await client.editor.from('maids').update({ status: 'reserved', status_set_by: 'ED', status_confirmed: true }).eq('code', 'TEST-RT-0001').select().single();
  ok('can change availability', !st.error && st.data.status === 'reserved', st.error?.message);
  const pubFail = await client.editor.from('maids').update({ published: true }).eq('code', 'TEST-RT-0001');
  ok('cannot publish without consent (database rule)', !!pubFail.error);
  const pubUp0 = await client.editor.storage.from('maid-public').upload('test-rt-0001.webp', img, { contentType: 'image/webp', upsert: true });
  ok('cannot put a photo in the PUBLIC bucket before approval', !!pubUp0.error);
  const pub = await client.editor.from('maids').update({ consent_recorded: true, consent_date: '2026-10-16', approved_by: 'ED', photo_consent: true, name_consent: 'full', published: true }).eq('code', 'TEST-RT-0001');
  ok('can publish once consent, date and approver are recorded', !pub.error, pub.error?.message);
  const pubUp = await client.editor.storage.from('maid-public').upload('test-rt-0001.webp', img, { contentType: 'image/webp', upsert: true });
  ok('can now put the approved photo in the PUBLIC bucket', !pubUp.error, pubUp.error?.message);
  const pubUp2 = await client.editor.storage.from('maid-public').upload('test-rt-0002.webp', img, { contentType: 'image/webp', upsert: true });
  ok('still cannot publish a photo for a different, unapproved maid', !!pubUp2.error);
  const del = await client.editor.from('maids').delete().eq('code', 'TEST-RT-0002').select();
  ok('cannot delete a maid', !del.error && (del.data || []).length === 0);
  ok('cannot create a staff role for himself', !!(await client.editor.from('staff').insert({ user_id: users.stranger.id, email: users.stranger.email, role: 'admin' })).error);
  ok('cannot promote himself', ((await client.editor.from('staff').update({ role: 'admin' }).eq('user_id', users.editor.id).select()).data || []).length === 0);
  ok('can read the change history', ((await client.editor.from('maid_history').select('*').eq('code', 'TEST-RT-0001')).data || []).length >= 3);
  ok('cannot edit the history', ((await client.editor.from('maid_history').update({ code: 'X' }).eq('code', 'TEST-RT-0001').select()).data || []).length === 0);

  console.log('\nRole: viewer');
  ok('staff_role() = viewer', (await client.viewer.rpc('staff_role')).data === 'viewer');
  ok('can read maids', ((await client.viewer.from('maids').select('code').like('code', 'TEST-RT-%')).data || []).length === 2);
  ok('cannot add a maid', !!(await client.viewer.from('maids').insert(rec(3))).error);
  ok('cannot change a status', ((await client.viewer.from('maids').update({ status: 'placed' }).eq('code', 'TEST-RT-0001').select()).data || []).length === 0);
  ok('cannot upload a photo', !!(await client.viewer.storage.from('maid-private').upload('test-rt-0001.webp', img, { contentType: 'image/webp', upsert: true })).error);
  ok('can view the private photo', !(await client.viewer.storage.from('maid-private').download('test-rt-0001.webp')).error);

  console.log('\nRole: admin');
  ok('staff_role() = admin', (await client.admin.rpc('staff_role')).data === 'admin');
  ok('can see all staff', ((await client.admin.from('staff').select('email').like('email', `%-${tag}@example.com`)).data || []).length === 3);
  const d2 = await client.admin.from('maids').delete().eq('code', 'TEST-RT-0002').select();
  ok('can delete a maid', !d2.error && d2.data.length === 1);
  ok('the deletion is kept in the history', ((await client.admin.from('maid_history').select('id').eq('code', 'TEST-RT-0002').eq('action', 'delete')).data || []).length === 1);

  console.log('\nWebsite visitor (public key, not signed in)');
  const anon = createClient(URL_, KEY, { auth: { persistSession: false } });
  ok('cannot read maids', ((await anon.from('maids').select('*')).data || []).length === 0);
  const v = (await anon.rpc('public_maids')).data || [];
  ok('sees only the published, consented test maid (public_maids)', v.filter((x) => x.code.startsWith('TEST-RT-')).map((x) => x.code).join() === 'TEST-RT-0001');
  ok('no private fields in what visitors receive', !JSON.stringify(v).includes('internal_notes') && !JSON.stringify(v).includes('consent_date'));

  console.log('\nAccount control');
  await admin.from('staff').update({ active: false }).eq('user_id', users.editor.id);
  ok('a deactivated account loses access at once', ((await client.editor.from('maids').select('code').like('code', 'TEST-RT-%')).data || []).length === 0);
} catch (e) {
  fail++; console.error('✗ test stopped:', e.message);
} finally {
  await cleanup();
  const left = await admin.from('maids').select('code', { count: 'exact', head: true }).like('code', 'TEST-RT-%');
  const hist = await admin.from('maid_history').select('id', { count: 'exact', head: true }).like('code', 'TEST-RT-%');
  const { data: au } = await admin.auth.admin.listUsers({ perPage: 200 });
  console.log(`\nCleanup → test records left: ${left.count}, history lines: ${hist.count}, test users left: ${au.users.filter((u) => u.email?.startsWith('fc-test-')).length}`);
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
