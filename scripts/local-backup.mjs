#!/usr/bin/env node
// Final Choice — full LOCAL backup of the maid biodata system (office PC only, nothing is uploaded).
//   npm run backup:local
// Copies the master record list, working photos, import/staging drafts, approval checklist, status sheet and history,
// plus a SHA-256 manifest of everything (including the original PDFs, which are listed but not copied again, because
// they already live in private-biodata/originals and must not be duplicated or altered).
// Result: private-biodata/local-backups/<date-time>/ (excluded from Git) — keep a copy on a second drive for safety.
import { mkdirSync, cpSync, existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

const P = 'private-biodata';
const stamp = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16).replace(/[:T]/g, '-');
const dest = join(P, 'local-backups', stamp);
mkdirSync(dest, { recursive: true });

const COPY = ['import/maids.csv', 'import/photos', 'import/pdfs', 'staging', 'approval', 'status', 'consent-forms'];
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);

let copied = 0; let bytes = 0;
for (const item of COPY) {
  const src = join(P, item);
  if (!existsSync(src)) continue;
  cpSync(src, join(dest, item), { recursive: true });
}
const manifest = [];
for (const f of walk(dest)) { const s = statSync(f).size; copied++; bytes += s; manifest.push(`${sha(f)}  ${s}  ${relative(dest, f).split(sep).join('/')}`); }
const originals = walk(join(P, 'originals')).map((f) => `${sha(f)}  ${statSync(f).size}  ORIGINAL:${relative(P, f).split(sep).join('/')}`);
writeFileSync(join(dest, 'MANIFEST-sha256.txt'), [`# Final Choice local backup ${stamp} (Malaysia time)`, `# ${copied} files copied (${(bytes / 1048576).toFixed(1)} MB); ${originals.length} original files listed only`, ...manifest, ...originals].join('\n') + '\n');
console.log(`✓ Backup saved in ${dest}\n  ${copied} files (${(bytes / 1048576).toFixed(1)} MB) copied · ${originals.length} original files fingerprinted (not copied, not changed)`);
