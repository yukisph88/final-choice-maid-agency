#!/usr/bin/env node
// Final Choice — restore maid records and files from a local backup (office PC only).
//   npm run db:restore -- private-biodata/db-backups/<folder>            DRY RUN: shows what would be restored
//   npm run db:restore -- private-biodata/db-backups/<folder> --apply    Restore
//
// Use after: an accidental change, a deleted record, or setting up a NEW Supabase project (run the two SQL files in
// supabase/migrations first). Matches by reference code — never creates duplicates. Maids that are in the database
// but not in the backup are left alone. Staff accounts are not recreated (invite them again in Supabase → Authentication,
// then add them to the staff table). The old change history stays in maid_history.json in the backup folder.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execSync } from 'node:child_process';
import { adminClient } from './db-lib.mjs';

const [dir, ...rest] = process.argv.slice(2);
const APPLY = rest.includes('--apply');
if (!dir || !existsSync(join(dir, 'maids.json'))) { console.error('Usage: npm run db:restore -- private-biodata/db-backups/<folder> [--apply]'); process.exit(1); }
const db = adminClient();
const backup = JSON.parse(readFileSync(join(dir, 'maids.json'), 'utf8'));
const { data: now, error } = await db.from('maids').select('code, updated_at');
if (error) { console.error('✗', error.message); process.exit(1); }
const have = new Map(now.map((m) => [m.code, m]));
console.log(`${APPLY ? 'RESTORING' : 'DRY RUN'} from ${dir}: ${backup.length} record(s) in backup, ${now.length} in database`);
for (const m of backup) console.log(`${have.has(m.code) ? '~ overwrite' : '+ restore  '} ${m.code}`);
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : []);
const files = walk(join(dir, 'files'));
console.log(`${files.length} file(s) to upload`);
if (!APPLY) { console.log('\nDry run only. Add --apply to restore.'); process.exit(0); }
if (now.length) { console.log('\nBacking up the current state first…'); execSync('node scripts/db-backup.mjs', { stdio: 'inherit' }); }
const strip = ({ id, created_at, updated_at, updated_by, ...m }) => m;
for (let i = 0; i < backup.length; i += 100) {
  const { error: e } = await db.from('maids').upsert(backup.slice(i, i + 100).map(strip), { onConflict: 'code' });
  if (e) { console.error('✗', e.message); process.exit(1); }
}
let n = 0;
for (const f of files) {
  const [bucket, ...p] = relative(join(dir, 'files'), f).split(sep);
  const type = f.endsWith('.pdf') ? 'application/pdf' : f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
  const { error: e } = await db.storage.from(bucket).upload(p.join('/'), readFileSync(f), { contentType: type, upsert: true });
  if (e) console.error(`✗ ${bucket}/${p.join('/')}: ${e.message}`); else n++;
}
console.log(`\n✓ ${backup.length} record(s) and ${n} file(s) restored.`);
