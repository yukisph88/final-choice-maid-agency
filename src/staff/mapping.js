// Final Choice — shared conversion between the staff CSV format (private-biodata/import/maids.csv)
// and the database row (public.maids). Plain JavaScript so BOTH the browser dashboard and the
// Node migration script (scripts/db-migrate.mjs) use exactly the same rules.

export const NATIONALITIES = ['indonesian', 'filipino'];
export const LEVELS = ['experienced', 'some-experience', 'willing-to-learn', 'none'];
export const LANG_LEVELS = ['basic', 'conversational', 'fluent', 'native'];
export const STATUSES = ['available', 'interview-pending', 'reserved', 'processing', 'placed', 'unavailable', 'withdrawn'];
export const HIDDEN = ['placed', 'unavailable', 'withdrawn'];
export const SKILLS = ['childcare', 'newborn', 'elderlyCare', 'cooking', 'housekeeping', 'petCare'];
export const STATUS_LABEL = { available: 'Available', 'interview-pending': 'Interview Pending', reserved: 'Reserved', processing: 'Processing', placed: 'Placed', unavailable: 'Unavailable', withdrawn: 'Withdrawn' };
export const SKILL_LABEL = { childcare: 'Childcare', newborn: 'Newborn care', elderlyCare: 'Elderly care', cooking: 'Cooking', housekeeping: 'Housekeeping', petCare: 'Pet care' };
export const LEVEL_LABEL = { experienced: 'Experienced', 'some-experience': 'Some experience', 'willing-to-learn': 'Willing to learn', none: 'Not stated' };

// Never allowed in any text that could become public
const PASSPORT = /\b[A-Z]{1,2}\d{7,8}\b/;
const MYKAD = /\b\d{6}-\d{2}-\d{4}\b/;
const PHONE = /(\+?6?01\d[- ]?\d{3,4}[- ]?\d{4})/;

const yes = (v) => /^(y|yes|true|1|ya)$/i.test(String(v ?? '').trim());
const str = (v) => String(v ?? '').trim();

/** CSV → array of objects. Handles quotes, commas and line breaks inside quotes (Excel "CSV UTF-8"). */
export function parseCsv(text) {
  text = String(text).replace(/^﻿/, '');
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
  const [head = [], ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/** "ANA BINTI ALI" → "Ana Binti Ali"; "DELA CRUZ, MARIA SANTOS" → full "Maria Santos Dela Cruz", first "Maria". */
export function splitName(raw) {
  const n = str(raw).replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, p, c) => p + c.toUpperCase());
  const i = n.indexOf(',');
  if (i === -1) return { fullName: n, firstName: n.split(' ')[0] || '' };
  const surname = n.slice(0, i).trim(); const given = n.slice(i + 1).trim();
  if (!given) return { fullName: surname, firstName: surname };
  return { fullName: `${given} ${surname}`, firstName: given.split(' ')[0] };
}

const toIsoDate = (t) => {
  t = str(t); if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : 'INVALID';
};

export const parseLanguages = (s) => str(s).split(';').map((x) => x.trim()).filter(Boolean).map((x) => {
  const [language, level] = x.split(':').map((y) => y.trim());
  return level ? { language, level: level.toLowerCase() } : { language };
});
export const formatLanguages = (arr) => (arr || []).map((l) => (l.level ? `${l.language}: ${l.level}` : l.language)).join('; ');
export const parseHistory = (s) => str(s).split(/\r?\n/).map((x) => x.trim()).filter(Boolean).map((x) => {
  const [country = '', duration = '', duties = '', duties_ms = ''] = x.split('|').map((y) => y.trim());
  return { country, duration, duties, ...(duties_ms ? { duties_ms } : {}) };
});
export const formatHistory = (arr) => (arr || []).map((e) => [e.country, e.duration, e.duties, e.duties_ms || ''].join(' | ').replace(/ \| $/, '')).join('\n');

/** Checks shared by the dashboard form and the CSV import. Returns { errors, warnings }. */
export function validateRow(row) {
  const errors = []; const warnings = [];
  if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(row.code || '')) errors.push('Reference code must be 3–30 capital letters, numbers or hyphens');
  if (!NATIONALITIES.includes(row.nationality)) errors.push('Nationality must be Indonesian or Filipino');
  if (!STATUSES.includes(row.status)) errors.push('Unknown status');
  if (row.age != null && (!Number.isInteger(row.age) || row.age < 21 || row.age > 60)) errors.push('Age must be 21–60');
  if (row.experience_years != null && (!Number.isFinite(row.experience_years) || row.experience_years < 0 || row.experience_years > 40)) errors.push('Experience must be 0–40 years');
  for (const k of SKILLS) if (!LEVELS.includes(row.skills?.[k])) errors.push(`${SKILL_LABEL[k]}: choose a level`);
  for (const l of row.languages || []) if (l.level && !LANG_LEVELS.includes(l.level)) errors.push(`Language level "${l.level}" must be ${LANG_LEVELS.join(' / ')}`);
  for (const e of row.employment_history || []) {
    if (!e.country || !e.duration) errors.push('Each job needs at least "Country | Duration"');
    if ((e.duties || '').length > 200) errors.push('Job duties must be 200 characters or fewer');
  }
  if (!['full', 'first', 'none'].includes(row.name_consent)) errors.push('Name display must be full, first or none');
  if (row.consent_date === 'INVALID') errors.push('Consent date must be DD/MM/YYYY');
  if (row.published && !(row.consent_recorded && row.consent_date && str(row.approved_by))) errors.push('Cannot publish: record consent, consent date and approver first');
  const publicText = [row.full_name, row.first_name, row.display_name_override, row.summary_en, row.summary_ms, row.interview_availability_en, row.interview_availability_ms, row.religion, row.marital_status,
    ...(row.languages || []).map((l) => l.language), ...(row.employment_history || []).flatMap((e) => [e.country, e.duration, e.duties, e.duties_ms])].join(' ');
  if (PASSPORT.test(publicText)) errors.push('Text looks like a passport number — remove it');
  if (MYKAD.test(publicText)) errors.push('Text looks like an IC number — remove it');
  if (PHONE.test(publicText)) errors.push('Text looks like a phone number — remove it');
  if (!row.full_name) warnings.push('Name missing');
  if (!row.photo_path) warnings.push('No photo');
  return { errors, warnings };
}

/**
 * One CSV row (same columns as private-biodata/import/maids.csv) → database row.
 * Importing NEVER publishes: published is always false; staff publish in the dashboard after checking consent.
 */
export function csvRowToDb(r) {
  const { fullName, firstName } = splitName(r.internalName);
  const skills = Object.fromEntries(SKILLS.map((k) => [k, (str(r[k]) || 'none').toLowerCase()]));
  const exp = str(r.experienceYears) === '' ? null : Number(r.experienceYears);
  const row = {
    code: str(r.code).toUpperCase(),
    full_name: fullName,
    first_name: firstName,
    display_name_override: str(r.displayName),
    name_consent: (str(r.nameConsent) || 'none').toLowerCase(),
    nationality: str(r.nationality).toLowerCase(),
    age: str(r.age) ? Number(r.age) : null,
    show_age: yes(r.showAge),
    religion: str(r.religion),
    show_religion: yes(r.showReligion),
    marital_status: str(r.maritalStatus),
    experience_years: exp,
    overseas_experience: yes(r.overseasExperience),
    skills,
    languages: parseLanguages(r.languages),
    employment_history: parseHistory(r.employmentHistory),
    summary_en: str(r.summary),
    summary_ms: str(r.summary_ms),
    interview_availability_en: str(r.interviewAvailability),
    interview_availability_ms: str(r.interviewAvailability_ms),
    status: (str(r.status) || 'available').toLowerCase(),
    status_set_by: str(r.statusSetBy),
    status_confirmed: yes(r.statusConfirmed),
    consent_recorded: yes(r.consentRecorded),
    consent_date: toIsoDate(r.consentDate),
    photo_consent: yes(r.photoConsent),
    approved_by: str(r.approvedBy),
    featured: yes(r.featured),
    published: false,
    source_file: str(r.sourceFile),
    internal_notes: str(r.internalNotes),
  };
  if (str(r.statusUpdated)) row.status_updated_at = str(r.statusUpdated);
  return row;
}

/** Fields compared to decide whether an import row is new, changed or unchanged. */
export const COMPARE_FIELDS = ['full_name', 'first_name', 'display_name_override', 'name_consent', 'nationality', 'age', 'show_age', 'religion', 'show_religion', 'marital_status',
  'experience_years', 'overseas_experience', 'skills', 'languages', 'employment_history', 'summary_en', 'summary_ms', 'interview_availability_en', 'interview_availability_ms',
  'status', 'status_set_by', 'status_confirmed', 'consent_recorded', 'consent_date', 'photo_consent', 'approved_by', 'featured', 'source_file', 'internal_notes'];
// JSON fields come back from the database with keys in a different order, so compare with sorted keys
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const norm = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(canon(v)) : typeof v === 'number' ? v : String(v));
export function changedFields(existing, row) {
  return COMPARE_FIELDS.filter((k) => k in row && norm(k === 'experience_years' && existing[k] != null ? Number(existing[k]) : existing[k]) !== norm(row[k]));
}

// CSV column → database fields. An UPDATE of an existing maid may only touch the columns that are really in the file,
// so importing a short list (for example only codes and statuses) can never reset consent, names or other settings.
const COLUMN_FIELDS = {
  internalName: ['full_name', 'first_name'], displayName: ['display_name_override'], nameConsent: ['name_consent'], nationality: ['nationality'],
  age: ['age'], showAge: ['show_age'], religion: ['religion'], showReligion: ['show_religion'], maritalStatus: ['marital_status'],
  experienceYears: ['experience_years'], overseasExperience: ['overseas_experience'], languages: ['languages'], employmentHistory: ['employment_history'],
  summary: ['summary_en'], summary_ms: ['summary_ms'], interviewAvailability: ['interview_availability_en'], interviewAvailability_ms: ['interview_availability_ms'],
  status: ['status'], statusSetBy: ['status_set_by'], statusConfirmed: ['status_confirmed'], statusUpdated: ['status_updated_at'],
  consentRecorded: ['consent_recorded'], consentDate: ['consent_date'], photoConsent: ['photo_consent'], approvedBy: ['approved_by'],
  featured: ['featured'], sourceFile: ['source_file'], internalNotes: ['internal_notes'],
};
/** Keep only what the file actually contains. `existing` supplies the other skill levels (skills are stored as one object). */
export function restrictToColumns(row, columns, existing = {}) {
  const out = { code: row.code };
  for (const c of columns) for (const f of COLUMN_FIELDS[c] || []) if (f in row) out[f] = row[f];
  const skillCols = SKILLS.filter((k) => columns.includes(k));
  if (skillCols.length) out.skills = { ...(existing.skills || {}), ...Object.fromEntries(skillCols.map((k) => [k, row.skills[k]])) };
  return out;
}
