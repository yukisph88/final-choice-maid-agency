// Publication Approvals: the only place (besides the maid's own "Public profile & approval" tab) where a maid becomes public.
// Administrators record consent and publish; everyone else can see the state. The database refuses to publish without
// written consent, consent date, approver initials and resolved discrepancies.
import { S, esc, mount, setTitle, toast, ask, isAdmin, loadMaids, ensureThumbs, thumbHtml, statusPill, pill, pager, fmtDate, natLabel, onClick, nameOf, maidById, replaceMaid, myName, dialog, type Row } from './core';
import { readiness, syncPublicPhoto, unpublish, previewDialog, publicName } from './publication';
import { HIDDEN } from '../mapping.js';

const F = { q: '', show: 'notready', nat: '', page: 1 };
const SIZE = 20;
const tick = (b: boolean) => (b ? '<span class="yes">✓</span>' : '<span class="no">—</span>');

function approveDialog(m: Row, done: () => void) {
  const admin = isAdmin(); const dis = admin ? '' : 'disabled';
  const d = dialog({ title: `Approval — ${nameOf(m)} (${m.code})`, wide: true, body: `<form data-f autocomplete="off">
    ${admin ? '' : '<div class="note">Only administrators can record consent and publish.</div>'}
    <div class="note">Record only what the signed candidate consent form says. Nothing is inferred. Publishing shows the profile (and photo, if authorised) on the public website.</div>
    <div class="g3">
      <label class="check"><input type="checkbox" name="consent_recorded" ${m.consent_recorded ? 'checked' : ''} ${dis}> Written publication consent on file</label>
      <div class="fld"><label>Consent date</label><input type="date" name="consent_date" value="${esc(m.consent_date || '')}" ${dis}></div>
      <div class="fld"><label>Approved by (initials)</label><input name="approved_by" maxlength="10" value="${esc(m.approved_by || '')}" ${dis}></div>
      <label class="check"><input type="checkbox" name="photo_consent" ${m.photo_consent ? 'checked' : ''} ${dis}> Photo may be shown</label>
      <div class="fld"><label>Name shown</label><select name="name_consent" ${dis}>${[['none', 'None — reference code only'], ['first', 'First name only'], ['full', 'Full name']].map(([k, l]) => `<option value="${k}"${k === m.name_consent ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <label class="check"><input type="checkbox" name="discrepancies_resolved" ${m.discrepancies_resolved ? 'checked' : ''} ${dis}> Biodata discrepancies resolved</label>
      <label class="check"><input type="checkbox" name="show_age" ${m.show_age ? 'checked' : ''} ${dis}> Show age</label>
      <label class="check"><input type="checkbox" name="show_religion" ${m.show_religion ? 'checked' : ''} ${dis}> Show religion (explicit consent)</label>
      <label class="check"><input type="checkbox" name="featured" ${m.featured ? 'checked' : ''} ${dis}> Feature on homepage</label></div>
    ${m.discrepancy_notes ? `<div class="note"><b>Discrepancies noted:</b> ${esc(m.discrepancy_notes)}</div>` : ''}
    <p class="hint" data-ready></p><div data-msg></div></form>`,
    foot: `<button class="btn btn--ghost" data-prev type="button">Preview public version</button><span style="flex:1"></span><button class="btn btn--ghost" data-no type="button">Close</button>${admin ? `<button class="btn btn--ghost" data-save type="button">Save approval</button>${m.published ? '<button class="btn btn--danger" data-unpub type="button">Remove from website</button>' : '<button class="btn" data-pub type="button">Save and publish</button>'}` : ''}` });
  const fm = d.q<HTMLFormElement>('[data-f]'); const el = (n: string) => fm.elements.namedItem(n) as HTMLInputElement;
  const collect = (): Row => ({ consent_recorded: el('consent_recorded').checked, consent_date: el('consent_date').value || null, approved_by: el('approved_by').value.trim(), photo_consent: el('photo_consent').checked,
    name_consent: el('name_consent').value, discrepancies_resolved: el('discrepancies_resolved').checked, show_age: el('show_age').checked, show_religion: el('show_religion').checked, featured: el('featured').checked });
  const hint = () => { const r = readiness({ ...m, ...collect() }); d.q('[data-ready]').innerHTML = m.published ? 'Currently published.' : r.ready ? '<b>Ready to publish.</b>' : `Not ready: ${esc(r.missing.join(', '))}.`; };
  fm.addEventListener('input', hint); fm.addEventListener('change', hint); hint();
  d.q('[data-no]').addEventListener('click', () => d.close());
  d.q('[data-prev]').addEventListener('click', () => previewDialog({ ...m, ...collect() }));
  const save = async (extra: Row = {}) => {
    const changes = { ...collect(), ...extra };
    const { data, error } = await S.sb.from('maids').update(changes).eq('id', m.id).select().single();
    if (error) { d.q('[data-msg]').innerHTML = `<div class="err">Not saved: ${esc(/publish_requires_consent/.test(error.message) ? 'publishing needs written consent, the consent date, approver initials and "discrepancies resolved"' : error.message)}</div>`; return null; }
    return data as Row;
  };
  d.q('[data-save]')?.addEventListener('click', async () => { let s = await save(); if (!s) return; try { s = await syncPublicPhoto(s); } catch (e) { toast((e as Error).message, 'err'); } replaceMaid(s); toast('Approval saved.'); d.close(); done(); });
  d.q('[data-pub]')?.addEventListener('click', async () => {
    const r = readiness({ ...m, ...collect() }); if (!r.ready) return (d.q('[data-msg]').innerHTML = `<div class="err">Cannot publish yet: ${esc(r.missing.join(', '))}.</div>`);
    if (!(await ask(`Publish ${nameOf(m)} (${m.code}) on the public website${el('photo_consent').checked ? ' with photo' : ' without photo'}?\nName shown: ${publicName({ ...m, ...collect() }) || 'reference code only'}.`, { ok: 'Publish' }))) return;
    let s = await save({ published: true, approved_by: el('approved_by').value.trim() || myName() }); if (!s) return;
    try { s = await syncPublicPhoto(s); } catch (e) { toast(`Published, but the photo copy failed: ${(e as Error).message}`, 'err'); }
    replaceMaid(s); toast(`${nameOf(s)} is published. The website text updates at the next site rebuild (daily, or when the build is started).`); d.close(); done();
  });
  d.q('[data-unpub]')?.addEventListener('click', async () => {
    if (!(await ask(`Remove ${nameOf(m)} from the website? Her listing and photo are taken down.`, { ok: 'Remove from website', danger: true }))) return;
    try { replaceMaid(await unpublish(m)); toast('Removed from the website.'); d.close(); done(); } catch (e) { toast((e as Error).message, 'err'); }
  });
}

export async function renderApprovals() {
  await loadMaids(); await ensureThumbs();
  setTitle('Publication Approvals', 'Consent and publication control');
  const all = S.maids; const pub = all.filter((m) => m.published).length; const ready = all.filter((m) => !m.published && readiness(m).ready).length;
  const root = mount(`
    <div class="kpis kpis--sm"><button class="kpi kpi--btn" data-act="show" data-v="pub" type="button"><b>${pub}</b><span>Published</span></button><button class="kpi kpi--btn" data-act="show" data-v="ready" type="button"><b>${ready}</b><span>Ready to publish</span></button>
      <button class="kpi kpi--btn" data-act="show" data-v="notready" type="button"><b>${all.length - pub - ready}</b><span>Waiting for consent / checks</span></button><button class="kpi kpi--btn" data-act="show" data-v="" type="button"><b>${all.length}</b><span>All maids</span></button></div>
    <div class="note">Every maid is <b>private</b> until an administrator has recorded the candidate's written consent and publishes. Unpublished maids never appear on the website. ${isAdmin() ? '' : 'You can view this list; only administrators can approve and publish.'}</div>
    <div class="toolbar2"><div class="fld grow"><label>Search</label><input id="q" type="search" placeholder="Name or reference code" value="${esc(F.q)}"></div>
      <div class="fld"><label>Show</label><select id="show"><option value="">All</option><option value="notready">Waiting for consent / checks</option><option value="ready">Ready to publish</option><option value="pub">Published</option></select></div>
      <div class="fld"><label>Nationality</label><select id="nat"><option value="">All</option><option value="indonesian">Indonesian</option><option value="filipino">Filipino</option></select></div></div>
    <span class="count" id="count"></span><div class="card"><div class="tbl-wrap" id="tbl"></div></div><div id="pg"></div>`);
  (document.getElementById('show') as HTMLSelectElement).value = F.show; (document.getElementById('nat') as HTMLSelectElement).value = F.nat;
  const draw = () => {
    const q = F.q.trim().toLowerCase();
    const hits = all.filter((m) => (!q || m.code.toLowerCase().includes(q) || (m.full_name || '').toLowerCase().includes(q)) && (!F.nat || m.nationality === F.nat)
      && (F.show === '' || (F.show === 'pub' ? m.published : F.show === 'ready' ? !m.published && readiness(m).ready : !m.published && !readiness(m).ready)));
    const pages = Math.max(1, Math.ceil(hits.length / SIZE)); F.page = Math.min(F.page, pages);
    document.getElementById('count')!.textContent = `${hits.length} maids`;
    document.getElementById('tbl')!.innerHTML = hits.length ? `<table class="tbl"><tr><th></th><th>Maid</th><th>Consent</th><th>Consent date</th><th>Approver</th><th>Photo OK</th><th>Name shown</th><th>Checks</th><th>Status</th><th></th></tr>${hits.slice((F.page - 1) * SIZE, F.page * SIZE).map((m) => {
      const r = readiness(m);
      return `<tr><td>${thumbHtml(m, 'thumb thumb--sm')}</td><td><a class="strong" href="#/maid/${esc(m.code)}">${esc(nameOf(m))}</a><div class="hint">${esc(m.code)} · ${esc(natLabel(m.nationality))} · ${statusPill(m.status)}</div></td>
      <td>${tick(m.consent_recorded)}</td><td class="nw">${fmtDate(m.consent_date)}</td><td>${esc(m.approved_by || '—')}</td><td>${tick(m.photo_consent)}</td><td>${esc({ none: 'Code only', first: 'First', full: 'Full' }[m.name_consent as string] || '—')}</td>
      <td>${m.published ? pill('Published', 'ok') : r.ready ? pill('Ready', 'blue') : `<span class="hint" title="${esc(r.missing.join(', '))}">${esc(r.missing.slice(0, 2).join(', '))}${r.missing.length > 2 ? '…' : ''}</span>`}</td><td>${HIDDEN.includes(m.status) ? pill('Not listed', 'grey') : ''}</td>
      <td class="nw"><button class="btn btn--sm${isAdmin() ? '' : ' btn--ghost'}" data-act="open" data-id="${esc(m.id)}" type="button">${isAdmin() ? 'Review' : 'View'}</button></td></tr>`; }).join('')}</table>` : '<p class="empty">No maids in this list.</p>';
    document.getElementById('pg')!.innerHTML = pager(hits.length, F.page, SIZE);
  };
  draw();
  for (const [id, k] of [['q', 'q'], ['show', 'show'], ['nat', 'nat']] as const) document.getElementById(id)!.addEventListener('input', (e) => { (F as any)[k] = (e.target as HTMLInputElement).value; F.page = 1; draw(); });
  root.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-page]'); if (b && !(b as HTMLButtonElement).disabled) { F.page = Number(b.dataset.page); draw(); } });
  onClick(root, { show: (b) => { F.show = b.dataset.v!; F.page = 1; (document.getElementById('show') as HTMLSelectElement).value = F.show; draw(); }, open: (b) => approveDialog(maidById(b.dataset.id!)!, renderApprovals) });
}
