// Documents: secure internal files with access levels. Files live in a PRIVATE bucket; the database decides who may read them.
//   administrators only · administrators + editors · all staff.   Identity and medical documents are administrator-only by rule.
import { S, esc, mount, setTitle, toast, ask, canEdit, isAdmin, loadMaids, maidById, nameOf, pill, fmtDate, fmtDT, onClick, dialog, pickFile, DOCS, type Row } from './core';

const KINDS: [string, string][] = [['biodata-pdf', 'Biodata PDF'], ['consent-form', 'Consent form'], ['contract', 'Contract / agreement'], ['id-document', 'Identity document (admin only)'], ['medical', 'Medical report (admin only)'], ['other', 'Other']];
const KIND_LABEL = Object.fromEntries(KINDS) as Record<string, string>;
const LEVELS: [string, string][] = [['admin', 'Administrators only'], ['editor', 'Administrators and editors'], ['staff', 'All staff (read-only for viewers)']];
const LEVEL_PILL: Record<string, string> = { admin: 'red', editor: 'warn', staff: 'ok' };
const F = { q: '', kind: '', level: '' };
const MAX = 10 * 1048576;

async function loadDocuments(extra?: { maid_id?: string }) {
  let q = S.sb.from('documents').select('*').order('created_at', { ascending: false });
  if (extra?.maid_id) q = q.eq('maid_id', extra.maid_id);
  const { data, error } = await q; if (error) throw new Error(error.message);
  return data as Row[];
}
const rowHtml = (d: Row, showMaid: boolean) => { const m = maidById(d.maid_id); return `<tr><td><div class="strong">${esc(d.title)}</div><div class="hint">${esc(KIND_LABEL[d.kind] || d.kind)} · ${(d.size_bytes / 1024).toFixed(0)} KB</div></td>
  ${showMaid ? `<td>${m ? `<a href="#/maid/${esc(m.code)}">${esc(nameOf(m))}</a><div class="hint">${esc(m.code)}</div>` : '<span class="hint">general</span>'}</td>` : ''}
  <td>${pill(LEVELS.find(([k]) => k === d.access_level)?.[1] || d.access_level, LEVEL_PILL[d.access_level] || 'grey')}</td><td class="hint nw">${fmtDT(d.created_at)}<br>${esc(d.uploaded_by_email || '')}</td>
  <td class="nw"><button class="btn btn--ghost btn--sm" data-act="doc-open" data-id="${esc(d.id)}" type="button">Open</button>${isAdmin() ? ` <button class="btn btn--danger btn--sm" data-act="doc-del" data-id="${esc(d.id)}" type="button">Delete</button>` : ''}</td></tr>`; };

export async function maidDocumentsHtml(m: Row) {
  let docs: Row[] = []; try { docs = await loadDocuments({ maid_id: m.id }); } catch { /* none visible */ }
  return `<div class="actions-bar">${canEdit() ? '<button class="btn" type="button" data-act="new-doc">+ Add a document</button>' : ''}</div>
    ${docs.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Document</th><th>Access</th><th>Added</th><th></th></tr>${docs.map((d) => rowHtml(d, false)).join('')}</table></div>` : '<p class="hint">No documents you may see for this maid.</p>'}
    <p class="hint">Documents are private. Access levels are enforced by the database.</p>`;
}

export async function openDocument(id: string) {
  const { data: d } = await S.sb.from('documents').select('storage_path').eq('id', id).single();
  if (!d) return toast('You do not have access to that document.', 'err');
  const { data, error } = await S.sb.storage.from(DOCS).createSignedUrl(d.storage_path, 60);
  if (error || !data?.signedUrl) return toast(`Could not open the file: ${error?.message || 'no access'}`, 'err');
  window.open(data.signedUrl, '_blank', 'noopener');
}
export async function deleteDocument(id: string, done?: () => void) {
  const { data: d } = await S.sb.from('documents').select('id, title, storage_path').eq('id', id).single(); if (!d) return;
  if (!(await ask(`Delete the document "${d.title}" permanently? The deletion is recorded in the audit log.`, { ok: 'Delete document', danger: true }))) return;
  const r = await S.sb.from('documents').delete().eq('id', id); if (r.error) return toast(r.error.message, 'err');
  await S.sb.storage.from(DOCS).remove([d.storage_path]); toast('Document deleted.'); done?.();
}

export function openUploadDialog(o: { maid?: Row; onDone?: () => void }) {
  const maids = S.maids;
  let file: File | null = null;
  const d = dialog({ title: 'Add a document', body: `<div class="note">Identity and medical documents are stored for administrators only. Upload only what the company is authorised to keep — never to the public website.</div>
    <div class="g2"><div class="fld"><label>Maid</label><select data-maid><option value="">— general / not linked —</option>${maids.map((m) => `<option value="${esc(m.id)}"${o.maid?.id === m.id ? ' selected' : ''}>${esc(nameOf(m))} (${esc(m.code)})</option>`).join('')}</select></div>
      <div class="fld"><label>Type</label><select data-kind>${KINDS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
      <div class="fld"><label>Title *</label><input data-title placeholder="e.g. Signed consent form"></div>
      <div class="fld"><label>Who can open it</label><select data-level>${LEVELS.filter(([k]) => isAdmin() || k !== 'admin').map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div></div>
    <div class="fld"><label>File (PDF, JPG, PNG; up to 10 MB)</label><button class="btn btn--ghost" type="button" data-pick>Choose file…</button> <span class="hint" data-fname>No file chosen</span></div>
    <div class="fld"><label>Notes</label><input data-notes></div><div data-msg></div>`,
    foot: '<button class="btn btn--ghost" data-no type="button">Cancel</button><button class="btn" data-save type="button">Upload</button>' });
  const kind = d.q<HTMLSelectElement>('[data-kind]'); const level = d.q<HTMLSelectElement>('[data-level]');
  kind.addEventListener('change', () => { if (['id-document', 'medical'].includes(kind.value)) { level.innerHTML = '<option value="admin">Administrators only</option>'; } else level.innerHTML = LEVELS.filter(([k]) => isAdmin() || k !== 'admin').map(([k, l]) => `<option value="${k}">${l}</option>`).join(''); });
  d.q('[data-no]').addEventListener('click', () => d.close());
  d.q('[data-pick]').addEventListener('click', async () => { const f = await pickFile('application/pdf,image/jpeg,image/png,image/webp'); if (f) { file = f; d.q('[data-fname]').textContent = `${f.name} (${(f.size / 1024).toFixed(0)} KB)`; if (!d.q<HTMLInputElement>('[data-title]').value) d.q<HTMLInputElement>('[data-title]').value = f.name.replace(/\.[^.]+$/, ''); } });
  d.q('[data-save]').addEventListener('click', async () => {
    const msg = d.q('[data-msg]'); const title = d.q<HTMLInputElement>('[data-title]').value.trim();
    if (!file) return (msg.innerHTML = '<div class="err">Choose a file first.</div>');
    if (!title) return (msg.innerHTML = '<div class="err">Enter a title.</div>');
    if (file.size > MAX) return (msg.innerHTML = '<div class="err">The file is larger than 10 MB.</div>');
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return (msg.innerHTML = '<div class="err">Only PDF, JPG, PNG or WebP files are accepted.</div>');
    const maidId = d.q<HTMLSelectElement>('[data-maid]').value; const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
    const path = `${maidId || 'general'}/${crypto.randomUUID()}-${safe}`;
    const up = await S.sb.storage.from(DOCS).upload(path, file, { contentType: file.type });
    if (up.error) return (msg.innerHTML = `<div class="err">${esc(up.error.message)}</div>`);
    const row = { maid_id: maidId || null, kind: kind.value, title, storage_path: path, mime_type: file.type, size_bytes: file.size, access_level: level.value, notes: d.q<HTMLInputElement>('[data-notes]').value.trim(), uploaded_by_email: S.me.email || '' };
    const ins = await S.sb.from('documents').insert(row).select().single();
    if (ins.error) { await S.sb.storage.from(DOCS).remove([path]); return (msg.innerHTML = `<div class="err">${esc(ins.error.message)}</div>`); }
    toast('Document saved.'); d.close(); o.onDone?.();
  });
}

export async function renderDocuments() {
  await loadMaids();
  let docs: Row[] = []; try { docs = await loadDocuments(); } catch (e) { toast((e as Error).message, 'err'); }
  setTitle('Documents', 'Secure internal documents');
  const root = mount(`<div class="note">Documents are <b>private</b>: kept in a protected store and opened through a link that expires after one minute. What you can see depends on your role and each document's access level. Nothing here is ever published on the website.</div>
    <div class="toolbar2"><div class="fld grow"><label>Search</label><input id="q" type="search" placeholder="Title or maid" value="${esc(F.q)}"></div>
      <div class="fld"><label>Type</label><select id="k"><option value="">All</option>${KINDS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
      <div class="fld"><label>Access</label><select id="lv"><option value="">All</option>${LEVELS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div></div>
    <div class="actions-bar">${canEdit() ? '<button class="btn" data-act="new" type="button">+ Add a document</button>' : ''}<span class="count" id="count"></span></div>
    <div class="card"><div class="tbl-wrap" id="tbl"></div></div>
    <h3 class="sec">Who can see what</h3><div class="tbl-wrap"><table class="tbl"><tr><th>Access level</th><th>Administrator</th><th>Editor</th><th>Viewer</th></tr>
      <tr><td>Administrators only (identity &amp; medical documents are always this level)</td><td>Open, delete</td><td>—</td><td>—</td></tr>
      <tr><td>Administrators and editors</td><td>Open, delete</td><td>Open, add</td><td>—</td></tr><tr><td>All staff</td><td>Open, delete</td><td>Open, add</td><td>Open</td></tr></table></div>`);
  (document.getElementById('k') as HTMLSelectElement).value = F.kind; (document.getElementById('lv') as HTMLSelectElement).value = F.level;
  const draw = () => {
    const q = F.q.trim().toLowerCase();
    const hits = docs.filter((d) => (!q || d.title.toLowerCase().includes(q) || (maidById(d.maid_id)?.full_name || '').toLowerCase().includes(q) || (maidById(d.maid_id)?.code || '').toLowerCase().includes(q)) && (!F.kind || d.kind === F.kind) && (!F.level || d.access_level === F.level));
    document.getElementById('count')!.textContent = `${hits.length} documents`;
    document.getElementById('tbl')!.innerHTML = hits.length ? `<table class="tbl"><tr><th>Document</th><th>Maid</th><th>Access</th><th>Added</th><th></th></tr>${hits.map((d) => rowHtml(d, true)).join('')}</table>` : '<p class="empty">No documents you may see.</p>';
  };
  draw();
  for (const [id, k] of [['q', 'q'], ['k', 'kind'], ['lv', 'level']] as const) document.getElementById(id)!.addEventListener('input', (e) => { (F as any)[k] = (e.target as HTMLInputElement).value; draw(); });
  onClick(root, { new: () => openUploadDialog({ onDone: renderDocuments }), 'doc-open': (b) => openDocument(b.dataset.id!), 'doc-del': (b) => deleteDocument(b.dataset.id!, renderDocuments) });
}
