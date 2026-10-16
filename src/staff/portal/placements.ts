// Applications & Placements: employer matching, booking, placement details, progress and history.
import { S, esc, mount, setTitle, toast, ask, askTyped, canEdit, isAdmin, loadMaids, ensureThumbs, maidById, nameOf, thumbHtml, pill, pager, fmtDate, fmtDT, natLabel, go, onClick, dialog, logHistory, historyTable, myName, type Row } from './core';
import { STATUS_LABEL } from '../mapping.js';

export const STAGES: [string, string][] = [['enquiry', 'Enquiry'], ['matched', 'Matched'], ['interview', 'Interview'], ['booked', 'Booked'], ['processing', 'Processing'], ['pending-arrival', 'Pending Arrival'], ['placed', 'Placed'], ['cancelled', 'Cancelled']];
const STAGE_LABEL = Object.fromEntries(STAGES) as Record<string, string>;
const STAGE_CLASS: Record<string, string> = { enquiry: 'grey', matched: 'blue', interview: 'blue', booked: 'warn', processing: 'violet', 'pending-arrival': 'violet', placed: 'ok', cancelled: 'grey' };
const CATEGORY: Record<string, string> = { '': '—', indonesian: 'Indonesian Maid', 'indonesian-christian': 'Indonesian Christian Maid', filipino: 'Filipino Maid' };
const stagePill = (s: string) => pill(STAGE_LABEL[s] || s, STAGE_CLASS[s] || 'grey');
const progress = (s: string) => { const i = STAGES.findIndex(([k]) => k === s); const n = s === 'cancelled' ? 0 : Math.max(0, i) + 1; return `<div class="prog" title="${esc(STAGE_LABEL[s])}"><i style="width:${(n / 7) * 100}%"></i></div>`; };
const F = { q: '', stage: '', nat: '', page: 1 };

export async function loadPlacements() {
  const { data, error } = await S.sb.from('placements').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load placements: ${error.message}`);
  S.placements = data; return data as Row[];
}

// the maid's availability follows the placement (staff confirm with one click)
const SUGGEST: Record<string, string> = { booked: 'booked', processing: 'booked', 'pending-arrival': 'pending-arrival', placed: 'hired', cancelled: 'to-be-confirmed' };
async function offerStatus(p: Row) {
  const m = maidById(p.maid_id); const target = SUGGEST[p.stage]; if (!m || !target || m.status === target) return;
  const why = p.stage === 'cancelled' ? 'The placement was cancelled, so her availability is unknown again.' : `The placement is now "${STAGE_LABEL[p.stage]}".`;
  if (!(await ask(`${why}\nSet ${nameOf(m)}'s availability to "${STATUS_LABEL[target as keyof typeof STATUS_LABEL]}"?`, { ok: 'Update availability' }))) return;
  const confirmed = target !== 'to-be-confirmed';
  const { data, error } = await S.sb.from('maids').update({ status: target, status_confirmed: confirmed, status_set_by: myName() }).eq('id', m.id).select().single();
  if (error) return toast(error.message, 'err');
  const i = S.maids.findIndex((x) => x.id === m.id); if (i >= 0) S.maids[i] = data; toast(`${nameOf(m)} is now ${STATUS_LABEL[target as keyof typeof STATUS_LABEL]}.`);
}

export function openPlacementDialog(o: { maid?: Row; placement?: Row; onDone?: () => void }) {
  const p: Row = o.placement || { maid_id: o.maid?.id || '', employer_name: '', employer_phone: '', employer_location: '', package_category: o.maid ? (o.maid.nationality === 'filipino' ? 'filipino' : 'indonesian') : '', package_tier: '', stage: 'enquiry', notes: '' };
  const isNew = !o.placement; const ed = canEdit(); const dis = ed ? '' : 'disabled';
  const dt = (n: string, l: string) => `<div class="fld"><label>${l}</label><input type="date" name="${n}" value="${esc(p[n] || '')}" ${dis}></div>`;
  const maidOpts = `<option value="">— not chosen yet —</option>${S.maids.map((m) => `<option value="${esc(m.id)}"${m.id === p.maid_id ? ' selected' : ''}>${esc(nameOf(m))} (${esc(m.code)})</option>`).join('')}`;
  const d = dialog({ title: isNew ? 'New placement' : 'Placement details', wide: true, body: `<form data-f autocomplete="off"><div class="g2">
      <div class="fld"><label>Maid</label><select name="maid_id" ${dis}>${maidOpts}</select></div>
      <div class="fld"><label>Stage</label><select name="stage" ${dis}>${STAGES.map(([k, l]) => `<option value="${k}"${k === p.stage ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld"><label>Employer name</label><input name="employer_name" value="${esc(p.employer_name)}" ${dis}></div>
      <div class="fld"><label>Employer phone <span class="hint">(internal only)</span></label><input name="employer_phone" value="${esc(p.employer_phone)}" ${dis}></div>
      <div class="fld"><label>Employer location</label><input name="employer_location" value="${esc(p.employer_location)}" placeholder="e.g. Petaling Jaya, Selangor" ${dis}></div>
      <div class="g2i"><div class="fld"><label>Package category</label><select name="package_category" ${dis}>${Object.entries(CATEGORY).map(([k, l]) => `<option value="${k}"${k === p.package_category ? ' selected' : ''}>${l === '—' ? 'Not chosen' : l}</option>`).join('')}</select></div>
        <div class="fld"><label>Package</label><select name="package_tier" ${dis}>${[['', 'Not chosen'], ['premium', 'Premium'], ['platinum', 'Platinum'], ['diamond', 'Diamond']].map(([k, l]) => `<option value="${k}"${k === p.package_tier ? ' selected' : ''}>${l}</option>`).join('')}</select></div></div>
      ${dt('interview_date', 'Interview date')}${dt('booking_date', 'Booking date')}${dt('expected_arrival', 'Expected arrival')}${dt('arrival_date', 'Arrival date')}${dt('placement_date', 'Placement date')}${dt('warranty_end', 'Warranty ends')}</div>
      <div class="fld"><label>Notes</label><textarea name="notes" rows="3" ${dis}>${esc(p.notes)}</textarea></div><div data-msg></div></form>
      ${isNew ? '' : '<h3 class="sec">History of this placement</h3><div data-hist><p class="hint">Loading…</p></div>'}`,
    foot: `${!isNew && isAdmin() ? '<button class="btn btn--danger" data-del type="button">Delete…</button><span style="flex:1"></span>' : ''}<button class="btn btn--ghost" data-no type="button">Close</button>${ed ? '<button class="btn" data-save type="button">Save placement</button>' : ''}` });
  d.q('[data-no]').addEventListener('click', () => d.close());
  if (!isNew) logHistory('placements', p.id).then((h) => { d.q('[data-hist]').innerHTML = historyTable(h); });
  d.q('[data-del]')?.addEventListener('click', async () => {
    if (!(await askTyped('Delete this placement record permanently? The deletion stays in the audit log.', 'DELETE'))) return;
    const { error } = await S.sb.from('placements').delete().eq('id', p.id); if (error) return toast(error.message, 'err');
    toast('Placement deleted.'); d.close(); o.onDone?.();
  });
  d.q('[data-save]')?.addEventListener('click', async () => {
    const fm = d.q<HTMLFormElement>('[data-f]'); const v = (n: string) => (fm.elements.namedItem(n) as HTMLInputElement).value;
    const row: Row = { maid_id: v('maid_id') || null, employer_name: v('employer_name').trim(), employer_phone: v('employer_phone').trim(), employer_location: v('employer_location').trim(), package_category: v('package_category'), package_tier: v('package_tier'), stage: v('stage'), notes: v('notes') };
    for (const n of ['interview_date', 'booking_date', 'expected_arrival', 'arrival_date', 'placement_date', 'warranty_end']) row[n] = v(n) || null;
    if (!row.employer_name && !row.maid_id) return (d.q('[data-msg]').innerHTML = '<div class="err">Choose a maid or enter the employer name.</div>');
    if (['matched', 'interview', 'booked', 'processing', 'pending-arrival', 'placed'].includes(row.stage) && !row.maid_id) return (d.q('[data-msg]').innerHTML = '<div class="err">Choose the maid for this stage.</div>');
    const res = isNew ? await S.sb.from('placements').insert(row).select().single() : await S.sb.from('placements').update(row).eq('id', p.id).select().single();
    if (res.error) return (d.q('[data-msg]').innerHTML = `<div class="err">${esc(res.error.message)}</div>`);
    toast('Placement saved.'); d.close();
    if (isNew || res.data.stage !== p.stage) await offerStatus(res.data);
    o.onDone?.();
  });
}
export async function editPlacementById(id: string, onDone?: () => void) {
  const { data } = await S.sb.from('placements').select('*').eq('id', id).single(); if (data) openPlacementDialog({ placement: data, onDone });
}

export async function maidPlacementsHtml(m: Row) {
  const { data } = await S.sb.from('placements').select('*').eq('maid_id', m.id).order('created_at', { ascending: false });
  const rows = (data || []).map((p: Row) => `<tr data-act="pl-edit" data-id="${esc(p.id)}"><td>${esc(p.employer_name || '—')}</td><td>${esc(p.employer_location || '—')}</td><td>${stagePill(p.stage)}</td><td>${fmtDate(p.booking_date)}</td><td>${fmtDate(p.expected_arrival)}</td><td class="hint">${fmtDate(p.updated_at)}</td></tr>`).join('');
  return `<div class="actions-bar">${canEdit() ? '<button class="btn" type="button" data-act="new-placement">+ New placement</button>' : ''}</div>
    ${rows ? `<div class="tbl-wrap"><table class="tbl tbl--click"><tr><th>Employer</th><th>Location</th><th>Stage</th><th>Booking</th><th>Expected arrival</th><th>Updated</th></tr>${rows}</table></div>` : '<p class="hint">No placements for this maid yet.</p>'}`;
}

export async function renderPlacements() {
  await loadMaids(); await ensureThumbs(); await loadPlacements();
  setTitle('Applications & Placements', `${S.placements.length} records`);
  const counts = Object.fromEntries(STAGES.map(([k]) => [k, S.placements.filter((p) => p.stage === k).length]));
  const root = mount(`
    <div class="kpis kpis--sm">${STAGES.map(([k, l]) => `<button class="kpi kpi--btn" data-act="stage" data-stage="${k}" type="button"><b>${counts[k]}</b><span>${l}</span></button>`).join('')}</div>
    <div class="toolbar2"><div class="fld grow"><label>Search</label><input id="q" type="search" placeholder="Employer, maid or reference" value="${esc(F.q)}"></div>
      <div class="fld"><label>Stage</label><select id="stg"><option value="">All</option>${STAGES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
      <div class="fld"><label>Nationality</label><select id="nat"><option value="">All</option><option value="indonesian">Indonesian</option><option value="filipino">Filipino</option></select></div></div>
    <div class="actions-bar">${canEdit() ? '<button class="btn" data-act="new" type="button">+ New placement</button>' : ''}<span class="count" id="count"></span></div>
    <div class="card"><div class="tbl-wrap" id="tbl"></div></div><div id="pg"></div>`);
  (document.getElementById('stg') as HTMLSelectElement).value = F.stage; (document.getElementById('nat') as HTMLSelectElement).value = F.nat;
  const draw = () => {
    const q = F.q.trim().toLowerCase();
    const hits = S.placements.filter((p) => { const m = maidById(p.maid_id); return (!q || [p.employer_name, p.employer_location, m?.full_name, m?.code].some((x) => String(x || '').toLowerCase().includes(q))) && (!F.stage || p.stage === F.stage) && (!F.nat || m?.nationality === F.nat); });
    const pages = Math.max(1, Math.ceil(hits.length / 15)); F.page = Math.min(F.page, pages);
    document.getElementById('count')!.textContent = `${hits.length} placements`;
    document.getElementById('tbl')!.innerHTML = hits.length ? `<table class="tbl tbl--click"><tr><th>Maid</th><th>Employer</th><th>Package</th><th>Progress</th><th>Booking</th><th>Arrival</th><th>Updated</th></tr>${hits.slice((F.page - 1) * 15, F.page * 15).map((p) => { const m = maidById(p.maid_id); return `
      <tr data-act="edit" data-id="${esc(p.id)}"><td>${m ? `<div class="mini">${thumbHtml(m, 'thumb thumb--sm')}<div><div class="strong">${esc(nameOf(m))}</div><div class="hint">${esc(m.code)} · ${esc(natLabel(m.nationality))}</div></div></div>` : '<span class="hint">not chosen</span>'}</td>
      <td><div class="strong">${esc(p.employer_name || '—')}</div><div class="hint">${esc(p.employer_location || '')}</div></td><td>${esc(p.package_tier ? `${CATEGORY[p.package_category] || ''} ${p.package_tier}` : '—')}</td>
      <td>${stagePill(p.stage)}${progress(p.stage)}</td><td class="nw">${fmtDate(p.booking_date)}</td><td class="nw">${fmtDate(p.arrival_date || p.expected_arrival)}</td><td class="hint nw">${fmtDT(p.updated_at)}</td></tr>`; }).join('')}</table>` : '<p class="empty">No placements yet.</p>';
    document.getElementById('pg')!.innerHTML = pager(hits.length, F.page, 15);
  };
  draw();
  document.getElementById('q')!.addEventListener('input', (e) => { F.q = (e.target as HTMLInputElement).value; F.page = 1; draw(); });
  document.getElementById('stg')!.addEventListener('input', (e) => { F.stage = (e.target as HTMLSelectElement).value; F.page = 1; draw(); });
  document.getElementById('nat')!.addEventListener('input', (e) => { F.nat = (e.target as HTMLSelectElement).value; F.page = 1; draw(); });
  root.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-page]'); if (b && !(b as HTMLButtonElement).disabled) { F.page = Number(b.dataset.page); draw(); } });
  const refresh = () => renderPlacements();
  onClick(root, { new: () => openPlacementDialog({ onDone: refresh }), edit: (el) => editPlacementById(el.dataset.id!, refresh), stage: (el) => { F.stage = F.stage === el.dataset.stage ? '' : el.dataset.stage!; F.page = 1; (document.getElementById('stg') as HTMLSelectElement).value = F.stage; draw(); } });
}
