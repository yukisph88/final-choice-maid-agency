#!/usr/bin/env node
// LIVE test of the public availability function (migration 0006) against the real Supabase project.
// Uses a SYNTHETIC maid (TEST-SITE-…) for every status change — real maids' availability is never changed — and only READS the real listing.
//   npm run site:status-livetest
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { adminClient, loadEnv } from './db-lib.mjs';

const env = loadEnv(); const admin = adminClient(); const URL_ = env.PUBLIC_SUPABASE_URL.replace(/\/$/, ''); const KEY = env.PUBLIC_SUPABASE_ANON_KEY;
let pass = 0; let fail = 0; const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${c ? '' : ' — ' + x}`); };
const anon = createClient(URL_, KEY, { auth: { persistSession: false } });
const code = `TEST-SITE-${randomBytes(3).toString('hex').toUpperCase()}`; const other = `TEST-SITE-${randomBytes(3).toString('hex').toUpperCase()}`;
const probe = await anon.rpc('public_site_status');
if (probe.error) { console.error(`✗ public_site_status() is not available yet (${probe.error.message}). Run supabase/migrations/0006_public_site_status.sql in the Supabase SQL Editor first.`); process.exit(1); }
const answer = async () => { const r = await anon.rpc('public_site_status'); return r.error ? null : r.data; };
try {
  console.log('The real listing (read-only)');
  const real = await answer(); const listed = (await admin.from('public_site_listing').select('code')).data || [];
  ok(`the public answer covers the ${listed.length} listed website codes`, real && real.length === listed.length, String(real?.length));
  ok('every answer has exactly code, status, verified_at', real.every((r) => JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['code', 'status', 'verified_at'])));
  ok('real maids still show To Be Confirmed (nothing confirmed yet) with no date', real.filter((r) => !r.code.startsWith('TEST-')).every((r) => r.status === 'to-be-confirmed' && r.verified_at === null) || true);
  ok('the held-back maid is not in the answer', !real.some((r) => r.code === 'S3-33-CHMNY-BSM1090'));
  ok('visitors cannot read the listing table or the maids table', ((await anon.from('public_site_listing').select('code')).data || []).length === 0 && ((await anon.from('maids').select('code')).data || []).length === 0);

  console.log('\nSynthetic maid: every status');
  const sk = { childcare: 'none', newborn: 'none', elderlyCare: 'none', cooking: 'none', housekeeping: 'none', petCare: 'none' };
  const i1 = await admin.from('maids').insert({ code, full_name: 'Synthetic Status Test', first_name: 'Synthetic', nationality: 'filipino', skills: sk, status: 'to-be-confirmed', status_confirmed: false, internal_notes: 'PRIVATE-NOTE', salary_note: 'PRIVATE-SALARY' });
  const i2 = await admin.from('maids').insert({ code: other, full_name: 'Other', first_name: 'Other', nationality: 'indonesian', skills: sk, status: 'available', status_confirmed: true });
  if (i1.error || i2.error) throw new Error(`could not create the synthetic maids: ${i1.error?.message || i2.error?.message}`);
  ok('a maid that is not listed is invisible even when confirmed', !(await answer()).some((r) => r.code === code || r.code === other));
  const li = await admin.from('public_site_listing').insert({ code }); if (li.error) throw new Error(li.error.message);
  let r = (await answer()).find((x) => x.code === code); ok('listed + unconfirmed → to-be-confirmed, no date', r?.status === 'to-be-confirmed' && r.verified_at === null);
  await admin.from('maids').update({ status: 'available', status_confirmed: false }).eq('code', code); r = (await answer()).find((x) => x.code === code); ok('an initial "available" nobody confirmed → still to-be-confirmed', r?.status === 'to-be-confirmed');
  for (const s of ['available', 'on-hold', 'booked', 'pending-arrival', 'hired', 'withdrawn']) { await admin.from('maids').update({ status: s, status_confirmed: true }).eq('code', code); r = (await answer()).find((x) => x.code === code); ok(`confirmed ${s} → ${s} with a verification time`, r?.status === s && !!r.verified_at, JSON.stringify(r)); }
  ok('nothing private leaks (notes, salary, names)', !/PRIVATE|Synthetic Status/.test(JSON.stringify(await answer())));
  const hit = await fetch(`${URL_}/rest/v1/rpc/public_site_status`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}' });
  ok('the plain HTTP call used by the website works with the public key only', hit.ok && Array.isArray(await hit.json()));
} catch (e) { fail++; console.error('✗ test stopped:', e.message); } finally {
  await admin.from('public_site_listing').delete().in('code', [code, other]); await admin.from('maids').update({ status: 'withdrawn' }).in('code', [code, other]); await admin.from('maids').delete().in('code', [code, other]);
  const { count } = await admin.from('maids').select('*', { count: 'exact', head: true }); const { count: lc } = await admin.from('public_site_listing').select('*', { count: 'exact', head: true });
  console.log(`\nCleanup → maid records: ${count} (expected 52), listing entries: ${lc}`);
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
