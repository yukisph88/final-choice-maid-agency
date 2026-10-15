// Final Choice — staff dashboard logic (runs in the browser). Uses ONLY the public anon key + the staff member's
// own login session. Every action is checked again by the database's Row Level Security rules:
//   viewer → read only · editor → add / edit / publish · admin → also delete
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  STATUSES, STATUS_LABEL, SKILLS, SKILL_LABEL, LEVELS, LEVEL_LABEL, HIDDEN,
  parseCsv, csvRowToDb, validateRow, changedFields, parseLanguages, formatLanguages, parseHistory, formatHistory, splitName,
} from './mapping.js';

type Row = Record<string, any>;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const $$ = (s: string, root: ParentNode = document) => [...root.querySelectorAll<HTMLElement>(s)];
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (t?: string) => (t ? new Date(t).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' }) : '—');
const PRIVATE = 'maid-private';
const PUBLIC = 'maid-public';
const IDLE_MINUTES = 60;

const cfg = $('#cfg').dataset;
let sb: SupabaseClient;
let role = '';
let me: Row = {};
let maids: Row[] = [];
let thumbs = new Map<string, string>();
let current: Row | null = null; // record open in the editor (null = new)
let pendingPhoto: Blob | null = null;
let pendingPdf: File | null = null;
let importPlan: { rows: Row[] } | null = null;
const canEdit = () => role === 'admin' || role === 'editor';

function toast(msg: string) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout((toast as any).h); (toast as any).h = setTimeout(() => (t.hidden = true), 3500);
}
function show(view: 'login' | 'denied' | 'app') {
  for (const v of ['login', 'denied', 'app']) $(`#v-${v}`).hidden = v !== view;
}

// ---------- start ----------
if (cfg.url && cfg.key) {
  sb = createClient(cfg.url, cfg.key, { auth: { persistSession: true, storageKey: 'fc-staff-auth' } });
  sb.auth.onAuthStateChange((_e, session) => { if (!session) show('login'); });
  start();
}

async function start() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return show('login');
  const r = await sb.rpc('staff_role');
  role = (r.data as string) || '';
  if (!role) return show('denied');
  me = (await sb.from('staff').select('*').eq('user_id', data.session.user.id).single()).data || {};
  $('#who').textContent = `${me.full_name || data.session.user.email} · ${role}`;
  $$('[data-edit]').forEach((b) => ((b as HTMLButtonElement).hidden = !canEdit()));
  show('app');
  await load();
  idleTimer();
}

function idleTimer() {
  let last = Date.now();
  for (const ev of ['click', 'keydown', 'mousemove', 'touchstart']) addEventListener(ev, () => (last = Date.now()), { passive: true });
  setInterval(async () => { if (Date.now() - last > IDLE_MINUTES * 60e3) { await sb.auth.signOut(); location.reload(); } }, 60e3);
}

$('#f-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#l-msg'); msg.innerHTML = '';
  const { error } = await sb.auth.signInWithPassword({ email: $<HTMLInputElement>('#l-email').value.trim(), password: $<HTMLInputElement>('#l-pass').value });
  if (error) { msg.innerHTML = `<div class="err">${esc(error.message === 'Invalid login credentials' ? 'E-mail or password is not correct.' : error.message)}</div>`; return; }
  $<HTMLInputElement>('#l-pass').value = '';
  start();
});
$('#l-forgot').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = $<HTMLInputElement>('#l-email').value.trim();
  if (!email) return ($('#l-msg').innerHTML = '<div class="err">Type your e-mail first.</div>');
  await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
  $('#l-msg').innerHTML = '<div class="ok">If this e-mail belongs to a staff account, a reset link has been sent.</div>';
});
$$('[data-signout]').forEach((b) => b.addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); }));

// ---------- list ----------
for (const s of STATUSES) $('#fs').insertAdjacentHTML('beforeend', `<option value="${s}">${STATUS_LABEL[s]}</option>`);
for (const id of ['#q', '#fn', '#fs', '#fp']) $(id).addEventListener('input', render);

async function load() {
  const { data, error } = await sb.from('maids').select('*').order('nationality').order('full_name');
  if (error) return toast(`Could not load records: ${error.message}`);
  maids = data;
  const paths = maids.map((m) => m.photo_path).filter(Boolean);
  thumbs = new Map();
  for (let i = 0; i < paths.length; i += 100) {
    const { data: urls } = await sb.storage.from(PRIVATE).createSignedUrls(paths.slice(i, i + 100), 3600);
    for (const u of urls || []) if (u.signedUrl && u.path) thumbs.set(u.path, u.signedUrl);
  }
  render();
}

function render() {
  const q = $<HTMLInputElement>('#q').value.trim().toLowerCase();
  const fn = $<HTMLSelectElement>('#fn').value; const fs = $<HTMLSelectElement>('#fs').value; const fp = $<HTMLSelectElement>('#fp').value;
  const hits = maids.filter((m) => (!q || m.code.toLowerCase().includes(q) || (m.full_name || '').toLowerCase().includes(q))
    && (!fn || m.nationality === fn) && (!fs || m.status === fs) && (!fp || (fp === 'pub') === m.published));
  $('#count').textContent = `${hits.length} of ${maids.length} maids · ${maids.filter((m) => m.published).length} published`;
  $('#list').innerHTML = hits.map((m) => `
    <div class="row card" data-id="${m.id}">
      ${thumbs.get(m.photo_path) ? `<img src="${esc(thumbs.get(m.photo_path))}" alt="" loading="lazy">` : '<span class="thumb"></span>'}
      <div><div class="name">${esc(m.full_name || '(no name)')}</div><div class="code">Ref: ${esc(m.code)}</div></div>
      <div>${m.nationality === 'filipino' ? 'Filipino' : 'Indonesian'}</div>
      <div>${canEdit()
        ? `<select data-quick="${m.id}" aria-label="Status for ${esc(m.code)}">${STATUSES.map((s) => `<option value="${s}"${s === m.status ? ' selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select>`
        : `<span class="pill pill--${m.status}">${STATUS_LABEL[m.status]}</span>`}
        <div class="code">${m.status_confirmed ? 'Confirmed' : m.status_set_by ? 'Not yet confirmed' : 'To be confirmed'} · ${fmt(m.status_updated_at)}</div></div>
      <div><span class="pill ${m.published ? 'pill--pub">Published' : 'pill--priv">Private'}</span></div>
      <div><button class="btn btn--ghost btn--sm" type="button" data-open="${m.id}">${canEdit() ? 'Edit' : 'View'}</button></div>
    </div>`).join('') || '<p class="hint">No maids match.</p>';
}

$('#list').addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-open]')?.dataset.open;
  if (id) openEditor(maids.find((m) => m.id === id) || null);
});
$('#list').addEventListener('change', async (e) => {
  const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-quick]');
  if (!sel) return;
  const m = maids.find((x) => x.id === sel.dataset.quick)!;
  const status = sel.value;
  if (HIDDEN.includes(status) && m.published && !confirm(`${m.full_name || m.code} will be removed from the website listings (${STATUS_LABEL[status]}). Continue?`)) { sel.value = m.status; return; }
  const by = me.full_name || me.email || 'staff';
  const { data, error } = await sb.from('maids').update({ status, status_set_by: by, status_confirmed: true }).eq('id', m.id).select().single();
  if (error) { sel.value = m.status; return toast(`Not saved: ${error.message}`); }
  Object.assign(m, data); render();
  toast(`${m.full_name || m.code}: ${STATUS_LABEL[status]} — the website shows this the next time the page is opened.`);
});

// ---------- editor ----------
const form = $<HTMLFormElement>('#f-edit');
const field = (n: string) => form.elements.namedItem(n) as HTMLInputElement;
for (const s of STATUSES) $('#e-st').insertAdjacentHTML('beforeend', `<option value="${s}">${STATUS_LABEL[s]}</option>`);
$('#e-skills').innerHTML = SKILLS.map((k) => `<div><label for="sk-${k}">${SKILL_LABEL[k]}</label><select id="sk-${k}" name="skill_${k}">${LEVELS.map((l) => `<option value="${l}">${LEVEL_LABEL[l]}</option>`).join('')}</select></div>`).join('');
$$('#d-edit .tabs button').forEach((b) => b.addEventListener('click', () => tab(b.dataset.tab!)));
function tab(id: string) {
  $$('#d-edit .tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  $$('#d-edit [data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== id));
  if (id === 't-hist' && current) loadHistory(current.id, '#e-history');
}
$$('dialog [data-close]').forEach((b) => b.addEventListener('click', () => (b.closest('dialog') as HTMLDialogElement).close()));
$('#b-add').addEventListener('click', () => openEditor(null));

const BOOL = ['show_age', 'show_religion', 'overseas_experience', 'status_confirmed', 'consent_recorded', 'photo_consent', 'featured', 'published'];
const TEXT = ['code', 'nationality', 'full_name', 'first_name', 'name_consent', 'display_name_override', 'religion', 'marital_status', 'summary_en', 'summary_ms',
  'interview_availability_en', 'interview_availability_ms', 'status', 'status_set_by', 'approved_by', 'internal_notes', 'source_file'];

async function openEditor(m: Row | null) {
  current = m; pendingPhoto = null; pendingPdf = null;
  form.reset(); $('#e-msg').innerHTML = '';
  $('#e-title').textContent = m ? `${m.full_name || m.code} — Ref: ${m.code}` : 'Add a new maid';
  const v = m || { nationality: 'indonesian', name_consent: 'none', status: 'available', skills: Object.fromEntries(SKILLS.map((k) => [k, 'none'])) };
  for (const k of TEXT) if (field(k)) field(k).value = v[k] ?? '';
  for (const k of BOOL) field(k).checked = Boolean(v[k]);
  field('age').value = v.age ?? ''; field('experience_years').value = v.experience_years ?? ''; field('consent_date').value = v.consent_date ?? '';
  for (const k of SKILLS) (form.elements.namedItem(`skill_${k}`) as HTMLSelectElement).value = v.skills?.[k] ?? 'none';
  field('languages').value = formatLanguages(v.languages); field('employment_history').value = formatHistory(v.employment_history);
  field('code').readOnly = Boolean(m);
  $<HTMLImageElement>('#e-photo').src = m?.photo_path ? thumbs.get(m.photo_path) || '' : '';
  $('#e-photo-state').textContent = !m?.photo_path ? 'No photo yet.' : m.public_photo_path ? 'Shown on the website (published with photo consent).' : 'Private — not shown on the website.';
  $('#e-pdf-state').innerHTML = m?.biodata_pdf_path ? '<a href="#" id="e-pdf-open">Open the private biodata PDF</a>' : 'No PDF stored.';
  $('#e-del').hidden = !(m && role === 'admin');
  $$('#f-edit input, #f-edit select, #f-edit textarea').forEach((el) => ((el as HTMLInputElement).disabled = !canEdit()));
  tab('t-details');
  ($('#d-edit') as HTMLDialogElement).showModal();
}

$('#d-edit').addEventListener('click', async (e) => {
  if ((e.target as HTMLElement).id !== 'e-pdf-open' || !current) return;
  e.preventDefault();
  const { data } = await sb.storage.from(PRIVATE).createSignedUrl(current.biodata_pdf_path, 300);
  if (data?.signedUrl) open(data.signedUrl, '_blank', 'noopener');
});

function readForm(): Row {
  const row: Row = {};
  for (const k of TEXT) row[k] = field(k).value.trim();
  for (const k of BOOL) row[k] = field(k).checked;
  row.code = row.code.toUpperCase();
  row.age = field('age').value ? Number(field('age').value) : null;
  row.experience_years = field('experience_years').value === '' ? null : Number(field('experience_years').value);
  row.consent_date = field('consent_date').value || null;
  row.skills = Object.fromEntries(SKILLS.map((k) => [k, (form.elements.namedItem(`skill_${k}`) as HTMLSelectElement).value]));
  row.languages = parseLanguages(field('languages').value);
  row.employment_history = parseHistory(field('employment_history').value);
  if (!row.first_name && row.full_name) row.first_name = splitName(row.full_name).firstName;
  return row;
}

// Photo: crop to 720×900 (top-anchored, keeps the face), strip metadata, small WebP
async function toWebp(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const W = 720, H = 900, s = Math.max(W / img.width, H / img.height);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d')!.drawImage(img, (W - img.width * s) / 2, 0, img.width * s, img.height * s);
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('Could not convert the photo'))), 'image/webp', 0.8));
}
$('#e-file').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
  try { pendingPhoto = await toWebp(f); $<HTMLImageElement>('#e-photo').src = URL.createObjectURL(pendingPhoto); $('#e-photo-state').textContent = `New photo ready (${Math.round(pendingPhoto.size / 1024)} KB) — press Save.`; }
  catch (err) { toast(String((err as Error).message)); }
});
$('#e-pdf').addEventListener('change', (e) => {
  const f = (e.target as HTMLInputElement).files?.[0] || null;
  if (f && f.size > 10 * 1048576) { toast('PDF is larger than 10 MB'); (e.target as HTMLInputElement).value = ''; return; }
  pendingPdf = f; if (f) $('#e-pdf-state').textContent = `${f.name} ready — press Save.`;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!canEdit()) return;
  const msg = $('#e-msg'); msg.innerHTML = '';
  const row = readForm();
  const slug = row.code.toLowerCase();
  if (!current && maids.some((m) => m.code === row.code)) { msg.innerHTML = `<div class="err">Reference code ${esc(row.code)} already exists.</div>`; return; }
  const wantPublic = row.published && row.photo_consent;
  row.photo_path = current?.photo_path || (pendingPhoto ? `${slug}.webp` : '');
  const { errors } = validateRow(row);
  if (errors.length) { msg.innerHTML = `<div class="err">${esc(errors.join('\n'))}</div>`; return; }
  if (row.status !== current?.status) { row.status_set_by = row.status_set_by || me.full_name || me.email; }
  $<HTMLButtonElement>('#e-save').disabled = true;
  try {
    // 1. files go to the PRIVATE bucket
    if (pendingPhoto) {
      const up = await sb.storage.from(PRIVATE).upload(`${slug}.webp`, pendingPhoto, { contentType: 'image/webp', upsert: true });
      if (up.error) throw up.error;
      row.photo_path = `${slug}.webp`;
    }
    if (pendingPdf) {
      const up = await sb.storage.from(PRIVATE).upload(`pdfs/${slug}.pdf`, pendingPdf, { contentType: 'application/pdf', upsert: true });
      if (up.error) throw up.error;
      row.biodata_pdf_path = `pdfs/${slug}.pdf`;
    }
    // 2. remove the public copy first when it is no longer allowed (unpublished / no photo consent)
    if (current?.public_photo_path && !wantPublic) {
      await sb.storage.from(PUBLIC).remove([current.public_photo_path]);
      row.public_photo_path = '';
    }
    // 3. save the record (the database re-checks consent rules)
    const res = current
      ? await sb.from('maids').update(row).eq('id', current.id).select().single()
      : await sb.from('maids').insert(row).select().single();
    if (res.error) throw res.error;
    let saved = res.data;
    // 4. copy the approved photo to the PUBLIC bucket (allowed only for published maids with photo consent)
    if (wantPublic && saved.photo_path && (pendingPhoto || !saved.public_photo_path)) {
      const blob = pendingPhoto || (await sb.storage.from(PRIVATE).download(saved.photo_path)).data;
      if (blob) {
        const up = await sb.storage.from(PUBLIC).upload(`${slug}.webp`, blob, { contentType: 'image/webp', upsert: true, cacheControl: '300' });
        if (up.error) throw up.error;
        const r2 = await sb.from('maids').update({ public_photo_path: `${slug}.webp` }).eq('id', saved.id).select().single();
        if (r2.error) throw r2.error;
        saved = r2.data;
      }
    }
    const i = maids.findIndex((m) => m.id === saved.id);
    if (i >= 0) maids[i] = saved; else maids.push(saved);
    if (pendingPhoto) thumbs.set(saved.photo_path, URL.createObjectURL(pendingPhoto));
    render();
    ($('#d-edit') as HTMLDialogElement).close();
    toast(`Saved ${saved.full_name || saved.code}.${saved.published ? ' Status changes show on the website straight away; new or edited profile text appears after the next website update.' : ''}`);
  } catch (err) {
    const m = String((err as Error).message || err);
    msg.innerHTML = `<div class="err">Not saved: ${esc(/publish_requires_consent/.test(m) ? 'publishing needs consent, consent date and approver' : /public_photo_requires_consent/.test(m) ? 'the website photo needs "Published" and photo consent' : m)}</div>`;
  } finally { $<HTMLButtonElement>('#e-save').disabled = false; }
});

$('#e-del').addEventListener('click', async () => {
  if (!current || role !== 'admin') return;
  if (prompt(`Type the reference code ${current.code} to delete this record permanently. (Usually it is better to mark the maid Withdrawn.)`) !== current.code) return;
  const files = [current.photo_path, current.biodata_pdf_path].filter(Boolean);
  const { error } = await sb.from('maids').delete().eq('id', current.id);
  if (error) return toast(`Not deleted: ${error.message}`);
  if (files.length) await sb.storage.from(PRIVATE).remove(files);
  if (current.public_photo_path) await sb.storage.from(PUBLIC).remove([current.public_photo_path]);
  maids = maids.filter((m) => m.id !== current!.id); render();
  ($('#d-edit') as HTMLDialogElement).close(); toast('Record deleted. The deletion is kept in the history.');
});

// ---------- history ----------
const LABEL: Record<string, string> = { status: 'Availability', status_confirmed: 'Status confirmed', status_set_by: 'Status set by', published: 'Published', consent_recorded: 'Consent on file',
  consent_date: 'Consent date', photo_consent: 'Photo consent', name_consent: 'Name shown', full_name: 'Full name', summary_en: 'Summary (EN)', summary_ms: 'Summary (BM)', photo_path: 'Photo', public_photo_path: 'Website photo' };
const short = (v: unknown) => { const s = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—'); return s.length > 80 ? s.slice(0, 77) + '…' : s; };
async function loadHistory(maidId: string | null, target: string) {
  let q = sb.from('maid_history').select('*').order('changed_at', { ascending: false }).limit(maidId ? 200 : 60);
  if (maidId) q = q.eq('maid_id', maidId);
  const { data, error } = await q;
  if (error) { $(target).innerHTML = `<div class="err">${esc(error.message)}</div>`; return; }
  $(target).innerHTML = data.length ? `<table><tr><th>When</th>${maidId ? '' : '<th>Maid</th>'}<th>Who</th><th>Change</th></tr>${data.map((h) => `<tr>
    <td>${fmt(h.changed_at)}</td>${maidId ? '' : `<td>${esc(h.code)}</td>`}<td>${esc(h.changed_by_email || 'office script')}</td>
    <td>${h.action === 'insert' ? 'Record added' : h.action === 'delete' ? '<b>Record deleted</b>' : Object.entries(h.changes as Row).filter(([k]) => k !== 'status_updated_at').map(([k, c]) => `<div><b>${esc(LABEL[k] || k)}</b>: ${esc(k === 'status' ? STATUS_LABEL[c.from] ?? c.from : short(c.from))} → ${esc(k === 'status' ? STATUS_LABEL[c.to] ?? c.to : short(c.to))}</div>`).join('')}</td></tr>`).join('')}</table>` : '<p class="hint">No changes recorded yet.</p>';
}
$('#b-history').addEventListener('click', () => { ($('#d-history') as HTMLDialogElement).showModal(); loadHistory(null, '#h-out'); });

// ---------- CSV import ----------
$('#b-import').addEventListener('click', () => { importPlan = null; $('#i-out').innerHTML = ''; $<HTMLInputElement>('#i-file').value = ''; $<HTMLButtonElement>('#i-apply').disabled = true; ($('#d-import') as HTMLDialogElement).showModal(); });
$('#i-file').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
  const src = parseCsv(await f.text()).filter((r: Row) => r.code && !/^EXAMPLE/i.test(r.code));
  const byCode = new Map(maids.map((m) => [m.code, m]));
  const seen = new Set<string>(); const rows: Row[] = []; const lines: string[] = []; let same = 0; let bad = 0;
  for (const r of src) {
    const row = csvRowToDb(r);
    if (seen.has(row.code)) { bad++; lines.push(`<tr><td>${esc(row.code)}</td><td class="err">Listed twice in the file</td></tr>`); continue; }
    seen.add(row.code);
    const old = byCode.get(row.code);
    if (old) { delete row.published; row.photo_path = old.photo_path; } else row.photo_path = '';
    const { errors } = validateRow({ ...row, published: false });
    if (errors.length) { bad++; lines.push(`<tr><td>${esc(row.code)}</td><td class="err">${esc(errors.join('; '))}</td></tr>`); continue; }
    if (!old) { rows.push(row); lines.push(`<tr><td>${esc(row.code)}</td><td>New — ${esc(row.full_name)}</td></tr>`); continue; }
    const diff = changedFields(old, row);
    if (!diff.length) { same++; continue; }
    rows.push(row); lines.push(`<tr><td>${esc(row.code)}</td><td>Update: ${esc(diff.join(', '))}</td></tr>`);
  }
  importPlan = bad ? null : { rows };
  $('#i-out').innerHTML = `<p><b>${src.length}</b> rows · <b>${rows.filter((r) => !byCode.has(r.code)).length}</b> new · <b>${rows.filter((r) => byCode.has(r.code)).length}</b> changed · ${same} unchanged · <b>${bad}</b> with problems</p>
    ${bad ? '<div class="err">Fix the rows marked in red and choose the file again. Nothing has been imported.</div>' : ''}<table>${lines.join('')}</table>`;
  $<HTMLButtonElement>('#i-apply').disabled = !importPlan || !rows.length;
});
$('#i-apply').addEventListener('click', async () => {
  if (!importPlan) return;
  $<HTMLButtonElement>('#i-apply').disabled = true;
  for (let i = 0; i < importPlan.rows.length; i += 50) {
    const { error } = await sb.from('maids').upsert(importPlan.rows.slice(i, i + 50), { onConflict: 'code' });
    if (error) { $('#i-out').insertAdjacentHTML('afterbegin', `<div class="err">Stopped: ${esc(error.message)}</div>`); return; }
  }
  ($('#d-import') as HTMLDialogElement).close(); toast(`${importPlan.rows.length} record(s) imported. Nobody was published.`); await load();
});
