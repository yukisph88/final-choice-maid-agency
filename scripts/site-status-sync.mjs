#!/usr/bin/env node
// Connects the file-based PUBLIC website to the staff database by REFERENCE CODE (never by name).
//   npm run site:status-check     READ-ONLY: every published website profile must match exactly one database record
//   npm run site:status-sync      (after migration 0006) writes public_site_listing = exactly the codes that are on the public website
// The listing is NOT publication: it only lets public_site_status() answer for codes the website already shows. The held-back maid is not in
// src/content/maids, so she is never listed. Staff availability changes then reach the website through that function.
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import { adminClient } from './db-lib.mjs';

const APPLY = process.argv.includes('--apply');
const HIDDEN = ['hired', 'placed', 'unavailable', 'withdrawn']; const CONTENT = 'src/content/maids';
const site = fs.readdirSync(CONTENT).filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => load(/^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(path.join(CONTENT, f), 'utf8').replace(/\r\n/g, '\n'))[1]))
  .filter((m) => m.published && m.publication?.consentRecorded && !HIDDEN.includes(m.status)).map((m) => String(m.code));
const db = adminClient();
const { data: maids, error } = await db.from('maids').select('code, status, status_confirmed, published'); if (error) throw error;
const codes = new Set(maids.map((m) => m.code)); const matched = site.filter((c) => codes.has(c)); const missing = site.filter((c) => !codes.has(c));
const notOnSite = maids.map((m) => m.code).filter((c) => !site.includes(c));
console.log(`Public website profiles: ${site.length} · database records: ${maids.length}`);
console.log(`Matched by reference code: ${matched.length}/${site.length}${missing.length ? '  — NOT in the database: ' + missing.join(', ') : ''}`);
console.log(`Database records not on the public website (stay unlisted): ${notOnSite.length}${notOnSite.length ? ' — ' + notOnSite.join(', ') : ''}`);
console.log(`Of the matched: confirmed by staff ${maids.filter((m) => matched.includes(m.code) && m.status_confirmed).length}, still To Be Confirmed ${maids.filter((m) => matched.includes(m.code) && !m.status_confirmed).length}; database-published flag set: ${maids.filter((m) => matched.includes(m.code) && m.published).length}`);
if (missing.length) { console.error('✗ Some website profiles have no database record — fix before enabling live status.'); process.exit(1); }
if (!process.argv.includes('--sync')) { console.log('\nRead-only check passed. (npm run site:status-sync writes the listing once migration 0006 has been run.)'); process.exit(0); }
const { error: e0 } = await db.from('public_site_listing').select('code', { head: true, count: 'exact' });
if (e0) { console.error(`✗ public_site_listing is not available (${e0.message}). Run supabase/migrations/0006_public_site_status.sql in the SQL Editor first.`); process.exit(1); }
const { data: cur } = await db.from('public_site_listing').select('code'); const have = new Set((cur || []).map((r) => r.code));
const add = site.filter((c) => !have.has(c)); const drop = [...have].filter((c) => !site.includes(c));
console.log(`\nListing now: ${have.size} · to add: ${add.length} · to remove: ${drop.length}`);
if (!APPLY) { console.log('Dry run. Add --apply to write.'); process.exit(0); }
if (add.length) { const { error: e1 } = await db.from('public_site_listing').insert(add.map((code) => ({ code }))); if (e1) throw e1; }
if (drop.length) { const { error: e2 } = await db.from('public_site_listing').delete().in('code', drop); if (e2) throw e2; }
const { count } = await db.from('public_site_listing').select('*', { count: 'exact', head: true }); console.log(`✓ Listing written: ${count} code(s). Nothing was published and no maid record was changed.`);
