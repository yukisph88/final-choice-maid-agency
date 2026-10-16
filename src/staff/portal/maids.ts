// All Maid Biodata: view, search, filter; CSV import (never publishes, never resets existing settings); admin-only export.
import { S, esc, mount, setTitle, toast, canEdit, isAdmin, loadMaids, ensureThumbs, thumbHtml, statusPill, pill, pager, fmtDate, natLabel, go, onClick, dialog, downloadCsv, logExport, type Row } from './core';
import { STATUSES, STATUS_LABEL, parseCsv, csvRowToDb, validateRow, changedFields, restrictToColumns } from '../mapping.js';

const F = { q: '', nat: '', status: '', pub: '', photo: '', page: 1 };
const SIZE = 20;
const RESTRICTED = ['published', 'consent_recorded', 'consent_date', 'photo_consent', 'name_consent', 'show_age', 'show_religion', 'approved_by', 'public_photo_path', 'discrepancies_resolved', 'featured', 'display_name_override'];

export function filterMaids(f: { q?: string; nat?: string; status?: string; pub?: string; photo?: string }) {
  const q = (f.q || '').trim().toLowerCase();
  return S.maids.filter((m) => (!q || m.code.toLowerCase().includes(q) || (m.full_name || '').toLowerCase().includes(q))
    && (!f.nat || m.nationality === f.nat) && (!f.status || m.status === f.status)
    && (!f.pub || (f.pub === 'pub') === m.published) && (!f.photo || (f.photo === 'none') === !m.photo_path));
}

export async function renderMaids(preset?: Partial<typeof F>) {
  await loadMaids(); await ensureThumbs();
  if (preset) Object.assign(F, { q: '', nat: '', status: '', pub: '', photo: '', page: 1 }, preset);
  setTitle('All Maid Biodata', `${S.maids.length} candidates`);
  const root = mount(`
    <div class="toolbar2">
      <div class="fld grow"><label for="q">Search</label><input id="q" type="search" placeholder="Name or reference code" value="${esc(F.q)}" autocomplete="off"></div>
      <div class="fld"><label for="nat">Nationality</label><select id="nat"><option value="">All</option><option value="indonesian">Indonesian</option><option value="filipino">Filipino</option></select></div>
      <div class="fld"><label for="st">Availability</label><select id="st"><option value="">All</option>${STATUSES.map((s) => `<option value="${s}">${STATUS_LABEL[s as keyof typeof STATUS_LABEL]}</option>`).join('')}</select></div>
      <div class="fld"><label for="pub">Website</label><select id="pub"><option value="">All</option><option value="pub">Published</option><option value="priv">Not published</option></select></div>
      <div class="fld"><label for="ph">Photo</label><select id="ph"><option value="">All</option><option value="none">Missing photo</option><option value="has">Has photo</option></select></div>
    </div>
    <div class="actions-bar">
      ${canEdit() ? '<a class="btn" href="#/add">+ Add New Maid</a><button class="btn btn--ghost" data-act="import" type="button">Import CSV…</button>' : ''}
      ${isAdmin() ? '<button class="btn btn--ghost" data-act="export" type="button">Export…</button>' : ''}
      <span class="count" id="count"></span>
    </div>
    <div class="card"><div class="tbl-wrap" id="tbl"></div></div><div id="pg"></div>`);
  const set = (id: string, v: string) => ((document.getElementById(id) as HTMLInputElement).value = v);
  set('nat', F.nat); set('st', F.status); set('pub', F.pub); set('ph', F.photo);

  const draw = () => {
    const hits = filterMaids(F); const pages = Math.max(1, Math.ceil(hits.length / SIZE)); F.page = Math.min(F.page, pages);
    document.getElementById('count')!.textContent = `${hits.length} of ${S.maids.length} maids`;
    const slice = hits.slice((F.page - 1) * SIZE, F.page * SIZE);
    document.getElementById('tbl')!.innerHTML = slice.length ? `<table class="tbl tbl--click tbl--maids"><tr><th></th><th>Name</th><th>Nationality</th><th>Experience</th><th>Availability</th><th>Website</th><th>Updated</th></tr>${slice.map((m) => `
      <tr data-act="open" data-code="${esc(m.code)}"><td>${thumbHtml(m)}</td>
      <td><div class="strong">${esc(m.full_name || '(no name)')}</div><div class="hint">Ref: ${esc(m.code)} · ${esc(natLabel(m.nationality))}</div></td><td>${esc(natLabel(m.nationality))}</td>
      <td>${m.experience_years == null ? '<span class="hint">not stated</span>' : `${esc(m.experience_years)} yr`}</td>
      <td>${statusPill(m.status)}${m.status_confirmed && m.status !== 'to-be-confirmed' ? '' : ''}</td>
      <td>${m.published ? pill('Published', 'ok') : pill('Private', 'grey')}</td><td class="nw hint">${fmtDate(m.updated_at)}</td></tr>`).join('')}</table>` : '<p class="empty">No maids match these filters.</p>';
    document.getElementById('pg')!.innerHTML = pager(hits.length, F.page, SIZE);
  };
  draw();
  const bind = (id: string, key: keyof typeof F) => document.getElementById(id)!.addEventListener('input', (e) => { (F as any)[key] = (e.target as HTMLInputElement).value; F.page = 1; draw(); });
  bind('q', 'q'); bind('nat', 'nat'); bind('st', 'status'); bind('pub', 'pub'); bind('ph', 'photo');
  root.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-page]'); if (b && !(b as HTMLButtonElement).disabled) { F.page = Number(b.dataset.page); draw(); } });
  onClick(root, {
    open: (el) => go(`#/maid/${el.dataset.code}`),
    import: () => importDialog(),
    export: () => exportDialog(),
  });
}

// ---------- CSV import ----------
function importDialog() {
  const admin = isAdmin();
  const d = dialog({ title: 'Import maids from CSV', wide: true, body: `<p>Use the office maid list columns (save from Excel as <b>CSV UTF-8</b>). Maids are matched by reference code.</p>
    <ul class="hint"><li>New maids are added; existing maids are updated <b>only in the columns your file contains</b> — a short list can never reset consent or names.</li>
    <li>Imported maids are never published. A status is changed only when the file has both <code>status</code> and <code>statusConfirmed</code> columns; otherwise new maids start as <b>To Be Confirmed</b>.</li>
    ${admin ? '' : '<li>Publication and consent columns are ignored for editors (administrators only).</li>'}</ul>
    <input type="file" accept=".csv,text/csv" data-f><div data-out></div>`, foot: '<button class="btn btn--ghost" data-no type="button">Close</button><button class="btn" data-go type="button" disabled>Apply import</button>' });
  d.q('[data-no]').addEventListener('click', () => d.close());
  let plan: Row[] = []; const apply = d.q<HTMLButtonElement>('[data-go]');
  d.q<HTMLInputElement>('[data-f]').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
    const src = parseCsv(await file.text()).filter((r: Row) => r.code && !/^EXAMPLE/i.test(r.code));
    const byCode = new Map(S.maids.map((m) => [m.code, m])); const seen = new Set<string>(); const lines: string[] = []; plan = []; let bad = 0; let same = 0; let added = 0; let upd = 0;
    for (const r of src) {
      const full = csvRowToDb(r); const code = full.code;
      if (seen.has(code)) { bad++; lines.push(`<tr><td>${esc(code)}</td><td class="err">Listed twice in the file</td></tr>`); continue; } seen.add(code);
      const old = byCode.get(code);
      let out: Row = old ? restrictToColumns(full, Object.keys(r), old) : { ...full, photo_path: '' };
      delete out.published; delete out.public_photo_path;
      if (!admin) for (const k of RESTRICTED) delete out[k];
      const { errors } = validateRow({ ...(old || {}), ...out, published: false });
      if (errors.length) { bad++; lines.push(`<tr><td>${esc(code)}</td><td class="err">${esc(errors.join('; '))}</td></tr>`); continue; }
      if (!old) { plan.push(out); added++; lines.push(`<tr><td>${esc(code)}</td><td>New — ${esc(full.full_name)}</td></tr>`); continue; }
      const diff = changedFields(old, out); if (!diff.length) { same++; continue; }
      plan.push(out); upd++; lines.push(`<tr><td>${esc(code)}</td><td>Update: ${esc(diff.join(', '))}</td></tr>`);
    }
    if (bad) plan = [];
    d.q('[data-out]').innerHTML = `<p><b>${src.length}</b> rows · <b>${added}</b> new · <b>${upd}</b> changed · ${same} unchanged · <b>${bad}</b> with problems</p>${bad ? '<div class="err">Fix the rows marked in red and choose the file again. Nothing has been imported.</div>' : ''}<div class="tbl-wrap"><table class="tbl">${lines.join('')}</table></div>`;
    apply.disabled = !plan.length;
  });
  apply.addEventListener('click', async () => {
    apply.disabled = true; const existing = new Map(S.maids.map((m) => [m.code, m]));
    const fresh = plan.filter((r) => !existing.has(r.code));
    for (let i = 0; i < fresh.length; i += 50) { const { error } = await S.sb.from('maids').insert(fresh.slice(i, i + 50)); if (error) return d.q('[data-out]').insertAdjacentHTML('afterbegin', `<div class="err">Stopped: ${esc(error.message)}</div>`); }
    for (const r of plan.filter((x) => existing.has(x.code))) {
      const { code, ...changes } = r; const { error } = await S.sb.from('maids').update(changes).eq('id', existing.get(code)!.id);
      if (error) return d.q('[data-out]').insertAdjacentHTML('afterbegin', `<div class="err">Stopped at ${esc(code)}: ${esc(error.message)}</div>`);
    }
    toast(`${plan.length} record(s) imported. Publication settings were not changed.`); d.close(); await loadMaids(true); await renderMaids();
  });
}

// ---------- export (administrators only; recorded in the audit log) ----------
function exportDialog() {
  const d = dialog({ title: 'Export maid register', body: `<p>Exports a CSV of the maid register. Exports are recorded in the audit log with your name.</p>
    <label class="check"><input type="checkbox" data-sens> Include sensitive fields (religion, marital status, internal notes)</label><p class="hint">Keep exported files private — they contain candidates' personal data. Do not e-mail or upload them.</p>`,
    foot: '<button class="btn btn--ghost" data-no type="button">Cancel</button><button class="btn" data-go type="button">Download CSV</button>' });
  d.q('[data-no]').addEventListener('click', () => d.close());
  d.q('[data-go]').addEventListener('click', async () => {
    const sens = d.q<HTMLInputElement>('[data-sens]').checked;
    const rows = S.maids.map((m) => ({ reference: m.code, name: m.full_name, nationality: m.nationality, age: m.age, experience_years: m.experience_years, availability: STATUS_LABEL[m.status as keyof typeof STATUS_LABEL], availability_confirmed: m.status_confirmed ? 'yes' : 'no',
      published: m.published ? 'yes' : 'no', consent_on_file: m.consent_recorded ? 'yes' : 'no', consent_date: m.consent_date || '', photo_consent: m.photo_consent ? 'yes' : 'no', name_consent: m.name_consent, rest_day: m.rest_day_preference,
      last_updated: m.updated_at, ...(sens ? { religion: m.religion, marital_status: m.marital_status, internal_notes: m.internal_notes } : {}) }));
    try { await logExport(`maid register${sens ? ' (sensitive)' : ''}`, rows.length); downloadCsv(`maid-register-${new Date().toISOString().slice(0, 10)}.csv`, rows); d.close(); toast(`${rows.length} rows exported.`); }
    catch (e) { toast((e as Error).message, 'err'); }
  });
}
