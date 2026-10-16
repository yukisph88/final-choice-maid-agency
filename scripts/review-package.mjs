#!/usr/bin/env node
// Final Choice — package the PRIVATE 52-maid review site so it can be opened on another computer (management review).
//   npm run maids:preview        (rebuild the review site first if records changed)
//   npm run review:package       → private-biodata/review-package/  (folder + password-protected zip)
//
// The package is the already-built review site (HTML, CSS, photos) plus a launcher that needs no install and no sign-in.
// It never contains PDFs, videos, spreadsheets, consent forms, passports, the CSV, internal notes or any keys.
// The zip is encrypted (AES-256); the password is saved in ZIP-PASSWORD.txt next to it — send it by a different route.
import { existsSync, readFileSync, readdirSync, statSync, rmSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';
import { randomInt } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SITE = 'private-biodata/review-site';
const OUT = 'private-biodata/review-package';
const NAME = 'Final-Choice-Review';
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

if (!existsSync(join(SITE, 'en/index.html'))) die('No review site found. Run: npm run maids:preview');

// 1. every maid has a profile (EN + BM) and a photo
const csv = readFileSync('private-biodata/import/maids.csv', 'utf8').replace(/^﻿/, '');
const codes = [...csv.matchAll(/^([A-Z0-9][A-Z0-9-]{2,29}),/gm)].map((m) => m[1].toLowerCase()).filter((c) => !c.startsWith('example') && c !== 'code');
const missing = [];
for (const c of codes) {
  for (const p of [`en/maids/${c}/index.html`, `ms/pembantu-rumah/${c}/index.html`, `images/maids/${c}.webp`]) if (!existsSync(join(SITE, p))) missing.push(p);
}
if (missing.length) die(`Review site is out of date — ${missing.length} file(s) missing (e.g. ${missing[0]}). Run: npm run maids:preview`);
console.log(`✓ ${codes.length} maid profiles (English + BM) and ${codes.length} photos present`);

// 2. safety scan of everything that would be packaged
// The staff dashboard's script bundle is left over by the build but no page uses it — never packaged.
const UNUSED = (f) => /slug_\.astro_astro_type_script/.test(f);
const files = walk(SITE).filter((f) => !UNUSED(f));
const bad = [];
for (const f of files) {
  const ext = extname(f).toLowerCase();
  if (['.pdf', '.mp4', '.mov', '.xlsx', '.xls', '.csv', '.docx', '.doc', '.zip', '.env', '.md', '.sql'].includes(ext)) bad.push(`${relative(SITE, f)}: file type not allowed`);
  if (/review\.html$/i.test(f)) bad.push(`${relative(SITE, f)}: staff review page`);
  if (['.html', '.js', '.json', '.xml', '.txt', '.css'].includes(ext)) {
    const t = readFileSync(f, 'utf8');
    const plain = t.replace(/[A-Z0-9]+(-[A-Z0-9]+)+/g, '');
    if (/\b[A-Z]{1,2}\d{7,8}\b/.test(plain)) bad.push(`${relative(SITE, f)}: looks like a passport number`);
    if (/\b\d{6}-\d{2}-\d{4}\b/.test(t)) bad.push(`${relative(SITE, f)}: looks like an IC number`);
    if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(t)) bad.push(`${relative(SITE, f)}: contains a secret key`);
    for (const j of t.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || []) {
      try { if (JSON.parse(Buffer.from(j.split('.')[1], 'base64url').toString()).role !== 'anon') bad.push(`${relative(SITE, f)}: contains a non-public key`); } catch { /* not a key */ }
    }
    if (/INTERNAL NOTES|STATUS NOT VERIFIED|internalNotes|internal_notes/.test(t)) bad.push(`${relative(SITE, f)}: contains internal staff notes`);
    const env = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
    for (const m of env.matchAll(/^(?:SUPABASE_SERVICE_ROLE_KEY|PUBLIC_SUPABASE_ANON_KEY)=(\S{20,})/gm)) if (t.includes(m[1])) bad.push(`${relative(SITE, f)}: contains a key from .env.local`);
  }
}
if (bad.length) { bad.slice(0, 10).forEach((b) => console.error('  ✗ ' + b)); die(`${bad.length} problem(s) — nothing was packaged.`); }
console.log(`✓ safety scan clean (${files.length} files, ${(files.reduce((a, f) => a + statSync(f).size, 0) / 1048576).toFixed(1)} MB): no documents, notes, numbers or keys`);

// 3. stage the folder
rmSync(OUT, { recursive: true, force: true });
const stage = join(OUT, NAME);
mkdirSync(stage, { recursive: true });
cpSync(SITE, join(stage, 'site'), { recursive: true, filter: (src) => !UNUSED(src) });
for (const f of ['server.ps1', 'START-REVIEW.bat', 'README.txt']) cpSync(join('scripts/review-package-files', f), join(stage, f));
// Windows batch files need CRLF line endings
writeFileSync(join(stage, 'START-REVIEW.bat'), readFileSync(join(stage, 'START-REVIEW.bat'), 'utf8').replace(/\r?\n/g, '\r\n'));

// 4. password-protected zip (AES-256)
const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const password = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('')).join('-');
const zip = join(OUT, `${NAME}.zip`);
execFileSync('python', ['scripts/review-package-zip.py', stage, zip], { env: { ...process.env, ZIP_PASSWORD: password }, stdio: ['ignore', 'inherit', 'inherit'] });
writeFileSync(join(OUT, 'ZIP-PASSWORD.txt'), `Password for ${NAME}.zip (AES-256):\n${password}\n\nSend the zip and this password by DIFFERENT routes (e.g. zip by USB or e-mail, password by phone call or WhatsApp).\nOpen the zip with 7-Zip (free, 7-zip.org). Windows' built-in "Extract All" cannot open AES-encrypted zips.\nOr copy the unzipped folder "${NAME}" instead and skip the password.\n`);
console.log(`\n✓ Folder : ${stage}   (copy this to a USB stick to hand over, no password needed)`);
console.log(`✓ Zip    : ${zip}   (password-protected, ${(statSync(zip).size / 1048576).toFixed(1)} MB)`);
console.log(`✓ Password is in ${join(OUT, 'ZIP-PASSWORD.txt')}  (not shown here)`);
