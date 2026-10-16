#!/usr/bin/env node
// Final Choice — live photo + privacy test against the real Supabase project, using SYNTHETIC records only.
//   npm run db:phototest              create 3 TEST records + generated test images, run every check, keep them
//                                     (so the website can be built against them for a visual check)
//   npm run db:phototest -- --cleanup remove the TEST records, their images and their history lines
//
// The office secret key is used only to set up the test data (like an administrator). Every PRIVACY check is
// done with the PUBLIC key, exactly as a website visitor would. Nothing about real maids is touched.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { adminClient, anonClient, loadEnv } from './db-lib.mjs';

const db = adminClient(); const anon = anonClient();
const URL_ = loadEnv().PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const md5 = (b) => createHash('md5').update(Buffer.from(b)).digest('hex');
let pass = 0; let fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };

const T = [
  { code: 'TEST-ID-0001', name: 'Test Candidate One', first: 'Test', nat: 'indonesian', colour: '#1f6feb', publish: true, photoConsent: true, nameConsent: 'full' },
  { code: 'TEST-PH-0002', name: 'Sample Person Tester', first: 'Sample', nat: 'filipino', colour: '#0e7a40', publish: true, photoConsent: false, nameConsent: 'first' },
  { code: 'TEST-ID-0003', name: 'Test Candidate Three', first: 'Test', nat: 'indonesian', colour: '#a15c00', publish: false, photoConsent: false, nameConsent: 'none' },
];
const SK = { childcare: 'experienced', newborn: 'none', elderlyCare: 'some-experience', cooking: 'none', housekeeping: 'experienced', petCare: 'none' };

async function cleanup() {
  const { data } = await db.from('maids').select('id, code').like('code', 'TEST-%');
  const codes = (data || []).map((r) => r.code);
  await db.storage.from('maid-public').remove(T.map((t) => `${t.code.toLowerCase()}.webp`));
  await db.storage.from('maid-private').remove(T.map((t) => `${t.code.toLowerCase()}.webp`));
  await db.from('maids').delete().like('code', 'TEST-%');
  await db.from('maid_history').delete().like('code', 'TEST-%');
  const left = await db.from('maids').select('code', { count: 'exact', head: true }).like('code', 'TEST-%');
  const hist = await db.from('maid_history').select('id', { count: 'exact', head: true }).like('code', 'TEST-%');
  const pubLeft = (await db.storage.from('maid-public').list('', { limit: 100 })).data?.filter((f) => f.name.startsWith('test-')).length ?? 0;
  const privLeft = (await db.storage.from('maid-private').list('', { limit: 1000 })).data?.filter((f) => f.name.startsWith('test-')).length ?? 0;
  console.log(`Removed ${codes.length} TEST record(s). Remaining → records: ${left.count}, history: ${hist.count}, public files: ${pubLeft}, private files: ${privLeft}`);
  return left.count === 0 && hist.count === 0 && pubLeft === 0 && privLeft === 0;
}

if (process.argv.includes('--cleanup')) process.exit((await cleanup()) ? 0 : 1);

console.log('Setting up 3 SYNTHETIC test records (no real data)…');
await cleanup();
const images = {};
for (const t of T) {
  // generated test card: coloured background + the record's own code, so a wrong pairing is obvious on screen
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900"><rect width="720" height="900" fill="${t.colour}"/>
    <circle cx="360" cy="300" r="150" fill="#ffffff" opacity=".85"/><rect x="170" y="480" width="380" height="330" rx="160" fill="#ffffff" opacity=".85"/>
    <text x="360" y="120" font-family="Arial" font-size="56" font-weight="700" fill="#fff" text-anchor="middle">TEST IMAGE</text>
    <text x="360" y="870" font-family="Arial" font-size="52" font-weight="700" fill="#fff" text-anchor="middle">${t.code}</text></svg>`;
  images[t.code] = await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
  const row = {
    code: t.code, full_name: t.name, first_name: t.first, name_consent: t.nameConsent, nationality: t.nat, age: 30, show_age: true,
    experience_years: 3, overseas_experience: true, skills: SK, languages: [{ language: 'English', level: 'fluent' }],
    employment_history: [{ country: 'Singapore', duration: '2020 – 2023', duties: 'Synthetic test duties', duties_ms: 'Tugas ujian sintetik' }],
    summary_en: 'SYNTHETIC TEST PROFILE — not a real person.', summary_ms: 'PROFIL UJIAN SINTETIK — bukan orang sebenar.',
    status: 'available', status_set_by: 'TEST', status_confirmed: true, internal_notes: 'PRIVATE TEST NOTE — must never appear on the website',
    photo_path: `${t.code.toLowerCase()}.webp`,
  };
  const { error } = await db.from('maids').insert(row);
  if (error) { console.error(`✗ insert ${t.code}: ${error.message}`); process.exit(1); }
  const up = await db.storage.from('maid-private').upload(row.photo_path, images[t.code], { contentType: 'image/webp', upsert: true });
  if (up.error) { console.error(`✗ upload ${t.code}: ${up.error.message}`); process.exit(1); }
}

console.log('\n1. Upload and retrieval (office key)');
for (const t of T) {
  const { data, error } = await db.storage.from('maid-private').download(`${t.code.toLowerCase()}.webp`);
  ok(`${t.code}: private photo stored and returned unchanged`, !error && md5(await data.arrayBuffer()) === md5(images[t.code]));
  const { data: m } = await db.from('maids').select('photo_path').eq('code', t.code).single();
  ok(`${t.code}: record points to its own photo`, m?.photo_path === `${t.code.toLowerCase()}.webp`);
}

console.log('\n2. Private photos are not public');
for (const t of T) {
  const res = await fetch(`${URL_}/storage/v1/object/public/maid-private/${t.code.toLowerCase()}.webp`);
  ok(`${t.code}: public address of private photo is blocked (HTTP ${res.status})`, res.status >= 400);
}
const ad = await anon.storage.from('maid-private').download(`${T[0].code.toLowerCase()}.webp`);
ok('visitor key cannot download a private photo', !!ad.error);
const as = await anon.storage.from('maid-private').createSignedUrl(`${T[0].code.toLowerCase()}.webp`, 60);
ok('visitor key cannot create a link to a private photo', !!as.error || !as.data?.signedUrl);

console.log('\n3. Publication approval rules');
const noConsent = await db.from('maids').update({ published: true }).eq('code', 'TEST-ID-0003').select();
ok('cannot publish without consent (database rule, even for the office key)', !!noConsent.error);
const photoNoPub = await db.from('maids').update({ public_photo_path: 'test-id-0003.webp' }).eq('code', 'TEST-ID-0003').select();
ok('cannot set a website photo for an unpublished maid', !!photoNoPub.error);
for (const t of T.filter((x) => x.publish)) {
  const { error } = await db.from('maids').update({ consent_recorded: true, consent_date: '2026-10-16', approved_by: 'TEST', photo_consent: t.photoConsent, published: true }).eq('code', t.code);
  ok(`${t.code}: published after consent recorded`, !error, error?.message);
}
const p2 = await db.from('maids').update({ public_photo_path: 'test-ph-0002.webp' }).eq('code', 'TEST-PH-0002').select();
ok('cannot set a website photo without photo consent', !!p2.error);
const pu = await db.storage.from('maid-public').upload('test-id-0001.webp', images['TEST-ID-0001'], { contentType: 'image/webp', upsert: true, cacheControl: '300' });
ok('approved photo copied to the website bucket', !pu.error, pu.error?.message);
const setp = await db.from('maids').update({ public_photo_path: 'test-id-0001.webp' }).eq('code', 'TEST-ID-0001');
ok('website photo linked to the approved record', !setp.error, setp.error?.message);
const big = await db.storage.from('maid-public').upload('test-big.webp', Buffer.alloc(400 * 1024), { contentType: 'image/webp', upsert: true });
ok('website bucket rejects files over 300 KB', !!big.error);
if (!big.error) await db.storage.from('maid-public').remove(['test-big.webp']);
const jpg = await db.storage.from('maid-public').upload('test-x.jpg', images['TEST-ID-0001'], { contentType: 'image/jpeg', upsert: true });
ok('website bucket accepts WebP only', !!jpg.error);
if (!jpg.error) await db.storage.from('maid-public').remove(['test-x.jpg']);

console.log('\n4. What a website visitor receives');
const { data: pub, error: perr } = await anon.rpc('public_maids');
ok('public_maids() works with the visitor key', !perr, perr?.message);
const byCode = Object.fromEntries((pub || []).filter((r) => r.code.startsWith('TEST-')).map((r) => [r.code, r]));
ok('only the 2 published TEST records are visible', Object.keys(byCode).sort().join() === 'TEST-ID-0001,TEST-PH-0002', Object.keys(byCode).join());
ok('unpublished TEST-ID-0003 is hidden', !byCode['TEST-ID-0003']);
ok('TEST-ID-0001 has its own photo', byCode['TEST-ID-0001']?.photo_path === 'test-id-0001.webp');
ok('TEST-PH-0002 has no photo (no photo consent)', byCode['TEST-PH-0002']?.photo_path === null);
ok('full-name consent shows the full name', byCode['TEST-ID-0001']?.display_name === 'Test Candidate One');
ok('first-name consent shows the first name only', byCode['TEST-PH-0002']?.display_name === 'Sample');
ok('no private notes or consent details are returned', !JSON.stringify(pub).includes('PRIVATE TEST NOTE') && !('internal_notes' in (pub?.[0] || {})) && !('consent_date' in (pub?.[0] || {})));
const img = await fetch(`${URL_}/storage/v1/object/public/maid-public/test-id-0001.webp`);
const imgBuf = img.ok ? await img.arrayBuffer() : new ArrayBuffer(0);
ok(`approved photo loads from its public address (HTTP ${img.status}, ${img.headers.get('content-type')})`, img.ok && md5(imgBuf) === md5(images['TEST-ID-0001']));
const meta = img.ok ? await sharp(Buffer.from(imgBuf)).metadata() : {};
ok(`approved photo is 720×900 WebP (${meta.width}×${meta.height} ${meta.format})`, meta.width === 720 && meta.height === 900 && meta.format === 'webp');
const listing = await anon.storage.from('maid-public').list('', { limit: 10 });
ok('visitors cannot list the website bucket', !!listing.error || (listing.data || []).length === 0);

console.log('\n5. Live status');
await db.from('maids').update({ status: 'reserved' }).eq('code', 'TEST-ID-0001');
const st = (await anon.rpc('public_maid_status')).data?.find((r) => r.code === 'TEST-ID-0001');
ok('status change is visible to the website immediately', st?.status === 'reserved');
await db.from('maids').update({ status: 'available' }).eq('code', 'TEST-ID-0001');

console.log('\n6. History');
const { data: h } = await db.from('maid_history').select('code, action').like('code', 'TEST-%');
ok(`changes were logged (${h?.length ?? 0} entries)`, (h?.length ?? 0) >= 8);

console.log(`\n${pass} passed, ${fail} failed. TEST records are kept for the website check — remove them with: npm run db:phototest -- --cleanup`);
process.exit(fail ? 1 : 0);
