// Reports: simple, printable summaries. CSV export is administrator-only and recorded in the audit log.
import { S, esc, mount, setTitle, toast, isAdmin, loadMaids, fmtDate, fmtDT, natLabel, downloadCsv, logExport, historyTable, nameOf, maidById, type Row } from './core';
import { STATUSES, STATUS_LABEL } from '../mapping.js';
import { readiness } from './publication';
import { isStale, ageDays } from './availability';
import { loadPlacements, STAGES } from './placements';

interface Rep { id: string; title: string; note: string; build: () => Promise<{ head: string[]; rows: (string | number)[][] }> }
const yn = (b: unknown) => (b ? 'Yes' : 'No');
const REPORTS: Rep[] = [
  { id: 'summary', title: 'Maid register summary', note: 'Counts by nationality and availability.', build: async () => ({ head: ['Availability', 'Indonesian', 'Filipino', 'Total'],
    rows: [...STATUSES.map((s) => { const a = S.maids.filter((m) => m.status === s); return [STATUS_LABEL[s as keyof typeof STATUS_LABEL], a.filter((m) => m.nationality === 'indonesian').length, a.filter((m) => m.nationality === 'filipino').length, a.length]; }),
      ['All maids', S.maids.filter((m) => m.nationality === 'indonesian').length, S.maids.filter((m) => m.nationality === 'filipino').length, S.maids.length]] }) },
  { id: 'availability', title: 'Availability verification', note: 'Each maid’s status, when it was verified and by whom.', build: async () => ({ head: ['Ref', 'Name', 'Nationality', 'Availability', 'Verified', 'Verified on', 'Days ago', 'By', 'Needs re-verification'],
    rows: S.maids.map((m) => [m.code, nameOf(m), natLabel(m.nationality), STATUS_LABEL[m.status as keyof typeof STATUS_LABEL], yn(m.status_confirmed && m.status !== 'to-be-confirmed'), m.status_verified_at ? fmtDate(m.status_verified_at) : '—', ageDays(m.status_verified_at) ?? '—', m.status_set_by || '—', yn(isStale(m))]) }) },
  { id: 'publication', title: 'Publication & consent', note: 'Who is published, and what is still missing for the rest.', build: async () => ({ head: ['Ref', 'Name', 'Published', 'Consent on file', 'Consent date', 'Approver', 'Photo consent', 'Missing before publishing'],
    rows: S.maids.map((m) => [m.code, nameOf(m), yn(m.published), yn(m.consent_recorded), m.consent_date ? fmtDate(m.consent_date) : '—', m.approved_by || '—', yn(m.photo_consent), m.published ? '' : readiness(m).missing.join('; ')]) }) },
  { id: 'photos', title: 'Photo coverage', note: 'Which maids still need a photo.', build: async () => ({ head: ['Ref', 'Name', 'Nationality', 'Working photo', 'On website'],
    rows: S.maids.map((m) => [m.code, nameOf(m), natLabel(m.nationality), yn(m.photo_path), yn(m.public_photo_path)]) }) },
  { id: 'placements', title: 'Placements', note: 'Every placement with its stage and key dates.', build: async () => { const p = await loadPlacements(); return { head: ['Maid', 'Employer', 'Location', 'Package', 'Stage', 'Booking', 'Expected arrival', 'Arrival', 'Updated'],
    rows: p.map((x) => [maidById(x.maid_id) ? `${nameOf(maidById(x.maid_id)!)} (${maidById(x.maid_id)!.code})` : '—', x.employer_name || '—', x.employer_location || '—', x.package_tier ? `${x.package_category} ${x.package_tier}` : '—', STAGES.find(([k]) => k === x.stage)?.[1] || x.stage, fmtDate(x.booking_date), fmtDate(x.expected_arrival), fmtDate(x.arrival_date), fmtDT(x.updated_at)]) }; } },
  { id: 'activity', title: 'Staff activity (audit log)', note: 'Recent changes to placements, documents, staff accounts and exports. Biodata changes are in each maid’s history.', build: async () => { const { data } = await S.sb.from('audit_log').select('*').order('at', { ascending: false }).limit(300);
    return { head: ['When', 'Who', 'Area', 'Record', 'Action'], rows: (data || []).map((r: Row) => [fmtDT(r.at), r.actor_email || 'office script', r.table_name, r.label || r.record_id, r.action]) }; } },
];

export async function renderReports() {
  await loadMaids(); setTitle('Reports', 'Summaries you can print or export');
  let cur = REPORTS[0]; let table: Awaited<ReturnType<Rep['build']>> = { head: [], rows: [] };
  const root = mount(`<div class="toolbar2"><div class="fld grow"><label for="rep">Report</label><select id="rep">${REPORTS.map((r) => `<option value="${r.id}">${esc(r.title)}</option>`).join('')}</select></div>
      <div class="fld"><label>&nbsp;</label><div class="row-actions"><button class="btn btn--ghost" id="print" type="button">Print</button>${isAdmin() ? '<button class="btn" id="csv" type="button">Export CSV</button>' : '<span class="hint">CSV export: administrators only</span>'}</div></div></div>
    <p class="hint" id="note"></p><div class="card"><div class="tbl-wrap" id="out"></div></div>`);
  const show = async (id: string) => {
    cur = REPORTS.find((r) => r.id === id)!; document.getElementById('note')!.textContent = cur.note; document.getElementById('out')!.innerHTML = '<p class="hint pad">Loading…</p>';
    try { table = await cur.build(); } catch (e) { document.getElementById('out')!.innerHTML = `<div class="err">${esc((e as Error).message)}</div>`; return; }
    document.getElementById('out')!.innerHTML = table.rows.length ? `<table class="tbl"><tr>${table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="empty">Nothing to report yet.</p>';
  };
  document.getElementById('rep')!.addEventListener('change', (e) => show((e.target as HTMLSelectElement).value));
  document.getElementById('print')!.addEventListener('click', () => window.print());
  document.getElementById('csv')?.addEventListener('click', async () => {
    if (!table.rows.length) return toast('Nothing to export.', 'err');
    try { await logExport(`report: ${cur.title}`, table.rows.length); downloadCsv(`${cur.id}-${new Date().toISOString().slice(0, 10)}.csv`, table.rows.map((r) => Object.fromEntries(table.head.map((h, i) => [h, r[i]])))); toast(`${table.rows.length} rows exported (recorded in the audit log).`); } catch (e) { toast((e as Error).message, 'err'); }
  });
  await show(cur.id); void historyTable;
}
