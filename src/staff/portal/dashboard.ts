// Dashboard: the daily overview — counts, what needs attention, recent activity.
import { S, esc, mount, setTitle, canEdit, loadMaids, ensureThumbs, thumbHtml, statusPill, pill, fmtDT, natLabel, onClick, go, nameOf, maidById, type Row } from './core';
import { STATUSES, STATUS_LABEL } from '../mapping.js';
import { readiness } from './publication';
import { isStale } from './availability';
import { loadPlacements, STAGES } from './placements';

export async function renderDashboard() {
  await loadMaids(); await ensureThumbs();
  let placements: Row[] = []; try { placements = await loadPlacements(); } catch { /* optional */ }
  const hist = (await S.sb.from('maid_history').select('*').order('changed_at', { ascending: false }).limit(8)).data || [];
  setTitle('Dashboard', `Welcome, ${S.me.full_name || S.me.email}`);
  const M = S.maids; const n = (f: (m: Row) => boolean) => M.filter(f).length;
  const missingPhoto = M.filter((m) => !m.photo_path); const stale = M.filter(isStale); const tbc = M.filter((m) => m.status === 'to-be-confirmed');
  const waiting = M.filter((m) => !m.published && !readiness(m).ready); const ready = M.filter((m) => !m.published && readiness(m).ready);
  const open = placements.filter((p) => !['placed', 'cancelled'].includes(p.stage));
  const kpi = (v: number | string, label: string, href: string) => `<a class="kpi kpi--btn" href="${href}"><b>${v}</b><span>${label}</span></a>`;
  const list = (rows: Row[], extra: (m: Row) => string) => rows.length ? rows.slice(0, 6).map((m) => `<a class="mini mini--row" href="#/maid/${esc(m.code)}">${thumbHtml(m, 'thumb thumb--sm')}<div><div class="strong">${esc(nameOf(m))}</div><div class="hint">${esc(m.code)} · ${extra(m)}</div></div></a>`).join('') + (rows.length > 6 ? `<p class="hint">+ ${rows.length - 6} more</p>` : '') : '<p class="hint">Nothing to do here. ✓</p>';
  const root = mount(`
    <div class="kpis">${kpi(M.length, 'Total maids', '#/maids')}${kpi(n((m) => m.nationality === 'indonesian'), 'Indonesian', '#/maids')}${kpi(n((m) => m.nationality === 'filipino'), 'Filipino', '#/maids')}
      ${kpi(n((m) => m.status === 'available' && m.status_confirmed), 'Available (verified)', '#/availability')}${kpi(tbc.length, 'To Be Confirmed', '#/availability')}${kpi(M.filter((m) => m.published).length, 'On website', '#/approvals')}
      ${kpi(missingPhoto.length, 'Missing photo', '#/photos')}${kpi(open.length, 'Open placements', '#/placements')}</div>
    <div class="dash2">
      <div class="card pad"><h3 class="sec">Availability</h3><div class="bars">${STATUSES.map((s) => { const c = n((m) => m.status === s); return `<a class="barrow" href="#/availability"><span>${STATUS_LABEL[s as keyof typeof STATUS_LABEL]}</span><i style="width:${M.length ? Math.max(c ? 3 : 0, (c / M.length) * 100) : 0}%"></i><b>${c}</b></a>`; }).join('')}</div></div>
      <div class="card pad"><h3 class="sec">Placement pipeline</h3><div class="bars">${STAGES.map(([k, l]) => { const c = placements.filter((p) => p.stage === k).length; return `<a class="barrow" href="#/placements"><span>${l}</span><i style="width:${placements.length ? Math.max(c ? 3 : 0, (c / placements.length) * 100) : 0}%"></i><b>${c}</b></a>`; }).join('')}</div></div>
      <div class="card pad"><h3 class="sec">Needs attention</h3><h4>Availability to verify (${tbc.length + stale.length})</h4>${list([...tbc, ...stale], (m) => (m.status === 'to-be-confirmed' ? 'not verified yet' : 'verification is over 30 days old'))}</div>
      <div class="card pad"><h3 class="sec">Missing photos (${missingPhoto.length})</h3>${list(missingPhoto, (m) => natLabel(m.nationality))}${canEdit() && missingPhoto.length ? '<a class="btn btn--ghost btn--sm" href="#/photos">Open Photo Management</a>' : ''}</div>
      <div class="card pad"><h3 class="sec">Publication</h3><p><b>${ready.length}</b> ready to publish · <b>${waiting.length}</b> waiting for consent or checks · <b>${M.filter((m) => m.published).length}</b> published.</p><a class="btn btn--ghost btn--sm" href="#/approvals">Open Publication Approvals</a></div>
      <div class="card pad"><h3 class="sec">Recent changes</h3>${hist.length ? hist.map((h: Row) => { const m = maidById(h.maid_id); return `<div class="act"><span class="hint">${fmtDT(h.changed_at)}</span><div><b>${esc(m ? nameOf(m) : h.code)}</b> — ${esc(h.action)} by ${esc(h.changed_by_email || 'office script')}</div></div>`; }).join('') : '<p class="hint">No changes yet.</p>'}</div>
    </div>
    <div class="quick"><a class="btn" href="#/maids">All Maid Biodata</a>${canEdit() ? '<a class="btn" href="#/add">+ Add New Maid</a><a class="btn btn--ghost" href="#/photos">Photos</a>' : ''}<a class="btn btn--ghost" href="#/reports">Reports</a></div>`);
  onClick(root, {}); void go;
}
