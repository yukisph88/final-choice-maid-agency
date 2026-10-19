// Overview: live counts from the database, recent updates, pending tasks, quick actions, nationality breakdown.
import { S, esc, mount, setTitle, canEdit, loadMaids, ensureThumbs, thumbHtml, pill, fmtDT, natLabel, nameOf, maidById, type Row } from './core';
import { STATUSES, STATUS_LABEL } from '../mapping.js';
import { readiness } from './publication';
import { isStale } from './availability';
import { loadPlacements, STAGES } from './placements';

export async function renderDashboard() {
  await loadMaids(); await ensureThumbs();
  let placements: Row[] = []; try { placements = await loadPlacements(); } catch { /* optional */ }
  const hist = (await S.sb.from('maid_history').select('*').order('changed_at', { ascending: false }).limit(10)).data || [];
  setTitle('Overview', `Welcome, ${S.me.full_name || S.me.email}`);
  const M = S.maids; const n = (f: (m: Row) => boolean) => M.filter(f).length;
  const ind = n((m) => m.nationality === 'indonesian'); const fil = n((m) => m.nationality === 'filipino'); const pub = n((m) => m.published);
  const missingPhoto = M.filter((m) => !m.photo_path); const verify = M.filter((m) => m.status === 'to-be-confirmed' || isStale(m));
  const incomplete = M.filter((m) => !m.full_name || m.experience_years == null || !(m.employment_history || []).length || !(m.summary_en || '').trim());
  const waiting = M.filter((m) => !m.published && !readiness(m).ready); const ready = M.filter((m) => !m.published && readiness(m).ready);
  const open = placements.filter((p) => !['placed', 'cancelled'].includes(p.stage));
  const kpi = (v: number | string, label: string, href: string, sub = '') => `<a class="kpi kpi--btn" href="${href}"><b>${v}</b><span>${label}</span>${sub ? `<small class="hint">${sub}</small>` : ''}</a>`;
  const list = (rows: Row[], extra: (m: Row) => string) => rows.length ? rows.slice(0, 5).map((m) => `<a class="mini mini--row" href="#/maid/${esc(m.code)}">${thumbHtml(m, 'thumb thumb--sm')}<div><div class="strong">${esc(nameOf(m))}</div><div class="hint">${esc(m.code)} · ${extra(m)}</div></div></a>`).join('') + (rows.length > 5 ? `<p class="hint">+ ${rows.length - 5} more</p>` : '') : '<p class="hint">Nothing to do here. ✓</p>';
  const what = (h: Row) => { const c = (h.changes || {}) as Row; if (h.action === 'insert') return 'record added'; if (h.action === 'delete') return 'record deleted'; const keys = Object.keys(c); if (keys.includes('photo_path')) return 'photograph changed'; if (keys.includes('status')) return `availability → ${STATUS_LABEL[c.status?.to as keyof typeof STATUS_LABEL] || c.status?.to}`; if (keys.includes('published')) return c.published?.to ? 'published' : 'unpublished'; return keys.length ? `${keys.length} field${keys.length > 1 ? 's' : ''} edited` : 'updated'; };
  const root = mount(`
    <div class="kpis">${kpi(M.length, 'Total Maids', '#/maids')}${kpi(ind, 'Indonesian Maids', '#/maids')}${kpi(fil, 'Filipino Maids', '#/maids')}
      ${STATUSES.filter((s) => s !== 'withdrawn').map((s) => kpi(n((m) => m.status === s), STATUS_LABEL[s as keyof typeof STATUS_LABEL], '#/availability')).join('')}
      ${kpi(`${pub} / ${M.length - pub}`, 'Published / Unpublished', '#/approvals')}${kpi(open.length, 'Open placements', '#/placements')}</div>
    <div class="dash2">
      <div class="card pad"><h3 class="sec">Pending tasks</h3>
        <h4>Missing photographs (${missingPhoto.length})</h4>${list(missingPhoto, (m) => natLabel(m.nationality))}
        <h4>Status to verify (${verify.length})</h4>${list(verify, (m) => (m.status === 'to-be-confirmed' ? 'not verified yet' : 'verification over 30 days old'))}
        <h4>Incomplete biodata (${incomplete.length})</h4>${list(incomplete, () => 'name, experience, work history or summary missing')}
        <h4>Publication approvals (${waiting.length + ready.length})</h4><p class="hint"><b>${ready.length}</b> ready to publish · <b>${waiting.length}</b> waiting for consent or checks</p></div>
      <div class="card pad"><h3 class="sec">Recent maid updates</h3>${hist.length ? hist.map((h: Row) => { const m = maidById(h.maid_id); return `<a class="act" href="#/maid/${esc(m?.code || h.code)}" style="text-decoration:none;color:inherit"><span class="hint">${fmtDT(h.changed_at)}</span><div><b>${esc(m ? nameOf(m) : h.code)}</b> — ${esc(what(h))} <span class="hint">by ${esc(h.changed_by_email || 'office script')}</span></div></a>`; }).join('') : '<p class="hint">No updates yet.</p>'}</div>
      <div class="card pad"><h3 class="sec">Nationality breakdown</h3><div class="nat2">
        <div class="natbar" title="Indonesian ${ind}, Filipino ${fil}"><i style="width:${M.length ? (ind / M.length) * 100 : 0}%;background:#1f3a93"></i><i style="width:${M.length ? (fil / M.length) * 100 : 0}%;background:#2563eb"></i></div>
        <div class="barrow"><span><span class="dot" style="background:#1f3a93"></span> Indonesian</span><i style="width:0"></i><b>${ind}</b></div><div class="barrow"><span><span class="dot" style="background:#2563eb"></span> Filipino</span><i style="width:0"></i><b>${fil}</b></div></div>
        <h3 class="sec">Availability</h3><div class="bars">${STATUSES.map((s) => { const c = n((m) => m.status === s); return `<a class="barrow" href="#/availability"><span>${STATUS_LABEL[s as keyof typeof STATUS_LABEL]}</span><i style="width:${M.length ? Math.max(c ? 3 : 0, (c / M.length) * 100) : 0}%"></i><b>${c}</b></a>`; }).join('')}</div></div>
      <div class="card pad"><h3 class="sec">Quick actions</h3><div class="qa">${canEdit() ? '<a class="btn" href="#/add">+ Add New Maid</a>' : ''}<a class="btn btn--ghost" href="#/maids">View All Maids</a>${canEdit() ? '<a class="btn btn--ghost" href="#/photos">Upload Maid Photo</a><a class="btn btn--ghost" href="#/availability">Update Availability</a>' : ''}<a class="btn btn--ghost" href="#/reports">Reports</a></div>
        <h3 class="sec">Placement pipeline</h3><div class="bars">${STAGES.map(([k, l]) => { const c = placements.filter((p) => p.stage === k).length; return `<a class="barrow" href="#/placements"><span>${l}</span><i style="width:${placements.length ? Math.max(c ? 3 : 0, (c / placements.length) * 100) : 0}%"></i><b>${c}</b></a>`; }).join('')}</div></div>
    </div>`);
  void root; void pill;
}
