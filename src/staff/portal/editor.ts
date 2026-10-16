// Full internal maid profile: personal biodata, experience, languages, pay/rest-day, availability, photos,
// placements, notes, documents, publication & approvals, change history.
import {
  S, $, $$, esc, view, mount, setTitle, toast, ask, askTyped, canEdit, isAdmin, loadMaids, ensureThumbs, maidByCode, replaceMaid, fmtDT, fmtDate, go, myName, thumbUrl, thumbHtml,
  statusPill, pill, logHistory, historyTable, cropper, pickFile, savePrivatePhoto, PRIVATE, PUBLIC, photoPath, slugOf, onClick, type Row,
} from './core';
import { validateRow, splitName, SKILLS, SKILL_LABEL, LEVELS, LEVEL_LABEL, LANG_LEVELS, STATUSES, STATUS_LABEL, HIDDEN } from '../mapping.js';
import { previewDialog, readiness, syncPublicPhoto, unpublish } from './publication';
import { maidPlacementsHtml, openPlacementDialog, editPlacementById } from './placements';
import { maidDocumentsHtml, openUploadDialog, openDocument, deleteDocument } from './documents';

export const UI = { dirty: false };
const TABS: [string, string][] = [['personal', 'Personal biodata'], ['experience', 'Experience & skills'], ['languages', 'Languages'], ['pay', 'Salary & rest day'], ['availability', 'Availability'],
  ['photos', 'Photos'], ['placement', 'Placement & employer'], ['notes', 'Internal notes'], ['documents', 'Documents'], ['publication', 'Public profile & approval'], ['history', 'Change history']];
const RESTRICTED = ['published', 'consent_recorded', 'consent_date', 'photo_consent', 'name_consent', 'show_age', 'show_religion', 'approved_by', 'public_photo_path', 'discrepancies_resolved', 'featured', 'display_name_override'];

const blank = (): Row => ({ code: '', nationality: 'indonesian', full_name: '', first_name: '', age: null, religion: '', marital_status: '', experience_years: null, overseas_experience: false,
  skills: Object.fromEntries(SKILLS.map((k) => [k, 'none'])), languages: [], employment_history: [], rest_day_preference: '', salary_note: '', status: 'to-be-confirmed', status_confirmed: false, status_set_by: '',
  interview_availability_en: '', interview_availability_ms: '', internal_notes: '', discrepancy_notes: '', summary_en: '', summary_ms: '', name_consent: 'none', display_name_override: '', show_age: false, show_religion: false,
  consent_recorded: false, consent_date: null, photo_consent: false, approved_by: '', discrepancies_resolved: false, featured: false, published: false, photo_path: '', public_photo_path: '' });

export async function renderEditor(code?: string) {
  await loadMaids(); await ensureThumbs();
  const existing = code ? maidByCode(code) : undefined;
  if (code && !existing) { setTitle('Maid not found'); mount(`<div class="card pad"><p>No maid with reference <b>${esc(code)}</b>.</p><a class="btn" href="#/maids">Back to all maids</a></div>`); return; }
  let m: Row = existing ? structuredClone(existing) : blank();
  const isNew = !existing; const editable = canEdit(); const admin = isAdmin();
  const dis = editable ? '' : 'disabled'; const disAdmin = admin ? '' : 'disabled';
  let langs: Row[] = structuredClone(m.languages || []); let jobs: Row[] = structuredClone(m.employment_history || []);
  let pendingPhoto: Blob | null = null; let pendingUrl = '';
  UI.dirty = false;
  setTitle(isNew ? 'Add New Maid' : m.full_name || m.code, isNew ? 'Complete biodata registration' : `Ref: ${m.code}`);

  const opt = (list: string[], cur: string, label: (x: string) => string) => list.map((x) => `<option value="${esc(x)}"${x === cur ? ' selected' : ''}>${esc(label(x))}</option>`).join('');
  const f = (name: string, label: string, val: unknown, o: { type?: string; hint?: string; extra?: string; admin?: boolean } = {}) =>
    `<div class="fld"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${o.type || 'text'}" value="${esc(val ?? '')}" ${o.admin ? disAdmin : dis} ${o.extra || ''}>${o.hint ? `<p class="hint">${o.hint}</p>` : ''}</div>`;
  const chk = (name: string, label: string, on: boolean, adminOnly = false) => `<label class="check"><input type="checkbox" name="${name}" ${on ? 'checked' : ''} ${adminOnly ? disAdmin : dis}> ${label}</label>`;
  const ta = (name: string, label: string, val: string, hint = '', rows = 5) => `<div class="fld"><label for="f-${name}">${label}</label><textarea id="f-${name}" name="${name}" rows="${rows}" ${dis}>${esc(val)}</textarea>${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;

  const langRows = () => `<div class="rows" data-rows="langs">${langs.map((l, i) => `<div class="rowline"><input data-r="langs" data-i="${i}" data-k="language" value="${esc(l.language || '')}" placeholder="Language" ${dis}>
    <select data-r="langs" data-i="${i}" data-k="level" ${dis}><option value="">level (optional)</option>${opt(LANG_LEVELS, l.level || '', (x) => x[0].toUpperCase() + x.slice(1))}</select>
    ${editable ? `<button type="button" class="btn btn--ghost btn--sm" data-act="rm" data-r="langs" data-i="${i}">Remove</button>` : ''}</div>`).join('') || '<p class="hint">No languages recorded.</p>'}</div>`;
  const jobRows = () => `<div class="rows" data-rows="jobs">${jobs.map((j, i) => `<div class="job"><div class="job-g">
      <input data-r="jobs" data-i="${i}" data-k="country" value="${esc(j.country || '')}" placeholder="Country (e.g. Singapore)" ${dis}>
      <input data-r="jobs" data-i="${i}" data-k="duration" value="${esc(j.duration || '')}" placeholder="Years (e.g. 2020 – 2023)" ${dis}></div>
      <input data-r="jobs" data-i="${i}" data-k="duties" value="${esc(j.duties || '')}" placeholder="Main duties (English, max 200 characters)" maxlength="200" ${dis}>
      <input data-r="jobs" data-i="${i}" data-k="duties_ms" value="${esc(j.duties_ms || '')}" placeholder="Tugas utama (Bahasa Melayu, optional)" maxlength="200" ${dis}>
      ${editable ? `<button type="button" class="btn btn--ghost btn--sm" data-act="rm" data-r="jobs" data-i="${i}">Remove this job</button>` : ''}</div>`).join('') || '<p class="hint">No work experience recorded.</p>'}</div>`;

  const panel = (id: string, body: string) => `<section class="panel" data-panel="${id}" ${id === 'personal' ? '' : 'hidden'}>${body}</section>`;
  const photoBox = () => {
    const url = pendingUrl || thumbUrl(m);
    return `<div class="photo-box"><div class="photo-frame">${url ? `<img src="${esc(url)}" alt="Working photo (private)">` : '<div class="photo-empty">No photo yet</div>'}</div>
      <div class="photo-side"><p><b>Working photo (private)</b><br><span class="hint">Shown only to signed-in staff. It is copied to the website only when the maid is published with photo consent.</span></p>
      ${m.public_photo_path ? pill('Photo is on the website', 'ok') : pill('Not on the website', 'grey')}
      ${editable ? `<div class="row-actions"><button class="btn" type="button" data-act="photo-upload">${url ? 'Replace photo…' : 'Upload photo…'}</button>
        ${url && !pendingUrl ? '<button class="btn btn--ghost" type="button" data-act="photo-recrop">Re-crop current photo</button><button class="btn btn--ghost" type="button" data-act="photo-remove">Remove photo</button>' : ''}</div>` : ''}
      ${isNew && pendingUrl ? '<p class="hint">The photo is saved together with the record when you press Save.</p>' : ''}
      ${!isNew && admin && m.public_photo_path ? '<p class="hint">After replacing a photo, use <b>Public profile &amp; approval → Update website photo</b> so the website shows the new one.</p>' : ''}</div></div>`;
  };

  const root = mount(`
  <form id="mf" autocomplete="off">
    <div class="bar">
      <div class="bar-l">${isNew ? '' : `<div class="bar-photo">${thumbHtml(m, 'thumb thumb--lg')}</div>`}
        <div><div class="bar-name">${isNew ? 'New maid' : esc(m.full_name || m.code)}</div>
        <div class="bar-sub">${isNew ? 'Fill in what the biodata states. Nothing is published automatically.' : `Ref: <b>${esc(m.code)}</b> · ${m.nationality === 'filipino' ? 'Filipino' : 'Indonesian'} · ${statusPill(m.status)} ${m.published ? pill('Published', 'ok') : pill('Private', 'grey')}`}</div></div></div>
      <div class="bar-r"><span class="dirty" id="dirty" hidden>Unsaved changes</span>
        <button class="btn btn--ghost" type="button" data-act="preview">Preview public version</button>
        ${editable ? '<button class="btn" type="submit" id="save">Save changes</button>' : '<span class="hint">Read-only (viewer)</span>'}</div>
    </div>
    <div id="mf-msg"></div>
    <div class="tabs2" role="tablist">${TABS.filter(([id]) => !(isNew && ['placement', 'documents', 'history'].includes(id))).map(([id, t], i) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${i === 0}">${t}</button>`).join('')}</div>
    <div class="card pad">
    ${panel('personal', `<div class="g2">
        ${f('code', 'Reference code *', m.code, { extra: isNew ? 'required pattern="[A-Za-z0-9][A-Za-z0-9-]{2,29}" style="text-transform:uppercase"' : 'readonly', hint: isNew ? 'The agency code from the biodata (3–30 capitals, numbers, hyphens). It cannot be changed later.' : 'Cannot be changed.' })}
        <div class="fld"><label for="f-nationality">Nationality *</label><select id="f-nationality" name="nationality" ${dis}>${opt(['indonesian', 'filipino'], m.nationality, (x) => (x === 'filipino' ? 'Filipino' : 'Indonesian'))}</select></div>
        ${f('full_name', 'Full name (reading order) *', m.full_name, { hint: 'e.g. Maria Santos Dela Cruz. Private unless the candidate allows the name to be shown.' })}
        ${f('first_name', 'First (given) name', m.first_name, { hint: 'Used when only the first name may be shown. Filled from the full name if left empty.' })}
        ${f('age', 'Age', m.age, { type: 'number', extra: 'min="21" max="60"', hint: 'Never shown on the website unless the candidate allows it.' })}
        ${f('religion', 'Religion', m.religion, { hint: 'Sensitive personal data — stays private unless explicitly authorised.' })}
        ${f('marital_status', 'Marital status', m.marital_status, { hint: 'Shown on the public profile if filled in.' })}
      </div>`)}
    ${panel('experience', `<div class="g2">${f('experience_years', 'Years of experience', m.experience_years, { type: 'number', extra: 'min="0" max="40" step="0.5"', hint: 'Leave empty if the biodata does not say.' })}
        <div class="fld"><label>&nbsp;</label>${chk('overseas_experience', 'Has overseas experience', m.overseas_experience)}</div></div>
      <h3 class="sec">Skills &amp; care experience</h3><p class="hint">Use "Experienced" only when the work history supports it (it is what the website shows on cards).</p>
      <div class="g3">${SKILLS.map((k) => `<div class="fld"><label for="f-sk-${k}">${SKILL_LABEL[k as keyof typeof SKILL_LABEL]}</label><select id="f-sk-${k}" name="sk-${k}" ${dis}>${opt(LEVELS, m.skills?.[k] || 'none', (x) => LEVEL_LABEL[x as keyof typeof LEVEL_LABEL])}</select></div>`).join('')}</div>
      <h3 class="sec">Work experience &amp; duties</h3><p class="hint">One entry per job: country, years and main duties. Do not enter employer names or addresses.</p>
      <div id="jobs">${jobRows()}</div>${editable ? '<button type="button" class="btn btn--ghost btn--sm" data-act="add-job">+ Add a job</button>' : ''}`)}
    ${panel('languages', `<h3 class="sec">Languages</h3><div id="langs">${langRows()}</div>${editable ? '<button type="button" class="btn btn--ghost btn--sm" data-act="add-lang">+ Add a language</button>' : ''}`)}
    ${panel('pay', `<p class="hint">Only what the maid\'s biodata states. Fields stay empty when nothing is recorded.</p><div class="g2">
        ${f('rest_day_preference', 'Rest-day preference', m.rest_day_preference, { extra: 'list="restdays"', hint: 'e.g. "Not preferred" when the biodata says she does not want a weekly rest day.' })}
        <datalist id="restdays"><option value="Prefers a weekly rest day"><option value="Not preferred"></datalist>
        ${f('salary_note', 'Salary note', m.salary_note, { hint: 'Any salary expectation stated in the biodata. Internal only.' })}</div>`)}
    ${panel('availability', `<div class="g2"><div class="fld"><label for="f-status">Availability *</label><select id="f-status" name="status" ${dis}>${opt(STATUSES, m.status, (x) => STATUS_LABEL[x as keyof typeof STATUS_LABEL])}</select>
        <p class="hint">"To Be Confirmed" = not verified yet. Choosing any other status records that staff have verified it, with today\'s date and your name. Hired and Withdrawn maids are removed from the website listings.</p></div>
        <div class="fld"><label>Verification</label><div class="verif">${m.status_confirmed && m.status !== 'to-be-confirmed' ? `${pill('Confirmed', 'ok')} on <b>${fmtDT(m.status_verified_at)}</b> by <b>${esc(m.status_set_by || '—')}</b>` : `${pill('Not yet confirmed', 'tbc')} ${m.status_set_by ? `initial status set by ${esc(m.status_set_by)}` : ''}`}</div></div>
        ${f('interview_availability_en', 'Interview availability (English)', m.interview_availability_en, { extra: 'maxlength="120"' })}
        ${f('interview_availability_ms', 'Interview availability (Bahasa Melayu)', m.interview_availability_ms, { extra: 'maxlength="120"' })}</div>`)}
    ${panel('photos', isNew ? '<div id="photo-slot">' + photoBox() + '</div>' : '<div id="photo-slot">' + photoBox() + '</div>')}
    ${panel('placement', '<div id="placement-slot"><p class="hint">Loading…</p></div>')}
    ${panel('notes', `${ta('internal_notes', 'Internal notes (staff only — never shown on the website)', m.internal_notes, 'Flags from the biodata review, follow-ups, anything staff should know.', 8)}
      ${ta('discrepancy_notes', 'Biodata discrepancies to resolve', m.discrepancy_notes, 'What needs checking with the candidate or supplier before approval.', 4)}`)}
    ${panel('documents', '<div id="documents-slot"><p class="hint">Loading…</p></div>')}
    ${panel('publication', `<h3 class="sec">Public profile text</h3><div class="g2">
        ${ta('summary_en', 'Profile summary — English', m.summary_en, 'Facts from the biodata only. No passport, IC or phone numbers, addresses, medical or family-health details.', 6)}
        ${ta('summary_ms', 'Profile summary — Bahasa Melayu', m.summary_ms, 'Same facts as the English text.', 6)}</div>
      <h3 class="sec">Consent &amp; approval</h3>
      ${admin ? '' : '<div class="note">Only administrators can record consent and publish. You can see the current state below.</div>'}
      <div class="g3"><div>${chk('consent_recorded', 'Written publication consent on file', m.consent_recorded, true)}</div>
        <div class="fld"><label for="f-consent_date">Consent date</label><input id="f-consent_date" name="consent_date" type="date" value="${esc(m.consent_date || '')}" ${disAdmin}></div>
        ${f('approved_by', 'Approved by (initials)', m.approved_by, { admin: true, extra: 'maxlength="10"' })}
        <div>${chk('photo_consent', 'Photo consent (the photo may be shown)', m.photo_consent, true)}</div>
        <div class="fld"><label for="f-name_consent">Name shown on the website</label><select id="f-name_consent" name="name_consent" ${disAdmin}>${opt(['none', 'first', 'full'], m.name_consent, (x) => ({ none: 'None — reference code only', first: 'First name only', full: 'Full name' } as any)[x])}</select></div>
        ${f('display_name_override', 'Website name override (optional)', m.display_name_override, { admin: true, hint: 'e.g. "Mary Rose" for a two-part first name.' })}
        <div>${chk('show_age', 'Show age on the website', m.show_age, true)}</div><div>${chk('show_religion', 'Show religion (explicit consent only)', m.show_religion, true)}</div>
        <div>${chk('discrepancies_resolved', 'Biodata discrepancies resolved', m.discrepancies_resolved, true)}</div>
        <div>${chk('featured', 'Feature on the homepage', m.featured, true)}</div><div>${chk('published', '<b>Published on the website</b>', m.published, true)}</div></div>
      ${(() => { const r = readiness(m); return `<p class="hint">${m.published ? 'This maid is published.' : r.ready ? '<b>Ready to publish.</b>' : `Not ready: ${esc(r.missing.join(', '))}.`}</p>`; })()}
      ${admin && !isNew && m.published && m.photo_consent ? '<button type="button" class="btn btn--ghost btn--sm" data-act="sync-photo">Update website photo</button>' : ''}
      ${admin && !isNew ? `<h3 class="sec">Safe deletion</h3>${m.status === 'withdrawn' ? '<button type="button" class="btn btn--danger" data-act="delete">Delete this record permanently…</button>' : '<p class="hint">A record can be deleted only when its availability is <b>Withdrawn</b> and it has no placements or documents. Normally keep it as Withdrawn instead — the history is kept.</p>'}` : ''}`)}
    ${panel('history', '<div id="history-slot"><p class="hint">Loading…</p></div>')}
    </div>
  </form>`);

  const form = $<HTMLFormElement>('#mf');
  const el = (n: string) => form.elements.namedItem(n) as HTMLInputElement;
  const markDirty = () => { UI.dirty = true; $('#dirty').hidden = false; };
  form.addEventListener('input', (e) => { const t = e.target as HTMLInputElement; if (t.dataset.r) { const arr = t.dataset.r === 'langs' ? langs : jobs; arr[Number(t.dataset.i)][t.dataset.k!] = t.value; } markDirty(); });
  form.addEventListener('change', markDirty);

  // tabs (lazy-load the tabs that need data)
  const loaded = new Set<string>();
  const openTab = async (id: string) => {
    $$('.tabs2 [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    $$('.panel').forEach((p) => (p.hidden = p.dataset.panel !== id));
    if (isNew || loaded.has(id)) return;
    if (id === 'placement') { loaded.add(id); $('#placement-slot').innerHTML = await maidPlacementsHtml(m); }
    if (id === 'documents') { loaded.add(id); $('#documents-slot').innerHTML = await maidDocumentsHtml(m); }
    if (id === 'history') { loaded.add(id); $('#history-slot').innerHTML = historyTable(await logHistory('maids', m.id, 200)); }
  };
  $$('.tabs2 [data-tab]').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab!)));

  // last edited
  if (!isNew) logHistory('maids', m.id, 1).then((h) => { const r = h[0]; if (r) $('.bar-sub').insertAdjacentHTML('beforeend', `<div class="hint">Last changed ${fmtDT(r.changed_at)} by ${esc(r.changed_by_email || 'office script')}</div>`); });

  // collect + save
  const num = (v: string) => (v === '' ? null : Number(v));
  const collect = (): Row => {
    const row: Row = {
      code: el('code').value.trim().toUpperCase(), nationality: el('nationality').value, full_name: el('full_name').value.trim(), first_name: el('first_name').value.trim(),
      age: num(el('age').value), religion: el('religion').value.trim(), marital_status: el('marital_status').value.trim(), experience_years: num(el('experience_years').value), overseas_experience: el('overseas_experience').checked,
      skills: Object.fromEntries(SKILLS.map((k) => [k, el(`sk-${k}`).value])), languages: langs.filter((l) => (l.language || '').trim()).map((l) => ({ language: l.language.trim(), ...(l.level ? { level: l.level } : {}) })),
      employment_history: jobs.filter((j) => (j.country || '').trim() || (j.duration || '').trim()).map((j) => ({ country: (j.country || '').trim(), duration: (j.duration || '').trim(), duties: (j.duties || '').trim(), ...((j.duties_ms || '').trim() ? { duties_ms: j.duties_ms.trim() } : {}) })),
      rest_day_preference: el('rest_day_preference').value.trim(), salary_note: el('salary_note').value.trim(), status: el('status').value,
      interview_availability_en: el('interview_availability_en').value.trim(), interview_availability_ms: el('interview_availability_ms').value.trim(),
      internal_notes: el('internal_notes').value, discrepancy_notes: el('discrepancy_notes').value, summary_en: el('summary_en').value.trim(), summary_ms: el('summary_ms').value.trim(),
    };
    if (!row.first_name && row.full_name) row.first_name = splitName(row.full_name).firstName;
    if (admin) Object.assign(row, { consent_recorded: el('consent_recorded').checked, consent_date: el('consent_date').value || null, approved_by: el('approved_by').value.trim(), photo_consent: el('photo_consent').checked,
      name_consent: el('name_consent').value, display_name_override: el('display_name_override').value.trim(), show_age: el('show_age').checked, show_religion: el('show_religion').checked,
      discrepancies_resolved: el('discrepancies_resolved').checked, featured: el('featured').checked, published: el('published').checked });
    // verification: choosing a real status = staff verified it now
    if (row.status === 'to-be-confirmed') row.status_confirmed = false;
    else if (isNew || row.status !== m.status || !m.status_confirmed) { row.status_confirmed = true; row.status_set_by = myName(); }
    return row;
  };

  onClick(root, {
    'add-lang': () => { langs.push({ language: '', level: '' }); $('#langs').innerHTML = langRows(); markDirty(); },
    'add-job': () => { jobs.push({ country: '', duration: '', duties: '', duties_ms: '' }); $('#jobs').innerHTML = jobRows(); markDirty(); },
    rm: (b) => { const arr = b.dataset.r === 'langs' ? langs : jobs; arr.splice(Number(b.dataset.i), 1); (b.dataset.r === 'langs' ? $('#langs') : $('#jobs')).innerHTML = b.dataset.r === 'langs' ? langRows() : jobRows(); markDirty(); },
    preview: () => previewDialog({ ...m, ...collect(), photo_path: pendingUrl ? '' : m.photo_path }),
    'photo-upload': async () => {
      const file = await pickFile('image/jpeg,image/png,image/webp'); if (!file) return;
      const blob = await cropper(file); if (!blob) return;
      if (isNew) { pendingPhoto = blob; pendingUrl = URL.createObjectURL(blob); $('#photo-slot').innerHTML = photoBox(); markDirty(); return; }
      try { m = { ...m, ...(await savePrivatePhoto(m, blob)) }; $('#photo-slot').innerHTML = photoBox(); toast('Photo saved (private).'); } catch (e) { toast(`Photo not saved: ${(e as Error).message}`, 'err'); }
    },
    'photo-recrop': async () => {
      const { data: blob, error } = await S.sb.storage.from(PRIVATE).download(m.photo_path); if (error || !blob) return toast('Could not open the current photo.', 'err');
      const out = await cropper(blob); if (!out) return;
      try { m = { ...m, ...(await savePrivatePhoto(m, out)) }; $('#photo-slot').innerHTML = photoBox(); toast('Photo re-cropped.'); } catch (e) { toast(`Not saved: ${(e as Error).message}`, 'err'); }
    },
    'photo-remove': async () => {
      if (m.public_photo_path) return toast('This photo is on the website. Un-publish the maid (Public profile & approval) before removing it.', 'err');
      if (!(await ask('Remove the working photo of this maid? You can upload another one afterwards.', { ok: 'Remove photo', danger: true }))) return;
      await S.sb.storage.from(PRIVATE).remove([m.photo_path]);
      const { data, error } = await S.sb.from('maids').update({ photo_path: '' }).eq('id', m.id).select().single();
      if (error) return toast(error.message, 'err'); m = { ...m, ...data }; replaceMaid(data); $('#photo-slot').innerHTML = photoBox(); toast('Photo removed.');
    },
    'pl-edit': (b) => editPlacementById(b.dataset.id!, async () => { loaded.delete('placement'); await openTab('placement'); }),
    'doc-open': (b) => openDocument(b.dataset.id!),
    'doc-del': (b) => deleteDocument(b.dataset.id!, async () => { loaded.delete('documents'); await openTab('documents'); }),
    'new-placement': () => openPlacementDialog({ maid: m, onDone: async () => { loaded.delete('placement'); await openTab('placement'); } }),
    'new-doc': () => openUploadDialog({ maid: m, onDone: async () => { loaded.delete('documents'); await openTab('documents'); } }),
    'sync-photo': async () => { try { m = { ...m, ...(await syncPublicPhoto(m)) }; replaceMaid(m); toast('Website photo updated.'); } catch (e) { toast((e as Error).message, 'err'); } },
    delete: async () => {
      if (!(await askTyped(`Delete ${m.full_name || m.code} (${m.code}) permanently? The deletion stays in the history, but the record and photo cannot be recovered except from a backup.`, m.code))) return;
      const { error } = await S.sb.from('maids').delete().eq('id', m.id);
      if (error) return toast(/foreign key|violates/.test(error.message) ? 'This maid still has placements or documents — remove or archive those first.' : error.message, 'err');
      await S.sb.storage.from(PRIVATE).remove([m.photo_path].filter(Boolean)); await S.sb.storage.from(PUBLIC).remove([`${slugOf(m.code)}.webp`]);
      S.maids = S.maids.filter((x) => x.id !== m.id); UI.dirty = false; toast('Record deleted.'); go('#/maids');
    },
  });
  $$('.tabs2 [data-tab]')[0]?.dispatchEvent(new Event('click'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editable) return;
    const msg = $('#mf-msg'); msg.innerHTML = '';
    const row = collect();
    if (isNew && S.maids.some((x) => x.code === row.code)) { msg.innerHTML = `<div class="err">Reference code ${esc(row.code)} already exists.</div>`; return; }
    row.photo_path = isNew ? '' : m.photo_path;
    const { errors } = validateRow({ ...(isNew ? {} : m), ...row, photo_path: row.photo_path || (pendingPhoto ? 'pending' : '') });
    if (!row.full_name) errors.push('Enter the full name');
    if (errors.length) { msg.innerHTML = `<div class="err">${esc(errors.join('\n'))}</div>`; window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!isNew && HIDDEN.includes(row.status) && !HIDDEN.includes(m.status) && m.published && !(await ask(`${STATUS_LABEL[row.status as keyof typeof STATUS_LABEL]} maids are removed from the website listings. Continue?`))) return;
    const btn = $<HTMLButtonElement>('#save'); btn.disabled = true;
    try {
      let saved: Row;
      if (isNew) {
        const r = await S.sb.from('maids').insert(row).select().single(); if (r.error) throw r.error; saved = r.data;
        if (pendingPhoto) saved = await savePrivatePhoto(saved, pendingPhoto);
      } else {
        const changes = Object.fromEntries(Object.entries(row).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(m[k]) && !(!admin && RESTRICTED.includes(k))));
        if (admin && m.public_photo_path && row.published === false) changes.public_photo_path = '';
        if (!Object.keys(changes).length) { toast('Nothing has changed.'); btn.disabled = false; return; }
        const r = await S.sb.from('maids').update(changes).eq('id', m.id).select().single(); if (r.error) throw r.error; saved = r.data;
        if (admin) saved = await syncPublicPhoto(saved);
      }
      replaceMaid(saved); UI.dirty = false;
      toast(`Saved ${saved.full_name || saved.code}.`);
      if (isNew) go(`#/maid/${saved.code}`); else await renderEditor(saved.code);
    } catch (err) {
      const t = String((err as Error).message || err);
      msg.innerHTML = `<div class="err">Not saved: ${esc(/publish_requires_consent/.test(t) ? 'publishing needs written consent, the consent date, the approver initials and "discrepancies resolved"' : /public_photo_requires_consent/.test(t) ? 'the website photo needs the maid to be published with photo consent' : /duplicate key/.test(t) ? 'that reference code already exists' : t)}</div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally { btn.disabled = false; }
  });
}
