// Biodata extraction core — pure functions, no DOM. Used by the staff portal (browser) and by scripts/import-extract-test.mjs (Node).
// It reads the TEXT LAYER of a PDF with positions (pdf.js text items) and pairs each printed label with the value printed next to it.
// Rules: only what is printed in the document is extracted; anything missing or unreliable is reported in `flags` — nothing is guessed silently.
import { splitName } from '../mapping.js';

const CJK = /[⺀-⿟　-〿㐀-鿿豈-﫿]/;
const COLON_ONLY = /^[\s:：_.\-–]*$/;
export const CODE_RE = /\b[A-Z]\d-\d{2}-[A-Z]{2,8}-[A-Z]{1,4}\s?\d{1,5}[A-Z]{0,3}\b/;
const YEAR_RE = /\b(19|20)\d{2}\b/;
const FOREIGN = ['singapore', 'hong kong', 'hongkong', 'taiwan', 'malaysia', 'saudi', 'bahrain', 'kuwait', 'united arab', 'uae', 'dubai', 'abu dhabi', 'qatar', 'oman', 'jordan', 'lebanon', 'brunei', 'macau', 'macao', 'china', 'israel', 'cyprus', 'korea', 'japan', 'turkey', 'egypt', 'iraq'];

/** Label definitions (English printed labels; the Chinese translation printed next to them is ignored). */
const LABELS = [
  ['ageChildren', /^age of children/i], ['siblings', /^age of bro/i], ['age', /^age\b/i], ['name', /^name\b|^nama\b/i], ['nationality', /^nationality|^kewarganegaraan|^warga/i],
  ['marital', /^marital|^status perkahwinan/i], ['religion', /^religion|^agama/i], ['height', /^height|^tinggi/i], ['weight', /^weight|^berat/i], ['education', /^education|^pendidikan/i],
  ['code', /^code\b/i], ['dayOff', /^day off/i], ['remarks', /^remarks/i], ['mainDuties', /^main duties/i], ['preferDuties', /^prefer duties/i], ['lookingToWork', /^looking to work/i],
  ['salary', /^(expected )?salary|^gaji/i], ['others', /^others\b/i], ['honesty', /^honesty/i], ['attitude', /^attitude/i], ['communication', /^communication/i],
  ['agencyId', /^agency recommendation \(indonesia\)/i], ['agencyMy', /^agency recommendation \(malaysia\)/i], ['afraid', /^afraid of dog/i], ['tattoo', /^tattoo/i], ['allergic', /^allergic/i],
];
const isLabelText = (s) => LABELS.some(([, re]) => re.test(s.trim())) || /^(passport|medical|skills|language|care |working experience|year\/s|country|duties|interview|e-experience|domestic helper|agensi|58,jalan)/i.test(s.trim());

const title = (s) => String(s || '').toLowerCase().replace(/(^|[\s'(\-/])([a-z])/g, (_, p, c) => p + c.toUpperCase()).trim();
const sentence = (s) => { const t = String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); return t.replace(/(^|[.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase()).replace(/\bi\b/g, 'I'); };
const clean = (s) => String(s || '').replace(/[​-‏]/g, '').replace(/\s+/g, ' ').trim();

/** Convert pdf.js text items to {s, x, y, w} with y measured from the top of the page. */
export function toItems(textItems, pageHeight) {
  return textItems.filter((t) => typeof t.str === 'string' && t.str.trim() !== '')
    .map((t) => ({ s: clean(t.str), x: t.transform[4], y: pageHeight - t.transform[5], w: t.width || 0 }));
}

/** Words to the right of / below a label, inside a band. */
function valueAfter(items, label, { xMax, yUp = 3.5, yDown = 8 } = {}) {
  const end = label.x + label.w;
  const out = [];
  // text printed in the same item after the colon ("Name 姓名: TUMI")
  const inline = label.s.replace(/^[^:：]*[:：]/, '');
  if (inline !== label.s && inline.trim() && !CJK.test(inline)) out.push({ s: inline.trim(), x: label.x + label.w, y: label.y });
  for (const it of items) {
    if (it === label) continue;
    if (it.y < label.y - yUp || it.y > label.y + yDown) continue;
    if (it.x < end - 1) continue;
    if (xMax && it.x >= xMax) continue;
    if (CJK.test(it.s) || COLON_ONLY.test(it.s) || isLabelText(it.s)) continue;
    out.push(it);
  }
  out.sort((a, b) => a.y - b.y > 3 ? a.y - b.y : a.x - b.x);
  // read rows top→bottom, items left→right
  const rows = []; for (const o of out) { const r = rows.find((q) => Math.abs(q.y - o.y) <= 3.5); if (r) r.items.push(o); else rows.push({ y: o.y, items: [o] }); }
  return rows.sort((a, b) => a.y - b.y).map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ')).join(' ').replace(/[_]{2,}/g, '').trim();
}

/**
 * @param {{s:string,x:number,y:number,w:number}[]} items  text items of page 1
 * @param {number} pageW
 */
export function extractFields(items, pageW) {
  const half = pageW * 0.55;
  const found = {};
  for (const it of items) {
    for (const [key, re] of LABELS) {
      if (re.test(it.s) && !(key in found)) { found[key] = it; break; }
      // "Age" must not capture "Age of Children"/"Age of Bro" — those are matched first by order above
    }
  }
  // every "remarks" label (top of page + interview section)
  const remarkLabels = items.filter((i) => LABELS.find(([k]) => k === 'remarks')[1].test(i.s));
  const val = (key, opts) => (found[key] ? clean(valueAfter(items, found[key], { xMax: found[key].x < pageW / 2 ? half : undefined, ...opts })) : '');
  const raw = {
    name: val('name'), nationality: val('nationality'), age: val('age'), marital: val('marital'), ageChildren: val('ageChildren'), religion: val('religion'), height: val('height'), weight: val('weight'),
    education: val('education'), salary: val('salary'), others: found.others ? clean(valueAfter(items, found.others, {})) : '', dayOff: val('dayOff'),
    attitude: val('attitude'), communication: val('communication'), honesty: val('honesty'),
  };
  // code: labelled value, else the code pattern anywhere in the page text
  let code = found.code ? clean(valueAfter(items, found.code, { yDown: 12 })) : '';
  const code0 = code;
  const pageText = items.map((i) => i.s).join(' ').replace(/\s*-\s*/g, '-');
  const squash = (t) => String(t).replace(/\s+/g, '');
  const m = (code && squash(code).match(CODE_RE)) || pageText.match(CODE_RE) || squash(pageText).match(CODE_RE);
  let unusual = false;
  code = m ? m[0].replace(/\s+/g, '') : '';
  const printed = squash(code0 || '').toUpperCase();
  if (printed && printed !== code && /^[A-Z0-9][A-Z0-9-]{2,29}$/.test(printed) && /\d/.test(printed) && !isLabelText(printed)) { code = printed; unusual = true; }
  // remarks values: top-left remark and the interview-section remarks (+ Malaysian agency recommendation)
  const remarks = [];
  for (const r of remarkLabels) { const v = clean(valueAfter(items, r, { yDown: 14, xMax: r.x < pageW / 2 ? undefined : undefined })); if (v) remarks.push(v); }
  if (found.agencyMy) { const v = clean(valueAfter(items, found.agencyMy, { yDown: 6 })); if (v) remarks.push(v); }
  return { raw, code, codeUnusual: unusual, remarks: [...new Set(remarks)] };
}

/** Work-experience table: rows start where a year is printed in the "Year/s Served" column. */
export function extractWork(items) {
  const start = items.find((i) => /^working experience/i.test(i.s));
  const end = items.find((i) => /^interview assessment/i.test(i.s));
  if (!start) return { jobs: [], note: 'no "Working Experience" section found' };
  const yTop = start.y; const yEnd = end ? end.y - 2 : Infinity;
  const countryH = items.find((i) => /^country/i.test(i.s) && i.y > yTop - 4 && i.y < yTop + 60);
  const dutiesH = items.find((i) => /^duties/i.test(i.s) && i.y > yTop - 4 && i.y < yTop + 60);
  const yearH = items.find((i) => /^year\/s/i.test(i.s) && i.y > yTop - 4 && i.y < yTop + 60);
  if (!countryH || !dutiesH) return { jobs: [], note: 'work-experience table headings not found' };
  const hdrBottom = Math.max(countryH.y, dutiesH.y, yearH ? yearH.y : 0) + 4;
  // The printed headings are centred over their columns, so the body text starts left of them: year column | country column | duties column.
  const cx = countryH.x - 20; const dx = countryH.x + 55;
  const body = items.filter((i) => i.y > hdrBottom && i.y < yEnd && !CJK.test(i.s) && !COLON_ONLY.test(i.s) && !/^(year\/s|served|country|duties|no\.?)$/i.test(i.s) && !/^\d+$/.test(i.s) === true || (i.y > hdrBottom && i.y < yEnd && YEAR_RE.test(i.s) && !CJK.test(i.s)));
  const rowsStart = [...new Set(body.filter((i) => i.x < cx && YEAR_RE.test(i.s)).map((i) => Math.round(i.y)))].sort((a, b) => a - b)
    .reduce((acc, y) => (acc.length && y - acc[acc.length - 1] < 5 ? acc : [...acc, y]), []);
  if (!rowsStart.length) {   // no year printed: start a row at each country entry instead
    const ys = [...new Set(body.filter((i) => i.x >= cx && i.x < dx).map((i) => Math.round(i.y)))].sort((x, y) => x - y).reduce((acc, y) => (acc.length && y - acc[acc.length - 1] < 14 ? acc : [...acc, y]), []);
    rowsStart.push(...ys);
  }
  if (!rowsStart.length) return { jobs: [], note: 'no work entries found in the table' };
  const jobs = rowsStart.map((y) => ({ y, year: [], country: [], duties: [] }));
  for (const it of body) {
    let row = null; for (const r of jobs) if (r.y <= it.y + 9) row = r;
    if (!row) continue;
    (it.x < cx ? row.year : it.x < dx ? row.country : row.duties).push(it);
  }
  const join = (arr) => { const rows = []; for (const o of [...arr].sort((a, b) => a.y - b.y || a.x - b.x)) { const r = rows.find((q) => Math.abs(q.y - o.y) <= 3.5); if (r) r.items.push(o); else rows.push({ y: o.y, items: [o] }); } return rows.sort((a, b) => a.y - b.y).map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ')).join(' '); };
  return { jobs: jobs.map((r) => ({ duration: clean(join(r.year)).replace(/\s*[-–]\s*/g, ' – '), country: title(clean(join(r.country))), duties: clean(join(r.duties)) })).filter((j) => j.duration || j.country || j.duties), note: '' };
}

/** Skill / language / day-off tick marks printed as ✓ ✕ glyphs (readable). Returns null when the document draws them as pictures. */
export function extractTicks(items) {
  const marks = items.filter((i) => /^[✓✔]$/.test(i.s)); const crosses = items.filter((i) => /^[✕✖✗✘]$/.test(i.s));
  if (!marks.length && !crosses.length) return null;
  const E = items.find((i) => i.s === 'E' && i.x > 400); const W = items.find((i) => i.s === 'W' && i.x > 400);
  const out = { skills: {}, bedridden: '', languages: [], dayOff: '' };
  const rows = [['newborn', /^care newborn/i], ['childcare', /^care children/i], ['elderlyCare', /^care elderly/i], ['bedridden', /^care bedridden/i]];
  if (E && W) {
    const mid = (E.x + W.x) / 2;
    for (const [k, re] of rows) {
      const lab = items.find((i) => re.test(i.s)); if (!lab) continue;
      const t = marks.find((m) => Math.abs(m.y - lab.y) <= 6 && m.x > lab.x + 100);
      const level = t ? (t.x < mid ? 'experienced' : 'willing-to-learn') : 'none';
      if (k === 'bedridden') out.bedridden = level; else out.skills[k] = level;
    }
  }
  const lang = [['BM', 'Bahasa Melayu'], ['BI', 'English'], ['CN', 'Chinese']];
  for (const [abbr, name] of lang) {
    const lab = items.find((i) => i.s === abbr && i.x > 300); if (!lab) continue;
    if (marks.some((m) => m.y > lab.y - 2 && m.y < lab.y + 14 && Math.abs(m.x - lab.x) <= 14)) out.languages.push(name);
  }
  const dayRow = items.find((i) => /^day off/i.test(i.s));
  if (dayRow) {
    const prefer = items.find((i) => i.s === 'Prefer' && Math.abs(i.y - dayRow.y) < 8); const not = items.find((i) => /^not prefer/i.test(i.s) && Math.abs(i.y - dayRow.y) < 8);
    const before = (lab) => lab && marks.some((m) => Math.abs(m.y - dayRow.y) <= 8 && lab.x - m.x > 0 && lab.x - m.x < 30);
    if (before(not)) out.dayOff = 'Not preferred'; else if (before(prefer)) out.dayOff = 'Prefers a weekly rest day';
  }
  return out;
}

/**
 * Tick boxes are read from the RENDERED page (ink inside each box), because agencies draw them as glyphs, vector shapes or pictures.
 * tickCells() finds where the boxes are from the printed labels; readTicks() decides which are ticked using `ink(x, y)` → 0..1
 * (share of dark pixels in a small square at that point, in page points).
 */
export function tickCells(items) {
  const E = items.find((i) => i.s === 'E' && i.x > 400); const W = items.find((i) => i.s === 'W' && i.x > 400);
  const cells = { skills: [], langs: [], day: [] };
  if (E && W) {
    for (const [key, re] of [['newborn', /^care newborn/i], ['childcare', /^care children/i], ['elderlyCare', /^care elderly/i], ['bedridden', /^care bedridden/i]]) {
      const lab = items.find((i) => re.test(i.s) && i.y > E.y && i.y < E.y + 90); if (!lab) continue;
      cells.skills.push({ key, e: [E.x + E.w / 2, lab.y - 3.5], w: [W.x + W.w / 2, lab.y - 3.5] });
    }
  }
  for (const [abbr, name] of [['BM', 'Bahasa Melayu'], ['BI', 'English'], ['CN', 'Chinese']]) {
    const lab = items.find((i) => i.s === abbr && i.x > 300); if (lab) cells.langs.push({ name, at: [lab.x + lab.w / 2, lab.y + 8] });
  }
  const dayRow = items.find((i) => /^day off/i.test(i.s));
  if (dayRow) {
    const prefer = items.find((i) => i.s === 'Prefer' && Math.abs(i.y - dayRow.y) < 8); const not = items.find((i) => /^not prefer/i.test(i.s) && Math.abs(i.y - dayRow.y) < 8);
    if (prefer) cells.day.push({ value: 'Prefers a weekly rest day', at: [prefer.x - 8, prefer.y - 3.5] });
    if (not) cells.day.push({ value: 'Not preferred', at: [not.x - 8, not.y - 3.5] });
  }
  return cells.skills.length || cells.langs.length || cells.day.length ? cells : null;
}
export function readTicks(cells, ink, threshold = 0.05) {
  if (!cells) return null;
  let unreadable = 0;
  const on = (at) => { const v = ink(at[0], at[1]); if (v < 0) { unreadable++; return false; } return v > threshold; };
  const out = { skills: {}, bedridden: '', languages: [], dayOff: '', unreadable: 0 };
  for (const c of cells.skills) {
    const level = on(c.e) ? 'experienced' : on(c.w) ? 'willing-to-learn' : 'none';
    if (c.key === 'bedridden') out.bedridden = level; else out.skills[c.key] = level;
  }
  for (const l of cells.langs) if (on(l.at)) out.languages.push(l.name);
  const days = cells.day.filter((d) => on(d.at)); if (days.length === 1) out.dayOff = days[0].value;
  out.unreadable = unreadable;
  return out;
}

const natOf = (t) => (/indones/i.test(t) ? 'indonesian' : /filipin|philipp|pinoy/i.test(t) ? 'filipino' : '');
const SKILL_WORDS = {
  childcare: /child|kid|baby|babies|anak|toddler|infant/i, newborn: /new\s?born|bayi|infant|postpartum|neonat/i, elderlyCare: /elder|old (man|woman|people)|grand\s?(mother|father|parent)|nenek|lansia|aged\b|sick|patient|bed\s?ridden|nurs/i,
  cooking: /cook|masak|chef|kitchen/i, housekeeping: /house|clean|laundry|iron|wash|sweep|mop|domestic|chores/i, petCare: /\bpets?\b|\bdog|\bcat\b|haiwan/i,
};

/** Turn the raw reading into a draft maid with per-field flags. `flags[field] = {level:'missing'|'check', note}` */
export function buildDraft({ raw, code, remarks, codeUnusual }, work, fileName = '', ticks = null) {
  const flags = {};
  const flag = (f, level, note) => { flags[f] = { level, note }; };
  const nat = natOf(raw.nationality) || natOf(raw.name);
  const nm = raw.name ? splitName(raw.name) : { fullName: '', firstName: '' };
  const ageM = raw.age.match(/(\d{2})\s*(?:y|yrs|years|tahun|th)?\b/i); const age = ageM ? Number(ageM[1]) : null;
  const jobs = work.jobs.map((j) => ({ country: j.country, duration: j.duration, duties: sentence(j.duties).slice(0, 200) }));
  const d = {
    code, nationality: nat, full_name: nm.fullName, first_name: nm.firstName, age, religion: title(raw.religion), marital_status: title(raw.marital),
    employment_history: jobs, languages: [], skills: Object.fromEntries(Object.keys(SKILL_WORDS).map((k) => [k, 'none'])), experience_years: null,
    overseas_experience: jobs.some((j) => FOREIGN.some((f) => j.country.toLowerCase().includes(f))), rest_day_preference: '', salary_note: raw.salary ? clean(raw.salary) : '',
    summary_en: '', summary_ms: '', internal_notes: '',
  };
  if (!code) flag('code', 'missing', 'No reference code was found in the document — enter it.');
  else if (codeUnusual) flag('code', 'check', 'The printed code does not follow the usual agency pattern — check it against the document.');
  if (!d.full_name) flag('full_name', 'missing', 'Name not found.');
  if (!nat) flag('nationality', 'missing', 'Nationality not found — choose it.');
  if (age == null) flag('age', 'missing', 'Age not found.'); else if (age < 21 || age > 60) flag('age', 'check', `Age ${age} is outside 21–60 — check the document.`);
  if (!d.marital_status) flag('marital_status', 'missing', 'Marital status not printed (or blank).');
  if (!d.religion) flag('religion', 'missing', 'Religion not printed (or blank).');
  if (!jobs.length) flag('employment_history', 'missing', work.note || 'No work experience found — check the document.');
  else if (jobs.some((j) => !j.duration || !j.country || !j.duties)) flag('employment_history', 'check', 'Some work entries have an empty year, country or duty — compare with the document.');
  flag('experience_years', 'missing', 'Total years are not printed — enter them if known.');
  // languages: tick boxes (BM = Bahasa Melayu, BI = English, CN = Chinese) when readable, plus the printed "Others" text. No proficiency is invented.
  const langs = ticks ? ticks.languages.map((language) => ({ language })) : [];
  for (const o of String(raw.others || '').split(/[,;/]/).map((x) => title(clean(x))).filter(Boolean)) if (!langs.some((l) => l.language.toLowerCase() === o.toLowerCase())) langs.push({ language: o });
  d.languages = langs;
  if (!ticks) flag('languages', 'missing', 'The language tick boxes in this document are pictures and cannot be read — add the languages shown.');
  else if (!langs.length) flag('languages', 'check', 'No language was ticked in the document — check it.');
  else flag('languages', 'check', 'Read from the ticked BM / BI(English) / CN boxes and the "Others" text — levels are not printed, so none are set.');
  if (ticks && ticks.dayOff) { d.rest_day_preference = ticks.dayOff; flag('rest_day_preference', 'check', 'Read from the ticked "Day Off" box — check.'); }
  else flag('rest_day_preference', 'missing', ticks ? 'No "Day Off" box is ticked — left blank.' : 'The "Day Off" tick boxes are pictures and cannot be read — choose it if the document shows it.');
  if (raw.salary) flag('salary_note', 'check', 'Read from the document — check.'); else flag('salary_note', 'missing', 'No salary printed — left blank.');
  // skills: E / W ticks when readable (E = experienced, W = willing to learn); other skills only as suggestions from words printed in the work history / remarks
  const duties = jobs.map((j) => j.duties).join(' '); const rem = remarks.join(' ');
  const fromTicks = []; const sug = [];
  if (ticks) for (const [k, v] of Object.entries(ticks.skills)) { d.skills[k] = v; if (v !== 'none') fromTicks.push(`${k}: ${v}`); }
  for (const [k, re] of Object.entries(SKILL_WORDS)) {
    if (ticks && k in ticks.skills) continue;               // the ticks decide those four
    if (re.test(duties)) { d.skills[k] = 'experienced'; sug.push(k); } else if (re.test(rem)) { d.skills[k] = 'some-experience'; sug.push(k); }
  }
  if (ticks && ticks.bedridden && ticks.bedridden !== 'none') fromTicks.push(`bedridden care: ${ticks.bedridden}`);
  flag('skills', 'check', `${ticks ? `Read from the E / W ticks (${fromTicks.join(', ') || 'none ticked'})${ticks.unreadable ? ` — ${ticks.unreadable} box(es) could not be located, check them` : ''}. ` : 'The E / W tick boxes could not be located. '}${sug.length ? `Cooking / housekeeping / pet care are only suggestions from the printed text (${sug.join(', ')}) — confirm them.` : 'No other skill words found.'}`);
  // notes: facts printed in the document that have no dedicated field (private, never published)
  const notes = [];
  if (raw.ageChildren) notes.push(`Age of children: ${raw.ageChildren}`);
  if (raw.education) notes.push(`Education: ${raw.education}`);
  if (raw.height) notes.push(`Height: ${raw.height}`);
  if (raw.weight) notes.push(`Weight: ${raw.weight}`);
  if (raw.attitude) notes.push(`Interview attitude: ${raw.attitude}`);
  if (ticks && ticks.bedridden && ticks.bedridden !== 'none') notes.push(`Care of bedridden patients: ${ticks.bedridden === 'experienced' ? 'experienced' : 'willing to learn'} (ticked on the biodata)`);
  for (const r of remarks) notes.push(`Remarks on biodata: ${r}`);
  d.internal_notes = notes.join('\n');
  return { draft: d, flags, fileName };
}

/** Pick the maid portrait among the images placed on page 1. `images` = [{x,y,w,h}] in page points (y from top). Never the logo, tick marks, a full page or a landscape scan. */
export function pickPortrait(images, pageW, pageH) {
  const cand = images.filter((i) => i.w >= 70 && i.h >= 70 && i.w * i.h < pageW * pageH * 0.5 && i.h / i.w >= 0.8 && i.h / i.w <= 2.0);
  cand.sort((a, b) => b.w * b.h - a.w * a.h);
  if (!cand.length) return { box: null, note: 'No portrait-shaped picture was found on page 1.' };
  const top = cand[0]; const rival = cand[1];
  const close = rival && rival.w * rival.h > top.w * top.h * 0.6;
  return { box: top, note: close ? 'More than one possible portrait — check the photo.' : '', uncertain: !!close };
}

/** Parse "Label: value" lines (Word documents and plain text, no positions). */
export function extractFromLines(text) {
  const lines = String(text).split(/\r?\n/).map(clean).filter(Boolean);
  const items = lines.map((s, i) => ({ s, x: 0, y: i * 14, w: s.length * 5 }));
  const raw = {}; const get = (re) => { for (const l of lines) { const m = l.match(re); if (m && clean(m[1])) return clean(m[1]); } return ''; };
  Object.assign(raw, { name: get(/^name\b[^:：]*[:：]\s*(.+)$/i), nationality: get(/^nationality[^:：]*[:：]\s*(.+)$/i), age: get(/^age\b(?! of)[^:：]*[:：]\s*(.+)$/i), marital: get(/^marital[^:：]*[:：]\s*(.+)$/i),
    ageChildren: get(/^age of children[^:：]*[:：]\s*(.+)$/i), religion: get(/^religion[^:：]*[:：]\s*(.+)$/i), height: get(/^height[^:：]*[:：]\s*(.+)$/i), weight: get(/^weight[^:：]*[:：]\s*(.+)$/i),
    education: get(/^education[^:：]*[:：]\s*(.+)$/i), salary: get(/^(?:expected )?salary[^:：]*[:：]\s*(.+)$/i), others: '', dayOff: get(/^day off[^:：]*[:：]\s*(.+)$/i), attitude: '', communication: '', honesty: '' });
  const code = (text.match(CODE_RE) || [''])[0].replace(/\s+/g, '');
  const remarks = lines.filter((l) => /^remarks/i.test(l)).map((l) => clean(l.replace(/^remarks[^:：]*[:：]?/i, ''))).filter(Boolean);
  void items;
  return { raw, code, remarks };
}
