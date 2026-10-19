// All Maid Biodata: view, search, filter; CSV import (never publishes, never resets existing settings); admin-only export.
import { S, esc, mount, setTitle, toast, canEdit, isAdmin, loadMaids, ensureThumbs, thumbHtml, thumbUrl, statusPill, pill, pager, fmtDate, natLabel, go, onClick, dialog, downloadCsv, logExport, type Row } from './core';
import { STATUSES, STATUS_LABEL, SKILLS, SKILL_LABEL, parseCsv, csvRowToDb, validateRow, changedFields, restrictToColumns } from '../mapping.js';

const F = { q: '', nat: '', status: '', pub: '', photo: '', page: 1, view: 'table', sort: 'name', dir: 1 };
const SIZE = 20;
const RESTRICTED = ['published', 'consent_recorded', 'consent_date', 'photo_consent', 'name_consent', 'show_age', 'show_religion', 'approved_by', 'public_photo_path', 'discrepancies_resolved', 'featured', 'display_name_override'];
const savedView = () => { try { return localStorage.getItem('fc-maid-view') || F.view; } catch { return F.view; } };

/** Search matches name, reference, nationality, availability label, "experienced" skills (e.g. "cooking"), languages and countries worked in. */
export function filterMaids(f: { q?: string; nat?: string; status?: string; pub?: string; photo?: string }) {
  const q = (f.q || '').trim().toLowerCase();
  const hay = (m: Row) => [m.code, m.full_name, m.first_name, natLabel(m.nationality), STATUS_LABEL[m.status as keyof typeof STATUS_LABEL],
    ...SKILLS.filter((k) => m.skills?.[k] === 'experienced').map((k) => SKILL_LABEL[k as keyof typeof SKILL_LABEL]),
    ...(m.languages || []).map((l: Row) => l.language), ...(m.employment_history || []).map((j: Row) => j.country)].join(' ').toLowerCase();
  return S.maids.filter((m) => (!q || q.split(/\s+/).every((w) => hay(m).includes(w)))
    && (!f.nat || m.nationality === f.nat) && (!f.status || m.status === f.status)
    && (!f.pub || (f.pub === 'pub') === m.published) && (!f.photo || (f.photo === 'none') === !m.photo_path));
}
const SORTS: Record<string, (a: Row, b: Row) => number> = {
  name: (a, b) => (a.full_name || a.code).localeCompare(b.full_name || b.code), code: (a, b) => a.code.localeCompare(b.code),
  nationality: (a, b) => a.nationality.localeCompare(b.nationality) || (a.full_name || '').localeCompare(b.full_name || ''),
  status: (a, b) => a.status.localeCompare(b.status), updated: (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)),
};

export async function renderMaids(preset?: Partial<typeof F>) {
  await loadMaids(); await ensureThumbs();
  if (preset) Object.assign(F, { q: '', nat: '', status: '', pub: '', photo: '', page: 1 }, preset);
  F.view = savedView();
  setTitle('All Maid Biodata', `${S.maids.length} candidates`);
  const ed = canEdit();
  const root = mount(`
    <div class="chips" id="chips">${[['', 'All Maids'], ['indonesian', 'Indonesian'], ['filipino', 'Filipino']].map(([v, l]) => `<button class="chip" type="button" data-chip="nat" data-v="${v}">${l}</button>`).join('')}<span style="width:12px"></span>${STATUSES.map((s) => `<button class="chip" type="button" data-chip="status" data-v="${s}">${STATUS_LABEL[s as keyof typeof STATUS_LABEL]}</button>`).join('')}</div>
    <div class="toolbar2">
      <div class="fld grow"><label for="q">Search</label><input id="q" type="search" placeholder="Name, reference, nationality, skill (e.g. cooking), language…" value="${esc(F.q)}" autocomplete="off"></div>
      <div class="fld"><label for="pub">Website</label><select id="pub"><option value="">All</option><option value="pub">Published</option><option value="priv">Not published</option></select></div>
      <div class="fld"><label for="ph">Photo</label><select id="ph"><option value="">All</option><option value="none">Missing photo</option><option value="has">Has photo</option></select></div>
      <div class="fld"><label for="srt">Sort by</label><select id="srt"><option value="name">Name</option><option value="code">Reference</option><option value="nationality">Nationality</option><option value="status">Availability</option><option value="updated">Last updated</option></select></div>
    </div>
    <div class="actions-bar">
      ${ed ? '<a class="btn" href="#/add">+ Add New Maid</a><button class="btn btn--ghost" data-act="import" type="button">Import CSV…</button>' : ''}
      ${isAdmin() ? '<button class="btn btn--ghost" data-act="export" type="button">Export…</button>' : ''}
      <div class="vsw" role="group" aria-label="View"><button type="button" data-view="table">Table</button><button type="button" data-view="card">Cards</button></div>
      <span class="count" id="count"></span>
    </div>
    <div class="card" id="list"></div><div id="pg"></div>`);
  const set = (id: string, v: string) => ((document.getElementById(id) as HTMLInputElement).value = v);
  set('pub', F.pub); set('ph', F.photo); set('srt', F.sort);
  const act = (m: Row) => `<a class="btn btn--ghost btn--sm" href="#/maid/${esc(m.code)}">View</a>${ed ? ` <a class="btn btn--sm" href="#/maid/${esc(m.code)}">Edit</a>` : ''}`;
  const draw = () => {
    const hits = filterMaids(F).sort((a, b) => SORTS[F.sort](a, b) * F.dir);
    const pages = Math.max(1, Math.ceil(hits.length / SIZE)); F.page = Math.min(F.page, pages);
    document.getElementById('count')!.textContent = `${hits.length} of ${S.maids.length} maids`;
    root.querySelectorAll<HTMLElement>('[data-chip]').forEach((c) => c.classList.toggle('on', (F as any)[c.dataset.chip!] === c.dataset.v));
    root.querySelectorAll<HTMLElement>('[data-view]').forEach((c) => c.classList.toggle('on', c.dataset.view === F.view));
    const slice = hits.slice((F.page - 1) * SIZE, F.page * SIZE);
    document.getElementById('list')!.innerHTML = !slice.length ? '<p class="empty">No maids match these filters.</p>' : F.view === 'card'
      ? `<div class="mgrid">${slice.map((m) => `<div class="mcard"><div class="pimg" data-act="open" data-code="${esc(m.code)}">${thumbUrl(m) ? `<img src="${esc(thumbUrl(m))}" alt="${esc(m.full_name || m.code)}" loading="lazy">` : '<div class="photo-empty">No photo</div>'}</div>
          <div class="pmeta"><div class="strong">${esc(m.full_name || '(no name)')}</div><div class="hint">Ref: ${esc(m.code)} · ${esc(natLabel(m.nationality))}</div>
          <div class="pills">${statusPill(m.status)}${m.published ? pill('Published', 'ok') : pill('Private', 'grey')}</div><div class="hint">Updated ${fmtDate(m.updated_at)}</div><div class="row-actions">${act(m)}</div></div></div>`).join('')}</div>`
      : `<div class="tbl-wrap"><table class="tbl tbl--click tbl--maids"><tr><th></th><th data-sort="name">Name</th><th data-sort="nationality">Nationality</th><th>Experience</th><th data-sort="status">Availability</th><th>Website</th><th data-sort="updated">Updated</th><th></th></tr>${slice.map((m) => `
        <tr data-act="open" data-code="${esc(m.code)}"><td>${thumbHtml(m)}</td>
        <td><div class="strong">${esc(m.full_name || '(no name)')}</div><div class="hint">Ref: ${esc(m.code)} · ${esc(natLabel(m.nationality))}</div></td><td>${esc(natLabel(m.nationality))}</td>
        <td>${m.experience_years == null ? '<span class="hint">not stated</span>' : `${esc(m.experience_years)} yr`}</td>
        <td>${statusPill(m.status)}</td><td>${m.published ? pill('Published', 'ok') : pill('Private', 'grey')}</td><td class="nw hint">${fmtDate(m.updated_at)}</td><td class="nw">${act(m)}</td></tr>`).join('')}</table></div>`;
    document.getElementById('pg')!.innerHTML = pager(hits.length, F.page, SIZE);
  };
  draw();
  const bind = (id: string, key: keyof typeof F) => document.getElementById(id)!.addEventListener('input', (e) => { (F as any)[key] = (e.target as HTMLInputElement).value; F.page = 1; if (key === 'sort') F.dir = 1; draw(); });
  bind('q', 'q'); bind('pub', 'pub'); bind('ph', 'photo'); bind('srt', 'sort');
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const b = t.closest<HTMLElement>('[data-page]'); if (b && !(b as HTMLButtonElement).disabled) { F.page = Number(b.dataset.page); draw(); return; }
    const c = t.closest<HTMLElement>('[data-chip]'); if (c) { const k = c.dataset.chip as 'nat' | 'status'; F[k] = F[k] === c.dataset.v ? '' : c.dataset.v!; F.page = 1; draw(); return; }
    const v = t.closest<HTMLElement>('[data-view]'); if (v) { F.view = v.dataset.view!; try { localStorage.setItem('fc-maid-view', F.view); } catch { /* ignore */ } draw(); return; }
    const h = t.closest<HTMLElement>('th[data-sort]'); if (h) { F.dir = F.sort === h.dataset.sort ? -F.dir : 1; F.sort = h.dataset.sort!; set('srt', F.sort); draw(); }
  });
  onClick(root, {
    open: (el, ev) => { if ((ev.target as HTMLElement).closest('a,button')) return; go(`#/maid/${el.dataset.code}`); },
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
