#!/usr/bin/env node
// Runs the staff portal's own database calls against the REAL imported records, signed in as temporary test users (admin / editor / viewer).
// READ-ONLY on real records: it lists, searches, opens photos, history and reports exactly like the portal does; permission checks try to write
// and must be refused. Test users are removed again. Writes (add/edit/photo/status) are tested on synthetic records by `npm run db:roletest` and `npm run import:savetest`.
//   npm run db:portal-readtest
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { adminClient, loadEnv } from './db-lib.mjs';

const env = loadEnv(); const admin = adminClient(); const URL_ = env.PUBLIC_SUPABASE_URL.replace(/\/$/, ''); const KEY = env.PUBLIC_SUPABASE_ANON_KEY;
let pass = 0; let fail = 0; const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${c ? '' : ' — ' + x}`); };
const tag = randomBytes(3).toString('hex'); const users = {}; const client = {};
try {
  for (const role of ['admin', 'editor', 'viewer']) {
    const email = `fc-test-read-${role}-${tag}@example.com`; const password = randomBytes(18).toString('base64url') + 'aA1!';
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (error) throw new Error(error.message);
    users[role] = { id: data.user.id }; await admin.from('staff').insert({ user_id: data.user.id, email, full_name: `Test ${role}`, role, active: true });
    client[role] = createClient(URL_, KEY, { auth: { persistSession: false } }); const s = await client[role].auth.signInWithPassword({ email, password }); if (s.error) throw new Error(s.error.message);
  }
  for (const role of ['admin', 'editor', 'viewer']) {
    console.log(`\nSigned in as ${role}`);
    const c = client[role];
    const { data: maids, error } = await c.from('maids').select('*').order('nationality').order('full_name');
    ok('All Maid Biodata lists 52 records', !error && maids.length === 52, error?.message || String(maids?.length));
    ok('Overview counts: 41 Indonesian, 11 Filipino, 52 To Be Confirmed, 0 published', maids.filter((m) => m.nationality === 'indonesian').length === 41 && maids.filter((m) => m.nationality === 'filipino').length === 11 && maids.every((m) => m.status === 'to-be-confirmed') && maids.every((m) => !m.published));
    const q = (s) => maids.filter((m) => (m.code + ' ' + m.full_name).toLowerCase().includes(s)); ok('search by code and by name finds the record', q(maids[0].code.toLowerCase()).length >= 1 && q(maids[5].full_name.toLowerCase().split(' ')[0]).length >= 1);
    ok('every record opens with full biodata (name, nationality, work history, skills)', maids.every((m) => m.full_name && m.nationality && Array.isArray(m.employment_history) && m.skills && typeof m.skills === 'object'));
    const paths = maids.map((m) => m.photo_path).filter(Boolean); const urls = []; for (let i = 0; i < paths.length; i += 100) { const { data } = await c.storage.from('maid-private').createSignedUrls(paths.slice(i, i + 100), 120); urls.push(...(data || [])); }
    ok('signed links created for 52 private photos', urls.filter((u) => u.signedUrl).length === 52, String(urls.filter((u) => u.signedUrl).length));
    let shown = 0; for (const u of urls.slice(0, 52)) { const r = await fetch(u.signedUrl); if (r.ok) { const m = await sharp(Buffer.from(await r.arrayBuffer())).metadata(); if (m.width === 720 && m.height === 900) shown++; } }
    ok(`the portal can display all photos (${shown}/52 load as 720×900)`, shown === 52);
    const hist = await c.from('maid_history').select('*').eq('maid_id', maids.find((m) => m.code === 'S1-32-HFNY-IJM127').id).order('changed_at', { ascending: false }); ok('change history is readable (who / when / what)', !hist.error && hist.data.length > 0 && hist.data[0].changed_by_email);
    const pl = await c.from('placements').select('id'); ok('placements table readable', !pl.error);
    if (role === 'viewer') { const w = await c.from('maids').update({ internal_notes: 'x' }).eq('code', maids[0].code).select(); ok('viewer cannot edit a record', !!w.error || (w.data || []).length === 0); }
    if (role !== 'admin') {   // destructive attempts are made only by roles the database must refuse; the administrator's writes are tested on synthetic records (db:roletest)
      const pub = await c.from('maids').update({ published: true }).eq('code', maids[1].code).select(); ok(`${role} cannot publish a real record`, !!pub.error || (pub.data || []).length === 0);
      const del = await c.from('maids').delete().eq('code', maids[1].code).select(); ok(`${role} cannot delete a real record`, !!del.error || (del.data || []).length === 0);
    }
  }
  const { count } = await admin.from('maids').select('*', { count: 'exact', head: true }); ok('still 52 records after the test', count === 52);
} catch (e) { fail++; console.error('✗ stopped:', e.message); } finally {
  for (const u of Object.values(users)) { await admin.from('staff').delete().eq('user_id', u.id); await admin.auth.admin.deleteUser(u.id); }
  const { data: au } = await admin.auth.admin.listUsers({ perPage: 200 }); console.log(`\nCleanup → test users left: ${au.users.filter((u) => u.email?.startsWith('fc-test-')).length}`);
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
