// Availability Tracking: who is Available / On Hold / Booked / Pending Arrival / Hired / Withdrawn / To Be Confirmed,
// when staff last verified it and who did. Choosing any status other than "To Be Confirmed" records a verification.
import { S, esc, mount, setTitle, toast, ask, canEdit, loadMaids, ensureThumbs, thumbHtml, statusPill, pill, pager, fmtDT, fmtDate, natLabel, onClick, myName, replaceMaid, maidById, nameOf, type Row } from './core';
import { STATUSES, STATUS_LABEL, HIDDEN } from '../mapping.js';

const F = { q: '', status: '', nat: '', stale: false, page: 1 };
const SIZE = 25;
export const STALE_DAYS = 30;
export const ageDays = (d?: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 864e5) : null);
export const isStale = (m: Row) => m.status !== 'to-be-confirmed' && !HIDDEN.includes(m.status) && (!m.status_confirmed || (ageDays(m.status_verified_at) ?? 999) > STALE_DAYS);
const sel = new Set<string>();

async function apply(ids: string[], status: string, reverify = false): Promise<boolean> {
  const rows = ids.map(maidById).filter(Boolean) as Row[]; if (!rows.length) return false;
  const label = STATUS_LABEL[status as keyof typeof STATUS_LABEL];
  const hides = rows.filter((m) => m.published && HIDDEN.includes(status));
  if (hides.length && !(await ask(`${hides.length} published profile(s) will leave the website listings because "${label}" maids are not shown.`, { ok: 'Continue' }))) return false;
  if (rows.length > 1 && !(await ask(`Set ${rows.length} maids to "${label}"?`, { ok: 'Apply' }))) return false;
  const confirmed = status !== 'to-be-confirmed'; let n = 0;
  for (const m of rows) {
    const patch: Row = { status, status_confirmed: confirmed, status_set_by: confirmed ? myName() : m.status_set_by };
    if (reverify && confirmed) patch.status_verified_at = new Date().toISOString();
    const { data, error } = await S.sb.from('maids').update(patch).eq('id', m.id).select().single();
    if (error) { toast(`${nameOf(m)}: ${error.message}`, 'err'); break; } replaceMaid(data); n++;
  }
  if (n) toast(`${n} maid(s) set to ${label}${reverify ? ' (re-verified)' : ''}.`);
  return n > 0;
}

export async function renderAvailability() {
  await loadMaids(); await ensureThumbs();
  setTitle('Availability Tracking', 'Verify and update who can be placed');
  const ed = canEdit();
  const root = mount(`
    <div class="kpis kpis--sm">${STATUSES.map((s) => `<button class="kpi kpi--btn" data-act="kpi" data-s="${s}" type="button"><b>${S.maids.filter((m) => m.status === s).length}</b><span>${STATUS_LABEL[s as keyof typeof STATUS_LABEL]}</span></button>`).join('')}</div>
    <div class="note">The website shows a status only after staff have <b>verified</b> it (any status except To Be Confirmed). Hired and Withdrawn maids are not listed on the website. Statuses older than ${STALE_DAYS} days are flagged for re-verification.</div>
    <div class="toolbar2"><div class="fld grow"><label>Search</label><input id="q" type="search" placeholder="Name or reference code" value="${esc(F.q)}"></div>
      <div class="fld"><label>Availability</label><select id="st"><option value="">All</option>${STATUSES.map((s) => `<option value="${s}">${STATUS_LABEL[s as keyof typeof STATUS_LABEL]}</option>`).join('')}</select></div>
      <div class="fld"><label>Nationality</label><select id="nat"><option value="">All</option><option value="indonesian">Indonesian</option><option value="filipino">Filipino</option></select></div>
      <label class="check"><input id="stale" type="checkbox" ${F.stale ? 'checked' : ''}> Needs re-verification</label></div>
    ${ed ? `<div class="actions-bar bulk"><span>With selected (<b id="nsel">0</b>):</span><select id="bulk">${STATUSES.map((s) => `<option value="${s}">${STATUS_LABEL[s as keyof typeof STATUS_LABEL]}</option>`).join('')}</select><button class="btn btn--sm" data-act="bulk" type="button">Set status</button><button class="btn btn--ghost btn--sm" data-act="bulk-re" type="button">Re-verify as is</button></div>` : ''}
    <span class="count" id="count"></span><div class="card"><div class="tbl-wrap" id="tbl"></div></div><div id="pg"></div>`);
  (document.getElementById('st') as HTMLSelectElement).value = F.status; (document.getElementById('nat') as HTMLSelectElement).value = F.nat;
  const draw = () => {
    const q = F.q.trim().toLowerCase();
    const hits = S.maids.filter((m) => (!q || m.code.toLowerCase().includes(q) || (m.full_name || '').toLowerCase().includes(q)) && (!F.status || m.status === F.status) && (!F.nat || m.nationality === F.nat) && (!F.stale || isStale(m)));
    const pages = Math.max(1, Math.ceil(hits.length / SIZE)); F.page = Math.min(F.page, pages);
    document.getElementById('count')!.textContent = `${hits.length} of ${S.maids.length} maids`;
    document.getElementById('tbl')!.innerHTML = hits.length ? `<table class="tbl"><tr>${ed ? '<th><input type="checkbox" data-act="all" aria-label="Select all on this page"></th>' : ''}<th></th><th>Maid</th><th>Availability</th><th>Verification</th>${ed ? '<th>Change</th>' : ''}</tr>${hits.slice((F.page - 1) * SIZE, F.page * SIZE).map((m) => {
      const age = ageDays(m.status_verified_at); const ok = m.status_confirmed && m.status !== 'to-be-confirmed';
      return `<tr>${ed ? `<td><input type="checkbox" data-sel="${esc(m.id)}" ${sel.has(m.id) ? 'checked' : ''} aria-label="Select ${esc(nameOf(m))}"></td>` : ''}<td>${thumbHtml(m, 'thumb thumb--sm')}</td>
      <td><a class="strong" href="#/maid/${esc(m.code)}">${esc(nameOf(m))}</a><div class="hint">${esc(m.code)} · ${esc(natLabel(m.nationality))}${m.published ? ' · on website' : ''}</div></td><td>${statusPill(m.status)}</td>
      <td>${ok ? `${pill('Verified', isStale(m) ? 'warn' : 'ok')} <span class="hint">${fmtDate(m.status_verified_at)} (${age}d ago) · ${esc(m.status_set_by || '—')}</span>` : `${pill('Not verified', 'tbc')} <span class="hint">${m.status_set_by ? 'initial: ' + esc(m.status_set_by) : ''}</span>`}</td>
      ${ed ? `<td class="nw"><select data-row="${esc(m.id)}" aria-label="New status">${STATUSES.map((s) => `<option value="${s}"${s === m.status ? ' selected' : ''}>${STATUS_LABEL[s as keyof typeof STATUS_LABEL]}</option>`).join('')}</select> <button class="btn btn--sm" data-act="set" data-id="${esc(m.id)}" type="button">Save</button>${ok ? ` <button class="btn btn--ghost btn--sm" data-act="re" data-id="${esc(m.id)}" type="button" title="Confirm the status is still correct today">Re-verify</button>` : ''}</td>` : ''}</tr>`; }).join('')}</table>` : '<p class="empty">Nothing matches.</p>';
    document.getElementById('pg')!.innerHTML = pager(hits.length, F.page, SIZE); const n = document.getElementById('nsel'); if (n) n.textContent = String(sel.size);
  };
  draw();
  const bind = (id: string, key: string, box = false) => document.getElementById(id)!.addEventListener('input', (e) => { (F as any)[key] = box ? (e.target as HTMLInputElement).checked : (e.target as HTMLInputElement).value; F.page = 1; draw(); });
  bind('q', 'q'); bind('st', 'status'); bind('nat', 'nat'); bind('stale', 'stale', true);
  root.addEventListener('change', (e) => { const t = e.target as HTMLInputElement; if (t.dataset.sel) { t.checked ? sel.add(t.dataset.sel) : sel.delete(t.dataset.sel); document.getElementById('nsel')!.textContent = String(sel.size); } });
  root.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-page]'); if (b && !(b as HTMLButtonElement).disabled) { F.page = Number(b.dataset.page); draw(); } });
  const rowStatus = (id: string) => (root.querySelector(`[data-row="${id}"]`) as HTMLSelectElement).value;
  onClick(root, {
    kpi: (b) => { F.status = F.status === b.dataset.s ? '' : b.dataset.s!; F.page = 1; (document.getElementById('st') as HTMLSelectElement).value = F.status; draw(); },
    set: async (b) => { if (await apply([b.dataset.id!], rowStatus(b.dataset.id!))) renderAvailability(); },
    re: async (b) => { const m = maidById(b.dataset.id!)!; if (await apply([m.id], m.status, true)) renderAvailability(); },
    all: (b) => { root.querySelectorAll<HTMLInputElement>('[data-sel]').forEach((c) => { c.checked = (b as HTMLInputElement).checked; (b as HTMLInputElement).checked ? sel.add(c.dataset.sel!) : sel.delete(c.dataset.sel!); }); document.getElementById('nsel')!.textContent = String(sel.size); },
    bulk: async () => { if (!sel.size) return toast('Tick at least one maid first.', 'err'); if (await apply([...sel], (document.getElementById('bulk') as HTMLSelectElement).value)) { sel.clear(); renderAvailability(); } },
    'bulk-re': async () => { if (!sel.size) return toast('Tick at least one maid first.', 'err'); const rows = [...sel].map(maidById).filter((m) => m && m.status_confirmed && m.status !== 'to-be-confirmed') as Row[]; if (!rows.length) return toast('None of the selected maids has a verified status.', 'err'); let n = 0; for (const m of rows) { if (await apply([m.id], m.status, true)) n++; } if (n) { sel.clear(); renderAvailability(); } },
  });
}
