#!/usr/bin/env node
// Final Choice — full local backup of the Supabase database and files (office PC only).
//   npm run db:backup
// The Supabase Free Plan has NO automatic backups, so run this at least once a week (and it runs automatically
// before every db:migrate --apply). Backups go to private-biodata/db-backups/<date-time>/ — never to GitHub.
//   maids.json / maids.csv · maid_history.json · staff.json · files/maid-private/… · files/maid-public/… · REPORT.txt
// It also checks that no photo in the PUBLIC bucket belongs to a maid who is not published with photo consent.
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { adminClient, readAll, listAll, stamp } from './db-lib.mjs';

const db = adminClient();
const out = join('private-biodata', 'db-backups', stamp());
mkdirSync(out, { recursive: true });

const maids = await readAll(db, 'maids', 'code');
const history = await readAll(db, 'maid_history', 'id');
const staff = await readAll(db, 'staff', 'email');
writeFileSync(join(out, 'maids.json'), JSON.stringify(maids, null, 1));
writeFileSync(join(out, 'maid_history.json'), JSON.stringify(history, null, 1));
writeFileSync(join(out, 'staff.json'), JSON.stringify(staff, null, 1));
if (maids.length) {
  const cols = Object.keys(maids[0]);
  const q = (v) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  writeFileSync(join(out, 'maids.csv'), '﻿' + [cols.join(','), ...maids.map((m) => cols.map((c) => q(m[c])).join(','))].join('\r\n') + '\r\n');
}

let files = 0; let bytes = 0;
for (const bucket of ['maid-private', 'maid-public']) {
  for (const f of await listAll(db, bucket)) {
    const { data, error } = await db.storage.from(bucket).download(f.path);
    if (error) { console.error(`✗ ${bucket}/${f.path}: ${error.message}`); continue; }
    const dest = join(out, 'files', bucket, f.path);
    mkdirSync(dirname(dest), { recursive: true });
    const buf = Buffer.from(await data.arrayBuffer());
    writeFileSync(dest, buf); files++; bytes += buf.length;
  }
}

// privacy audit: public photos must belong to published maids with photo consent
const okPublic = new Set(maids.filter((m) => m.published && m.photo_consent && m.consent_recorded).map((m) => `${m.code.toLowerCase()}.webp`));
const publicFiles = await listAll(db, 'maid-public');
const stray = publicFiles.filter((f) => !okPublic.has(f.path)).map((f) => f.path);

const report = [
  `Final Choice database backup — ${new Date().toISOString()}`,
  `maids: ${maids.length} (published: ${maids.filter((m) => m.published).length})`,
  `history entries: ${history.length}`,
  `staff accounts: ${staff.length}`,
  `files: ${files} (${(bytes / 1048576).toFixed(1)} MB)`,
  stray.length ? `WARNING — public photos without approval: ${stray.join(', ')} (delete them in the dashboard)` : 'public photos: all approved',
].join('\n');
writeFileSync(join(out, 'REPORT.txt'), report + '\n');
console.log(report);
console.log(`\n✓ Backup saved in ${out}`);
const all = readdirSync(join('private-biodata', 'db-backups'));
if (all.length > 30) console.log(`  (${all.length} backups kept — you may delete the oldest ones in private-biodata/db-backups/)`);
if (stray.length) process.exitCode = 2;
