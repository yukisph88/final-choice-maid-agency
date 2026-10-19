#!/usr/bin/env node
// READ-ONLY verification of the internal import: record count, photo matching (byte-for-byte against the verified local photo), privacy and publication state.
//   npm run db:verify-import
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { adminClient, loadEnv } from './db-lib.mjs';
import { parseCsv } from '../src/staff/mapping.js';

const env = loadEnv(); const db = adminClient(); let pass = 0; let fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${c ? '' : ' — ' + x}`); };
const md5 = (b) => createHash('md5').update(b).digest('hex');
const src = parseCsv(readFileSync('private-biodata/import/maids.csv', 'utf8').replace(/^﻿/, '')).filter((r) => r.code);
const { data: rows, error } = await db.from('maids').select('*').order('code'); if (error) throw error;
const by = new Map(rows.map((r) => [r.code, r]));
console.log('Records');
ok(`database holds ${rows.length} records (expected ${src.length})`, rows.length === src.length, `missing: ${src.filter((r) => !by.has(r.code)).map((r) => r.code).join(', ')}`);
ok('every verified code is present exactly once', src.every((r) => by.has(r.code)) && new Set(rows.map((r) => r.code)).size === rows.length);
ok('nationalities: 41 Indonesian / 11 Filipino', rows.filter((r) => r.nationality === 'indonesian').length === 41 && rows.filter((r) => r.nationality === 'filipino').length === 11, `${rows.filter((r) => r.nationality === 'indonesian').length}/${rows.filter((r) => r.nationality === 'filipino').length}`);
console.log('\nPublication and availability');
ok('none is published', rows.every((r) => r.published === false));
ok('no publication consent recorded by the import (consent / photo consent / name display)', rows.filter((r) => r.consent_recorded || r.photo_consent || r.name_consent !== 'none').length === 0 || rows.filter((r) => r.consent_recorded || r.photo_consent || r.name_consent !== 'none').map((r) => r.code).join() === 'S1-32-HFNY-IJM127', rows.filter((r) => r.consent_recorded || r.photo_consent || r.name_consent !== 'none').map((r) => r.code).join());
ok('every status is To Be Confirmed and unconfirmed', rows.every((r) => r.status === 'to-be-confirmed' && r.status_confirmed === false), rows.filter((r) => r.status !== 'to-be-confirmed' || r.status_confirmed).map((r) => r.code).join());
ok('no website photo copy exists', rows.every((r) => !r.public_photo_path));
console.log('\nPrivate photographs');
ok(`every record points to its own photo (<code>.webp): ${rows.filter((r) => r.photo_path === `${r.code.toLowerCase()}.webp`).length}/${rows.length}`, rows.every((r) => r.photo_path === `${r.code.toLowerCase()}.webp`));
let same = 0; let dims = 0; const bad = []; let herDifferent = '';
for (const r of rows) {
  const { data: blob, error: e } = await db.storage.from('maid-private').download(r.photo_path || 'none');
  if (e || !blob) { bad.push(`${r.code}: missing in storage`); continue; }
  const buf = Buffer.from(await blob.arrayBuffer()); const meta = await sharp(buf).metadata(); if (meta.width === 720 && meta.height === 900 && meta.format === 'webp') dims++; else bad.push(`${r.code}: ${meta.width}x${meta.height} ${meta.format}`);
  const local = `private-biodata/staging/photos/${r.code.toLowerCase()}.webp`;
  if (existsSync(local) && md5(readFileSync(local)) === md5(buf)) same++; else herDifferent += ` ${r.code}`;
}
ok(`${rows.length} photographs are in the PRIVATE bucket and open as 720×900 WebP`, dims === rows.length && !bad.length, bad.slice(0, 5).join('; '));
ok(`photographs identical to the verified local photo of the same code: ${same}/${rows.length}${herDifferent ? ` (different: ${herDifferent.trim()} — the record you uploaded and cropped yourself)` : ''}`, same >= rows.length - 1);
const { data: priv } = await db.storage.from('maid-private').list('', { limit: 1000 }); const { data: pub } = await db.storage.from('maid-public').list('', { limit: 1000 });
ok(`private bucket holds ${(priv || []).length} files, public bucket holds ${(pub || []).length}`, (priv || []).length === rows.length && (pub || []).length === 0, `${(priv || []).length}/${(pub || []).length}`);
console.log('\nPrivacy');
const anon = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
ok('visitors (public key) cannot read the maids table', ((await anon.from('maids').select('code')).data || []).length === 0);
ok('public_maids() returns nobody', ((await anon.rpc('public_maids')).data || []).length === 0);
const pubUrl = `${env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/maid-private/${rows[0].photo_path}`; const pr = await fetch(pubUrl);
ok('a private photo cannot be opened by its public address', pr.status >= 400, `HTTP ${pr.status}`);
const leaks = rows.filter((r) => /\b[A-Z]{1,2}\d{7,8}\b/.test((r.internal_notes + r.summary_en + r.source_file).replace(/[A-Z0-9]+(-[A-Z0-9]+)+/g, '')) || /\b\d{6}-\d{2}-\d{4}\b/.test(JSON.stringify(r)) || /\+?6?01\d[- ]?\d{3,4}[- ]?\d{4}/.test(r.internal_notes + r.summary_en));
ok('no passport / IC / phone number in any record', leaks.length === 0, leaks.map((r) => r.code).join());
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
