#!/usr/bin/env node
// Final Choice — maid biodata manager (runs on the office PC; free, no online services).
//
//   npm run maids:import                 Read private-biodata/import/maids.csv + photos → private staging + REVIEW.html
//   npm run maids:publish -- CODE …      Copy reviewed, consented candidates from staging to the website
//   npm run maids:status  -- CODE STATUS Change status (available | interview-pending | reserved | processing |
//                                        placed | unavailable | withdrawn) and today's statusUpdated date
//   npm run maids:feature -- CODE on|off Show / hide a candidate in the homepage "featured" row
//   npm run maids:archive                Move placed + withdrawn candidates off the website into private-biodata/archive/
//   npm run maids:list                   Show every candidate on the website with status
//
// Nothing in private-biodata/ is ever committed to Git (see .gitignore). Only files copied by
// "publish" into src/content/maids, public/images/maids and public/biodata become public.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, renameSync, rmSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const ROOT = process.cwd();
const PRIV = join(ROOT, 'private-biodata');
const IMPORT = join(PRIV, 'import');
const STAGING = join(PRIV, 'staging');
const ARCHIVE = join(PRIV, 'archive');
const CONTENT = join(ROOT, 'src/content/maids');
const PHOTOS = join(ROOT, 'public/images/maids');
const PDFS = join(ROOT, 'public/biodata');

const NATIONALITIES = ['indonesian', 'filipino'];
const LEVELS = ['experienced', 'some-experience', 'willing-to-learn', 'none'];
const LANG_LEVELS = ['basic', 'conversational', 'fluent', 'native'];
const STATUSES = ['available', 'interview-pending', 'reserved', 'processing', 'placed', 'unavailable', 'withdrawn'];
const SKILLS = ['childcare', 'newborn', 'elderlyCare', 'cooking', 'housekeeping', 'petCare'];
const RESERVED = ['indonesian-maids', 'filipino-maids', 'indonesia', 'filipina', 'page'];
const PASSPORT = /\b[A-Z]{1,2}\d{7,8}\b/;
const MYKAD = /\b\d{6}-\d{2}-\d{4}\b/;
const PHONE = /(\+?6?01\d[- ]?\d{3,4}[- ]?\d{4})/;
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Malaysia date

const [cmd, ...args] = process.argv.slice(2);
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const yes = (v) => /^(y|yes|true|1|ya)$/i.test(String(v ?? '').trim());
const ensure = (d) => mkdirSync(d, { recursive: true });

// ---------- CSV (handles quotes, commas and line breaks inside quotes; Excel "CSV UTF-8") ----------
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// ---------- YAML front matter writer (strings are JSON-quoted, which is valid YAML) ----------
const s = (v) => JSON.stringify(String(v));
function toMarkdown(m) {
  const L = [];
  L.push('---');
  L.push(`code: ${s(m.code)}`);
  if (m.displayName) L.push(`displayName: ${s(m.displayName)}`);
  L.push(`nationality: ${m.nationality}`);
  if (m.age) L.push(`age: ${m.age}`);
  if (m.religion) L.push(`religion: ${s(m.religion)}`);
  if (m.maritalStatus) L.push(`maritalStatus: ${s(m.maritalStatus)}`);
  L.push(`experienceYears: ${m.experienceYears}`);
  L.push(`overseasExperience: ${m.overseasExperience}`);
  L.push('skills:');
  for (const k of SKILLS) L.push(`  ${k}: ${m.skills[k]}`);
  L.push(m.languages.length ? 'languages:' : 'languages: []');
  for (const l of m.languages) L.push(`  - language: ${s(l.language)}\n    level: ${l.level}`);
  L.push(m.employmentHistory.length ? 'employmentHistory:' : 'employmentHistory: []');
  for (const e of m.employmentHistory) L.push(`  - country: ${s(e.country)}\n    duration: ${s(e.duration)}\n    duties: ${s(e.duties)}`);
  L.push(`status: ${m.status}`);
  L.push(`statusUpdated: ${m.statusUpdated}`);
  if (m.interviewAvailability) L.push(`interviewAvailability: ${s(m.interviewAvailability)}`);
  if (m.interviewAvailability_ms) L.push(`interviewAvailability_ms: ${s(m.interviewAvailability_ms)}`);
  if (m.summary_ms) L.push(`summary_ms: ${s(m.summary_ms)}`);
  if (m.photo) L.push(`photo: ${s(m.photo)}`);
  if (m.biodataPdf) L.push(`biodataPdf: ${s(m.biodataPdf)}`);
  L.push(`featured: ${m.featured}`);
  L.push(`published: ${m.published}`);
  L.push('publication:');
  L.push(`  consentRecorded: ${m.publication.consentRecorded}`);
  L.push(`  consentDate: ${m.publication.consentDate}`);
  L.push(`  photoConsent: ${m.publication.photoConsent}`);
  L.push(`  showAge: ${m.publication.showAge}`);
  L.push(`  approvedBy: ${s(m.publication.approvedBy)}`);
  L.push('---');
  L.push(m.summary || '');
  return L.join('\n') + '\n';
}

// ---------- Row → candidate, with checks ----------
function fromRow(r) {
  const errors = []; const warnings = [];
  const code = (r.code || '').toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(code)) errors.push('Code must be 3–30 capitals, numbers or hyphens');
  if (RESERVED.includes(code.toLowerCase())) errors.push('Code is a reserved word');
  const nationality = (r.nationality || '').toLowerCase();
  if (!NATIONALITIES.includes(nationality)) errors.push('nationality must be indonesian or filipino');
  const status = (r.status || 'available').toLowerCase();
  if (!STATUSES.includes(status)) errors.push(`status must be one of: ${STATUSES.join(', ')}`);
  const exp = Number(r.experienceYears || 0);
  if (!Number.isFinite(exp) || exp < 0 || exp > 40) errors.push('experienceYears must be a number 0–40');
  const age = r.age ? Number(r.age) : undefined;
  if (age !== undefined && (!Number.isInteger(age) || age < 21 || age > 60)) errors.push('age must be 21–60');
  const skills = {};
  for (const k of SKILLS) {
    const v = (r[k] || 'none').toLowerCase();
    if (!LEVELS.includes(v)) errors.push(`${k} must be one of: ${LEVELS.join(', ')}`);
    skills[k] = v;
  }
  const languages = (r.languages || '').split(';').map((x) => x.trim()).filter(Boolean).map((x) => {
    const [language, level = 'conversational'] = x.split(':').map((y) => y.trim());
    if (!LANG_LEVELS.includes(level.toLowerCase())) errors.push(`language level "${level}" must be ${LANG_LEVELS.join('/')}`);
    return { language, level: level.toLowerCase() };
  });
  // One job per line inside the Excel cell (Alt+Enter): Country|Duration|Duties
  const employmentHistory = (r.employmentHistory || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const [country = '', duration = '', duties = ''] = x.split('|').map((y) => y.trim());
    if (!country || !duration) errors.push('employmentHistory entries need "Country|Duration|Duties"');
    if (duties.length > 200) errors.push('employmentHistory duties must be 200 characters or fewer');
    return { country, duration, duties };
  });
  const consentRecorded = yes(r.consentRecorded);
  const consentDate = r.consentDate || '';
  if (consentRecorded && !/^\d{4}-\d{2}-\d{2}$/.test(consentDate)) errors.push('consentDate must be YYYY-MM-DD');
  if (!consentRecorded) warnings.push('No recorded consent — this candidate CANNOT be published');
  if (!r.approvedBy) warnings.push('approvedBy (staff initials) is empty');
  const allText = Object.values(r).join(' ');
  if (PASSPORT.test(allText)) errors.push('Text looks like a passport number — remove it');
  if (MYKAD.test(allText)) errors.push('Text looks like an IC number — remove it');
  if (PHONE.test(allText)) errors.push('Text looks like a phone number — remove it');
  const m = {
    code, displayName: r.displayName, nationality, age, religion: r.religion, maritalStatus: r.maritalStatus,
    experienceYears: exp, overseasExperience: yes(r.overseasExperience), skills, languages, employmentHistory,
    status, statusUpdated: today(), interviewAvailability: r.interviewAvailability, interviewAvailability_ms: r.interviewAvailability_ms,
    summary: r.summary, summary_ms: r.summary_ms, featured: yes(r.featured), published: false,
    publication: { consentRecorded, consentDate: consentDate || today(), photoConsent: yes(r.photoConsent), showAge: yes(r.showAge), approvedBy: (r.approvedBy || 'XX').slice(0, 10) },
    pdfApproved: yes(r.biodataPdfApproved),
  };
  return { m, errors, warnings };
}

const findFile = (dir, code, exts) => {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => basename(n, extname(n)).toUpperCase() === code && exts.includes(extname(n).toLowerCase()));
  return f ? join(dir, f) : null;
};
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- import ----------
async function importCsv() {
  const csvPath = join(IMPORT, 'maids.csv');
  if (!existsSync(csvPath)) die(`Not found: private-biodata/import/maids.csv (copy scripts/maids-import-template.csv there)`);
  const sharp = (await import('sharp')).default;
  const rows = parseCsv(readFileSync(csvPath, 'utf8')).filter((r) => r.code && !/^EXAMPLE/i.test(r.code));
  ensure(join(STAGING, 'photos')); ensure(join(STAGING, 'pdfs'));
  const report = [];
  for (const r of rows) {
    const { m, errors, warnings } = fromRow(r);
    const slug = m.code.toLowerCase();
    const src = findFile(join(IMPORT, 'photos'), m.code, ['.jpg', '.jpeg', '.png', '.webp']);
    if (src && !m.publication.photoConsent) warnings.push('Photo found but photoConsent is not "yes" — photo will NOT be used');
    if (src && m.publication.photoConsent) {
      // 4:5 portrait, smart crop that keeps the face; metadata (incl. GPS) is stripped by sharp
      await sharp(src).rotate().resize(720, 900, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 80 }).toFile(join(STAGING, 'photos', `${slug}.webp`));
      m.photo = `images/maids/${slug}.webp`;
    } else if (!src) warnings.push('No photo (a neutral placeholder will be shown)');
    const pdf = findFile(join(IMPORT, 'pdfs'), m.code, ['.pdf']);
    if (pdf && m.pdfApproved) { copyFileSync(pdf, join(STAGING, 'pdfs', `${slug}.pdf`)); m.biodataPdf = `biodata/${slug}.pdf`; }
    else if (pdf) warnings.push('PDF found but biodataPdfApproved is not "yes" — PDF will NOT be published');
    if (!errors.length) writeFileSync(join(STAGING, `${slug}.md`), toMarkdown(m));
    report.push({ m, errors, warnings, slug });
    console.log(`${errors.length ? '✗' : '✓'} ${m.code}${errors.length ? ' — ' + errors.join('; ') : ''}${warnings.length ? '  (' + warnings.join('; ') + ')' : ''}`);
  }
  // Review page for staff (local only)
  const html = `<!doctype html><meta charset="utf-8"><title>Biodata import review</title>
<style>body{font:15px system-ui;margin:24px;color:#141c2e}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dde5f0;padding:8px;vertical-align:top;text-align:left}
img{width:120px;border-radius:8px}.e{color:#b42318;font-weight:600}.w{color:#a15c00}.ok{color:#0e7a40;font-weight:600}</style>
<h1>Biodata import review — ${today()}</h1>
<p>Check every photo (face fully visible, no documents in the background) and every field. Then publish the approved codes:<br>
<code>npm run maids:publish -- ${report.filter((x) => !x.errors.length && x.m.publication.consentRecorded).map((x) => x.m.code).join(' ') || 'CODE'}</code></p>
<table><tr><th>Photo</th><th>Code</th><th>Details</th><th>Checks</th></tr>
${report.map(({ m, errors, warnings, slug }) => `<tr><td>${m.photo ? `<img src="photos/${slug}.webp">` : '—'}</td>
<td><b>${esc(m.code)}</b><br>${esc(m.nationality)}<br>${esc(m.status)}${m.featured ? '<br>★ featured' : ''}</td>
<td>${m.age ? `Age ${m.age}${m.publication.showAge ? '' : ' (hidden)'} · ` : ''}${m.experienceYears} yrs${m.overseasExperience ? ' · overseas' : ''}<br>
Skills: ${SKILLS.filter((k) => m.skills[k] !== 'none').map((k) => `${k} (${m.skills[k]})`).join(', ')}<br>
Languages: ${m.languages.map((l) => `${esc(l.language)} ${l.level}`).join(', ')}<br>
History: ${m.employmentHistory.map((e) => `${esc(e.country)} ${esc(e.duration)}: ${esc(e.duties)}`).join(' / ')}<br>
<i>${esc(m.summary)}</i>${m.summary_ms ? `<br><i lang="ms">${esc(m.summary_ms)}</i>` : ''}</td>
<td>${errors.map((e) => `<div class="e">✗ ${esc(e)}</div>`).join('')}${warnings.map((w) => `<div class="w">! ${esc(w)}</div>`).join('')}${!errors.length && m.publication.consentRecorded ? '<div class="ok">Ready to publish</div>' : ''}</td></tr>`).join('')}
</table>`;
  writeFileSync(join(STAGING, 'REVIEW.html'), html);
  console.log(`\n${report.length} row(s) processed. Open private-biodata/staging/REVIEW.html to review. Nothing has been published.`);
}

// ---------- publish ----------
function publish(codes) {
  if (!codes.length) die('Give the codes to publish, e.g. npm run maids:publish -- FC-ID-0012 FC-PH-0003');
  ensure(CONTENT); ensure(PHOTOS); ensure(PDFS);
  for (const raw of codes) {
    const slug = raw.toLowerCase();
    const md = join(STAGING, `${slug}.md`);
    if (!existsSync(md)) { console.error(`✗ ${raw}: not in staging (run maids:import first)`); continue; }
    let text = readFileSync(md, 'utf8');
    if (!/consentRecorded: true/.test(text)) { console.error(`✗ ${raw}: no recorded consent — not published`); continue; }
    text = text.replace(/^published: false$/m, 'published: true');
    writeFileSync(join(CONTENT, `${slug}.md`), text);
    const ph = join(STAGING, 'photos', `${slug}.webp`); if (existsSync(ph)) copyFileSync(ph, join(PHOTOS, `${slug}.webp`));
    const pdf = join(STAGING, 'pdfs', `${slug}.pdf`); if (existsSync(pdf)) copyFileSync(pdf, join(PDFS, `${slug}.pdf`));
    console.log(`✓ ${raw.toUpperCase()} published to the website files`);
  }
  console.log('\nNext: npm run build && npm run test:site, then commit and push when approved.');
}

// ---------- status / feature ----------
function editRecord(code, fn) {
  const p = join(CONTENT, `${code.toLowerCase()}.md`);
  if (!existsSync(p)) die(`${code}: no such candidate on the website (src/content/maids/${code.toLowerCase()}.md)`);
  writeFileSync(p, fn(readFileSync(p, 'utf8')));
}
function setStatus(code, status) {
  if (!code || !STATUSES.includes(status)) die(`Usage: npm run maids:status -- CODE ${STATUSES.join('|')}`);
  editRecord(code, (t) => t.replace(/^status: .*$/m, `status: ${status}`).replace(/^statusUpdated: .*$/m, `statusUpdated: ${today()}`));
  const hidden = ['placed', 'unavailable', 'withdrawn'].includes(status);
  console.log(`✓ ${code.toUpperCase()} → ${status} (${today()})${hidden ? ' — now hidden from the website' : ''}`);
  if (status === 'placed' || status === 'withdrawn') console.log('  Run "npm run maids:archive" to move the record and photo off the website.');
}
function setFeatured(code, onoff) {
  if (!code || !['on', 'off'].includes(onoff)) die('Usage: npm run maids:feature -- CODE on|off');
  editRecord(code, (t) => t.replace(/^featured: .*$/m, `featured: ${onoff === 'on'}`));
  console.log(`✓ ${code.toUpperCase()} featured ${onoff}`);
}

// ---------- archive ----------
function archive() {
  if (!existsSync(CONTENT)) die('No candidates');
  const dest = join(ARCHIVE, today()); let n = 0;
  for (const f of readdirSync(CONTENT).filter((x) => x.endsWith('.md') && !x.startsWith('_'))) {
    const text = readFileSync(join(CONTENT, f), 'utf8');
    const st = text.match(/^status: (.*)$/m)?.[1];
    if (st !== 'placed' && st !== 'withdrawn') continue;
    ensure(dest); const slug = f.replace(/\.md$/, '');
    renameSync(join(CONTENT, f), join(dest, f));
    for (const [dir, ext] of [[PHOTOS, '.webp'], [PDFS, '.pdf']]) {
      const p = join(dir, slug + ext); if (existsSync(p)) { renameSync(p, join(dest, slug + ext)); }
    }
    console.log(`✓ archived ${slug.toUpperCase()} (${st})`); n++;
  }
  console.log(n ? `\n${n} record(s) moved to private-biodata/archive/${today()}/. Commit the deletion to remove them from the live site.` : 'Nothing to archive.');
}

// ---------- list ----------
function list() {
  const files = existsSync(CONTENT) ? readdirSync(CONTENT).filter((x) => x.endsWith('.md') && !x.startsWith('_')) : [];
  if (!files.length) return console.log('No candidates on the website yet.');
  console.log('CODE'.padEnd(18) + 'NATIONALITY'.padEnd(13) + 'STATUS'.padEnd(20) + 'UPDATED'.padEnd(12) + 'FEAT  PUBLIC');
  for (const f of files) {
    const t = readFileSync(join(CONTENT, f), 'utf8'); const g = (k) => t.match(new RegExp(`^${k}: (.*)$`, 'm'))?.[1]?.replace(/"/g, '') ?? '';
    const pub = g('published') === 'true' && /consentRecorded: true/.test(t) && !['placed', 'unavailable', 'withdrawn'].includes(g('status'));
    console.log(g('code').padEnd(18) + g('nationality').padEnd(13) + g('status').padEnd(20) + g('statusUpdated').padEnd(12) + (g('featured') === 'true' ? '★' : ' ').padEnd(6) + (pub ? 'yes' : 'no'));
  }
}

const run = { import: importCsv, publish: () => publish(args), status: () => setStatus(args[0], args[1]), feature: () => setFeatured(args[0], args[1]), archive, list }[cmd];
if (!run) die('Commands: import | publish CODE… | status CODE STATUS | feature CODE on|off | archive | list');
await run();
