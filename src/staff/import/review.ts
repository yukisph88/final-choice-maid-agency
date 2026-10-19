// Review screen (original document on the left, extracted editable fields + photo on the right) and the safe save.
import { S, esc, dialog, toast, ask, myName, go, pickFile, cropper, toWebp, ensureThumbs, loadMaids, replaceMaid, type Row } from '../portal/core';
import { saveImportWith, findExisting as findExistingCore } from './save-core.js';
import { SKILLS, SKILL_LABEL, LEVELS, LEVEL_LABEL } from '../mapping.js';
import type { Parsed, Flags } from './read';

export interface SaveResult { ok: boolean; code: string; error?: string; merged?: boolean; duplicate?: boolean }
const ctx = () => ({ sb: S.sb, who: myName(), email: S.me.email || '' });

/** Duplicate check against the live database (not just the cached list). */
export const findExisting = (code: string): Promise<Row | null> => findExistingCore(ctx(), code);

/** Save an extracted + reviewed record (see save-core.js: photo first, record created with its photo, rollback on failure). */
export async function saveImport(fields: Row, photo: Blob | null, o: { fileName: string; reviewed: boolean; merge?: boolean; keepOriginal?: File | null }): Promise<SaveResult> {
  let webp: Blob | null = null;
  try { webp = photo ? await toWebp(photo) : null; } catch (e) { return { ok: false, code: String(fields.code || ''), error: `The photo could not be prepared: ${(e as Error).message}` }; }
  const res = await saveImportWith(ctx(), fields, webp, { fileName: o.fileName, reviewed: o.reviewed, merge: o.merge, keepOriginal: o.keepOriginal ? { name: o.keepOriginal.name, type: o.keepOriginal.type, size: o.keepOriginal.size, body: o.keepOriginal } : null });
  if (res.ok && res.maid) { replaceMaid(res.maid); S.thumbsAt = 0; await ensureThumbs(true); }
  return { ok: res.ok, code: res.code, error: res.error, merged: res.merged, duplicate: res.duplicate };
}

const SKILL_GROUP = SKILLS;
/** Open the side-by-side review. `done(result)` runs after a successful save (default: go to the maid's profile). */
export function openReview(p: Parsed, o: { done?: (r: SaveResult, fields: Row) => void; title?: string } = {}) {
  const f: Row = structuredClone(p.fields); const flags: Flags = { ...p.flags }; let jobs: Row[] = structuredClone(f.employment_history || []);
  let photo: Blob | null = p.photo; let photoUrl = p.photoUrl; let photoUncertain = p.photoUncertain; let keepOriginal = false;
  const langText = (f.languages || []).map((l: Row) => l.language).join(', ');
  const fl = (n: string) => (flags[n] ? `<p class="unc-note">${flags[n].level === 'missing' ? 'Not found' : 'Check'} — ${esc(flags[n].note)}</p>` : '');
  const cls = (n: string) => (flags[n] ? ` unc unc--${flags[n].level}` : '');
  const input = (n: string, label: string, v: unknown, extra = '') => `<div class="fld${cls(n)}" data-f="${n}"><label>${label}</label><input name="${n}" value="${esc(v ?? '')}" ${extra}>${fl(n)}</div>`;
  const jobsHtml = () => jobs.map((j, i) => `<div class="job"><div class="job-g"><input data-j="${i}" data-k="country" value="${esc(j.country)}" placeholder="Country"><input data-j="${i}" data-k="duration" value="${esc(j.duration)}" placeholder="Years"></div>
      <input data-j="${i}" data-k="duties" value="${esc(j.duties)}" maxlength="200" placeholder="Main duties"><button class="btn btn--ghost btn--sm" type="button" data-rj="${i}">Remove</button></div>`).join('') || '<p class="hint">No work entries.</p>';
  const doc = p.previewUrl ? `<img src="${esc(p.previewUrl)}" alt="Original biodata, page 1">` : p.previewHtml ? `<div class="docx">${p.previewHtml}</div>` : '<p class="hint">No preview available.</p>';
  const d = dialog({ title: o.title || `Review — ${p.file.name}`, wide: true, xl: true, body: `<div class="rv"><div class="rv-doc"><div class="hint">Original document: ${esc(p.file.name)}</div>${doc}</div>
    <form class="rv-form" autocomplete="off">
      ${p.notes.map((n) => `<div class="note">${esc(n)}</div>`).join('')}
      <div class="legend"><span class="unc-dot unc--missing"></span> not found <span class="unc-dot unc--check"></span> check against the document</div>
      <div class="rv-photo${photoUncertain ? ' unc unc--check' : ''}" data-photo></div>
      <div class="g2">${input('code', 'Reference code *', f.code, 'style="text-transform:uppercase"')}
        <div class="fld${cls('nationality')}" data-f="nationality"><label>Nationality *</label><select name="nationality"><option value="">— choose —</option><option value="indonesian"${f.nationality === 'indonesian' ? ' selected' : ''}>Indonesian</option><option value="filipino"${f.nationality === 'filipino' ? ' selected' : ''}>Filipino</option></select>${fl('nationality')}</div>
        ${input('full_name', 'Full name *', f.full_name)}${input('age', 'Age', f.age, 'type="number" min="21" max="60"')}${input('marital_status', 'Marital status', f.marital_status)}${input('religion', 'Religion', f.religion)}
        ${input('experience_years', 'Years of experience', f.experience_years, 'type="number" min="0" max="40" step="0.5"')}${input('rest_day_preference', 'Rest-day preference', f.rest_day_preference)}${input('salary_note', 'Salary note', f.salary_note)}
        <div class="fld${cls('languages')}" data-f="languages"><label>Languages (comma-separated)</label><input name="languages" value="${esc(langText)}">${fl('languages')}</div></div>
      <label class="check"><input type="checkbox" name="overseas_experience" ${f.overseas_experience ? 'checked' : ''}> Has overseas experience</label>
      <div class="${cls('skills').trim()}" data-f="skills"><h4 class="sec">Skills</h4>${fl('skills')}<div class="g3">${SKILL_GROUP.map((k) => `<div class="fld"><label>${SKILL_LABEL[k as keyof typeof SKILL_LABEL]}</label><select name="sk-${k}">${LEVELS.map((l) => `<option value="${l}"${(f.skills?.[k] || 'none') === l ? ' selected' : ''}>${LEVEL_LABEL[l as keyof typeof LEVEL_LABEL]}</option>`).join('')}</select></div>`).join('')}</div></div>
      <div class="${cls('employment_history').trim()}" data-f="employment_history"><h4 class="sec">Work experience</h4>${fl('employment_history')}<div data-jobs>${jobsHtml()}</div><button class="btn btn--ghost btn--sm" type="button" data-aj>+ Add a job</button></div>
      <div class="fld"><label>Internal notes (staff only — facts printed on the biodata with no field of their own)</label><textarea name="internal_notes" rows="5">${esc(f.internal_notes)}</textarea></div>
      <div data-dup></div>
      <label class="check"><input type="checkbox" name="keep"> Also keep the original document privately (Documents tab; administrators and editors only)</label>
      <label class="check confirm"><input type="checkbox" name="compared"> I have compared these details and the photo with the original document.</label>
      <div data-msg></div></form></div>`,
    foot: '<button class="btn btn--ghost" data-no type="button">Cancel</button><button class="btn" data-save type="button">Confirm &amp; Save</button>' });
  const form = d.q<HTMLFormElement>('.rv-form'); const el = (n: string) => form.elements.namedItem(n) as HTMLInputElement;
  const drawPhoto = () => { d.q('[data-photo]').innerHTML = `<div class="photo-frame">${photoUrl ? `<img src="${esc(photoUrl)}" alt="Extracted portrait">` : '<div class="photo-empty">No photo</div>'}</div><div><p class="strong">Photo</p>${photoUncertain ? `<p class="unc-note">${photo ? 'Check' : 'Not found'} — ${photo ? 'confirm this is the maid\'s portrait.' : 'no portrait was found; upload one.'}</p>` : ''}
      <div class="row-actions"><button class="btn btn--ghost btn--sm" type="button" data-adj ${photo ? '' : 'disabled'}>Adjust crop…</button><button class="btn btn--ghost btn--sm" type="button" data-rep>Replace photo…</button></div><p class="hint">Saved as a small private picture. Never on the website unless the maid is published with photo consent.</p></div>`; };
  drawPhoto();
  const clearFlag = (n: string) => { if (!flags[n]) return; delete flags[n]; const w = form.querySelector(`[data-f="${n}"]`); if (w) { w.classList.remove('unc', 'unc--missing', 'unc--check'); w.querySelector('.unc-note')?.remove(); } };
  form.addEventListener('input', (e) => { const t = e.target as HTMLInputElement; if (t.dataset.j) { jobs[Number(t.dataset.j)][t.dataset.k!] = t.value; clearFlag('employment_history'); } else if (t.name) clearFlag(t.name.startsWith('sk-') ? 'skills' : t.name); });
  form.addEventListener('change', (e) => { const t = e.target as HTMLInputElement; if (t.name?.startsWith('sk-')) clearFlag('skills'); });
  d.el.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-aj]')) { jobs.push({ country: '', duration: '', duties: '' }); d.q('[data-jobs]').innerHTML = jobsHtml(); }
    const rj = t.closest<HTMLElement>('[data-rj]'); if (rj) { jobs.splice(Number(rj.dataset.rj), 1); d.q('[data-jobs]').innerHTML = jobsHtml(); clearFlag('employment_history'); }
    if (t.closest('[data-adj]') && photo) { const out = await cropper(photo); if (out) { photo = out; photoUrl = URL.createObjectURL(out); photoUncertain = false; drawPhoto(); } }
    if (t.closest('[data-rep]')) { const file = await pickFile('image/jpeg,image/png,image/webp'); if (!file) return; const out = await cropper(file); if (out) { photo = out; photoUrl = URL.createObjectURL(out); photoUncertain = false; drawPhoto(); } }
  });
  el('code').addEventListener('change', async () => {   // early duplicate warning
    const c = el('code').value.trim().toUpperCase(); const ex = await findExisting(c); const box = d.q('[data-dup]');
    box.innerHTML = ex ? `<div class="err">Reference code <b>${esc(c)}</b> already exists (${esc(ex.full_name || 'no name')}). Saving will <b>not</b> create a duplicate — you can choose to fill only its empty fields.</div>` : '';
  });
  d.q('[data-no]').addEventListener('click', () => d.close());
  d.q('[data-save]').addEventListener('click', async () => {
    const msg = d.q('[data-msg]'); msg.innerHTML = '';
    const langs = el('languages').value.split(/[,;]/).map((x) => x.trim()).filter(Boolean).map((language) => ({ language }));
    const row: Row = { code: el('code').value.trim().toUpperCase(), nationality: el('nationality').value, full_name: el('full_name').value.trim(), age: el('age').value === '' ? null : Number(el('age').value), marital_status: el('marital_status').value.trim(), religion: el('religion').value.trim(),
      experience_years: el('experience_years').value === '' ? null : Number(el('experience_years').value), rest_day_preference: el('rest_day_preference').value.trim(), salary_note: el('salary_note').value.trim(), languages: langs, overseas_experience: el('overseas_experience').checked,
      skills: Object.fromEntries(SKILLS.map((k) => [k, el(`sk-${k}`).value])), employment_history: jobs.filter((j) => (j.country || '').trim() || (j.duration || '').trim() || (j.duties || '').trim()).map((j) => ({ country: (j.country || '').trim(), duration: (j.duration || '').trim(), duties: (j.duties || '').trim() })), internal_notes: (form.elements.namedItem('internal_notes') as HTMLTextAreaElement).value };
    if (!row.code) return (msg.innerHTML = '<div class="err">Enter the reference code.</div>');
    if (!row.nationality) return (msg.innerHTML = '<div class="err">Choose the nationality.</div>');
    if (!row.full_name) return (msg.innerHTML = '<div class="err">Enter the full name.</div>');
    if (!el('compared').checked) return (msg.innerHTML = '<div class="err">Tick the box to confirm you compared the details and photo with the original document.</div>');
    if (!photo && !(await ask('No photo has been chosen. Save this maid without a photo? You can add one later.', { ok: 'Save without photo' }))) return;
    const btn = d.q<HTMLButtonElement>('[data-save]'); btn.disabled = true; btn.textContent = 'Saving…';
    const ex = await findExisting(row.code); let merge = false;
    if (ex) { merge = await ask(`Reference code ${row.code} already exists (${ex.full_name || 'no name'}).\n\nFill ONLY the empty fields of the existing record with these details? Nothing already recorded will be overwritten and no duplicate is created.`, { ok: 'Fill empty fields', title: 'Duplicate reference code' }); if (!merge) { btn.disabled = false; btn.textContent = 'Confirm & Save'; return; } }
    keepOriginal = el('keep').checked;
    const res = await saveImport(row, photo, { fileName: p.file.name, reviewed: true, merge, keepOriginal: keepOriginal ? p.file : null });
    btn.disabled = false; btn.textContent = 'Confirm & Save';
    if (!res.ok) { msg.innerHTML = `<div class="err">Not saved: ${esc(res.error)}<br>Nothing was left half-saved — fix the problem and press Confirm &amp; Save again.</div>`; return; }
    toast(`${res.merged ? 'Updated' : 'Saved'} ${row.full_name} (${res.code}) — private, unpublished, availability To Be Confirmed.`);
    d.close(); if (o.done) o.done(res, row); else go(`#/maid/${res.code}`);
  });
  void loadMaids;
  return d;
}
