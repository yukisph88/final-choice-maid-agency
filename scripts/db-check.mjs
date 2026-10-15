#!/usr/bin/env node
// Final Choice — live security check against the real Supabase project, as a WEBSITE VISITOR would see it.
//   npm run db:check
// Uses only the public (anon) key. Every check must pass before the website is connected to the database.
import { anonClient, adminClient, loadEnv } from './db-lib.mjs';

const anon = anonClient();
let pass = 0; let fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };

console.log('Website visitor (public key) access');
for (const t of ['maids', 'maid_history', 'staff']) {
  const { data, error } = await anon.from(t).select('*').limit(1);
  ok(`cannot read table ${t}`, !!error || (data ?? []).length === 0, error ? '' : `(got ${data.length} row)`);
}
const ins = await anon.from('maids').insert({ code: 'HACK-0001', nationality: 'filipino' });
ok('cannot add a maid', !!ins.error);
const pub = await anon.rpc('public_maids');
ok('public_maids() works', !pub.error, pub.error?.message);
const leaked = (pub.data || []).filter((r) => 'internal_notes' in r || 'full_name' in r || 'consent_date' in r);
ok('public_maids() has no private columns', leaked.length === 0);
const st = await anon.rpc('public_maid_status');
ok('public_maid_status() works', !st.error, st.error?.message);
const priv = await anon.storage.from('maid-private').list('', { limit: 5 });
ok('cannot list private files', !!priv.error || (priv.data || []).length === 0);
const pubList = await anon.storage.from('maid-public').list('', { limit: 5 });
ok('cannot list public bucket (photos load only by exact address)', !!pubList.error || (pubList.data || []).length === 0);
const up = await anon.storage.from('maid-public').upload('hack.webp', new Blob(['x'], { type: 'image/webp' }));
ok('cannot upload to public bucket', !!up.error);

if (loadEnv().SUPABASE_SERVICE_ROLE_KEY) {
  console.log('\nRecords (office view)');
  const db = adminClient();
  const { data: maids } = await db.from('maids').select('code, published, consent_recorded, photo_consent, public_photo_path');
  const bad = (maids || []).filter((m) => m.published && !m.consent_recorded);
  ok(`no published maid without consent (${(maids || []).length} records, ${(maids || []).filter((m) => m.published).length} published)`, bad.length === 0);
  const codes = (maids || []).map((m) => m.code);
  ok('no duplicate reference codes', new Set(codes).size === codes.length);
  const publicIds = new Set((pub.data || []).map((r) => r.code));
  const notAllowed = [...publicIds].filter((c) => { const m = maids.find((x) => x.code === c); return !m || !m.published || !m.consent_recorded; });
  ok('website shows only published, consented maids', notAllowed.length === 0, notAllowed.join(', '));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
