// Final Choice staff portal — shared state, helpers, dialogs and the photo cropper.
// Everything here runs in the browser with the staff member's OWN login. The database (Row Level Security) decides what is
// allowed; the screens only hide buttons the person cannot use anyway.
import type { SupabaseClient } from '@supabase/supabase-js';
import { STATUS_LABEL } from '../mapping.js';

export type Row = Record<string, any>;
export const S = {
  sb: null as unknown as SupabaseClient,
  me: {} as Row,
  role: '',
  maids: [] as Row[],
  placements: [] as Row[],
  documents: [] as Row[],
  thumbs: new Map<string, string>(),
  thumbsAt: 0,
  loadedMaids: false,
};
export const PRIVATE = 'maid-private';
export const PUBLIC = 'maid-public';
export const DOCS = 'maid-documents';

export const $ = <T extends HTMLElement = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector(s) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T>(s)];
export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const TZ = 'Asia/Kuala_Lumpur';
export const fmtDate = (d?: string | null) => (d ? new Date(d.length === 10 ? d + 'T00:00:00+08:00' : d).toLocaleDateString('en-MY', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDT = (d?: string | null) => (d ? new Date(d).toLocaleString('en-MY', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const nameOf = (m: Row) => m.full_name || m.code;
export const slugOf = (code: string) => code.toLowerCase();
export const isAdmin = () => S.role === 'admin';
export const canEdit = () => S.role === 'admin' || S.role === 'editor';
export const natLabel = (n: string) => (n === 'filipino' ? 'Filipino' : n === 'indonesian' ? 'Indonesian' : n || '—');
export const go = (hash: string) => { location.hash = hash; };
export const myName = () => S.me.full_name || S.me.email || 'staff';

// ---------- small UI pieces ----------
const STATUS_CLASS: Record<string, string> = { 'to-be-confirmed': 'tbc', available: 'ok', 'on-hold': 'warn', booked: 'blue', 'pending-arrival': 'violet', hired: 'dark', withdrawn: 'grey' };
export const statusPill = (s: string) => `<span class="pill pill--${STATUS_CLASS[s] || 'grey'}">${esc(STATUS_LABEL[s as keyof typeof STATUS_LABEL] || s)}</span>`;
export const pill = (text: string, cls = 'grey') => `<span class="pill pill--${cls}">${esc(text)}</span>`;
export const initials = (name: string) => (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export function toast(msg: string, kind: 'ok' | 'err' = 'ok') {
  const t = $('#toast'); t.textContent = msg; t.className = `toast toast--${kind}`; t.hidden = false;
  clearTimeout((toast as any).h); (toast as any).h = setTimeout(() => (t.hidden = true), kind === 'err' ? 7000 : 3800);
}

export interface Dlg { el: HTMLDialogElement; close: () => void; q: <T extends HTMLElement = HTMLElement>(s: string) => T }
/** Open a modal dialog. `body` and `foot` are HTML strings. */
export function dialog(o: { title: string; body: string; foot?: string; wide?: boolean; xl?: boolean; onClose?: () => void }): Dlg {
  const el = document.createElement('dialog');
  el.className = o.xl ? 'dlg dlg--xl' : o.wide ? 'dlg dlg--wide' : 'dlg';
  el.innerHTML = `<div class="dlg-head"><h2>${esc(o.title)}</h2><button type="button" class="btn btn--ghost btn--sm" data-x>Close</button></div>
    <div class="dlg-body">${o.body}</div>${o.foot ? `<div class="dlg-foot">${o.foot}</div>` : ''}`;
  document.body.appendChild(el);
  const close = () => { el.close(); el.remove(); };
  el.addEventListener('close', () => { el.remove(); o.onClose?.(); });
  el.querySelector('[data-x]')!.addEventListener('click', close);
  el.showModal();
  return { el, close, q: (s) => el.querySelector(s) as any };
}
export function ask(message: string, o: { ok?: string; danger?: boolean; title?: string } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const d = dialog({ title: o.title || 'Please confirm', body: `<p style="white-space:pre-line">${esc(message)}</p>`,
      foot: `<button class="btn btn--ghost" data-no type="button">Cancel</button><button class="btn ${o.danger ? 'btn--danger-solid' : ''}" data-yes type="button">${esc(o.ok || 'Confirm')}</button>`,
      onClose: () => { if (!done) resolve(false); } });
    d.q('[data-no]').addEventListener('click', () => d.close());
    d.q('[data-yes]').addEventListener('click', () => { done = true; resolve(true); d.close(); });
  });
}
/** The person must type `expected` to proceed (used for deletions). */
export function askTyped(message: string, expected: string, ok = 'Delete permanently'): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const d = dialog({ title: 'Type to confirm', body: `<p style="white-space:pre-line">${esc(message)}</p><label>Type <b>${esc(expected)}</b> to continue</label><input type="text" data-t autocomplete="off">`,
      foot: `<button class="btn btn--ghost" data-no type="button">Cancel</button><button class="btn btn--danger-solid" data-yes type="button" disabled>${esc(ok)}</button>`,
      onClose: () => { if (!done) resolve(false); } });
    const yes = d.q<HTMLButtonElement>('[data-yes]');
    d.q<HTMLInputElement>('[data-t]').addEventListener('input', (e) => { yes.disabled = (e.target as HTMLInputElement).value.trim() !== expected; });
    d.q('[data-no]').addEventListener('click', () => d.close());
    yes.addEventListener('click', () => { done = true; resolve(true); d.close(); });
  });
}

export function pager(total: number, page: number, size: number): string {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages < 2) return '';
  const b = (label: string, p: number, dis = false, cur = false) => `<button type="button" class="pg${cur ? ' pg--cur' : ''}" data-page="${p}"${dis ? ' disabled' : ''}>${label}</button>`;
  const nums: string[] = [];
  for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(b(String(p), p, false, p === page)); else if (nums[nums.length - 1] !== '…') nums.push('…');
  return `<div class="pager">${b('‹ Prev', page - 1, page === 1)}${nums.join('')}${b('Next ›', page + 1, page === pages)}</div>`;
}

// ---------- data ----------
export async function loadMaids(force = false) {
  if (S.loadedMaids && !force) return S.maids;
  const { data, error } = await S.sb.from('maids').select('*').order('nationality').order('full_name');
  if (error) throw new Error(`Could not load maid records: ${error.message}`);
  S.maids = data; S.loadedMaids = true;
  return S.maids;
}
export const maidById = (id: string | null | undefined) => S.maids.find((m) => m.id === id);
export const maidByCode = (code: string) => S.maids.find((m) => m.code === code.toUpperCase());
export function replaceMaid(m: Row) { const i = S.maids.findIndex((x) => x.id === m.id); if (i >= 0) S.maids[i] = m; else S.maids.push(m); }

/** Private working photos are shown through short-lived signed links. */
export async function ensureThumbs(force = false) {
  if (!force && Date.now() - S.thumbsAt < 40 * 60e3 && S.thumbs.size) return;
  const paths = S.maids.map((m) => m.photo_path).filter(Boolean);
  const next = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 100) {
    const { data } = await S.sb.storage.from(PRIVATE).createSignedUrls(paths.slice(i, i + 100), 3600);
    for (const u of data || []) if (u.signedUrl && u.path) next.set(u.path, u.signedUrl);
  }
  S.thumbs = next; S.thumbsAt = Date.now();
}
export const thumbUrl = (m: Row) => (m.photo_path ? S.thumbs.get(m.photo_path) || '' : '');
export const thumbHtml = (m: Row, cls = 'thumb') => (thumbUrl(m) ? `<img class="${cls}" src="${esc(thumbUrl(m))}" alt="" loading="lazy">` : `<span class="${cls} thumb--none" title="No photo">${esc(initials(nameOf(m)))}</span>`);

export async function logHistory(table: string, recordId: string, limit = 60) {
  if (table === 'maids') return (await S.sb.from('maid_history').select('*').eq('maid_id', recordId).order('changed_at', { ascending: false }).limit(limit)).data || [];
  return (await S.sb.from('audit_log').select('*').eq('table_name', table).eq('record_id', recordId).order('at', { ascending: false }).limit(limit)).data || [];
}

const FIELD_LABEL: Record<string, string> = {
  status: 'Availability', status_confirmed: 'Status confirmed', status_set_by: 'Status set by', published: 'Published', consent_recorded: 'Consent on file', consent_date: 'Consent date',
  photo_consent: 'Photo consent', name_consent: 'Name shown', full_name: 'Full name', summary_en: 'Summary (EN)', summary_ms: 'Summary (BM)', photo_path: 'Photo', public_photo_path: 'Website photo',
  discrepancies_resolved: 'Discrepancies resolved', approved_by: 'Approved by', stage: 'Stage', employer_name: 'Employer', title: 'Title', role: 'Role', active: 'Active', access_level: 'Access',
  rest_day_preference: 'Rest day', salary_note: 'Salary note', internal_notes: 'Internal notes', experience_years: 'Experience (years)', age: 'Age', nationality: 'Nationality',
};
const short = (v: unknown) => { const s = v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v); return s.length > 70 ? s.slice(0, 67) + '…' : s; };
const val = (k: string, v: unknown) => (k === 'status' ? STATUS_LABEL[v as keyof typeof STATUS_LABEL] || short(v) : short(v));
/** Render history rows (maid_history or audit_log) as a readable table. */
export function historyTable(rows: Row[], opts: { showWho?: boolean; showRecord?: boolean } = {}) {
  if (!rows.length) return '<p class="hint">No changes recorded yet.</p>';
  const when = (r: Row) => r.changed_at || r.at;
  return `<div class="tbl-wrap"><table class="tbl"><tr><th>When</th>${opts.showRecord ? '<th>Record</th>' : ''}<th>Who</th><th>What changed</th></tr>${rows.map((r) => {
    const action = r.action; const ch = (r.changes || {}) as Row;
    const what = action === 'insert' ? 'Record added' : action === 'delete' ? '<b>Record deleted</b>' : action === 'export' ? `<b>Export</b>: ${esc(r.label)} (${esc(ch.rows)} rows)` : action === 'password-reset' ? '<b>Temporary password set</b>'
      : Object.entries(ch).filter(([k]) => !['status_updated_at', 'status_verified_at', 'id', 'created_at', 'created_by', 'user_id'].includes(k)).map(([k, c]: [string, any]) => `<div><b>${esc(FIELD_LABEL[k] || k)}</b>: ${esc(val(k, c?.from))} → ${esc(val(k, c?.to))}</div>`).join('') || '—';
    return `<tr><td class="nw">${fmtDT(when(r))}</td>${opts.showRecord ? `<td>${esc(r.code || r.label || r.table_name)}</td>` : ''}<td>${esc(r.changed_by_email || r.actor_email || 'office script')}</td><td>${what}</td></tr>`;
  }).join('')}</table></div>`;
}

// ---------- photos ----------
export async function toWebp(source: Blob, w = 720, h = 900): Promise<Blob> {
  const img = await createImageBitmap(source);
  const s = Math.max(w / img.width, h / img.height);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(img, (w - img.width * s) / 2, 0, img.width * s, img.height * s); // top-anchored: keeps the face
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('Could not convert the photo'))), 'image/webp', 0.8));
}
/** Crop dialog: drag to move, slider to zoom. Returns a 720×900 WebP, or null if cancelled. */
export function cropper(source: Blob): Promise<Blob | null> {
  return new Promise(async (resolve) => {
    const img = await createImageBitmap(source).catch(() => null);
    if (!img) { toast('That file is not a picture the browser can read.', 'err'); return resolve(null); }
    const W = 360, H = 450; let done = false;
    const d = dialog({ title: 'Crop photo (4:5 portrait)', body: `<p class="hint">Drag the picture to place the face; use the slider to zoom. The result is saved as a small 720×900 picture.</p>
      <div class="crop"><canvas width="${W}" height="${H}" data-c></canvas></div>
      <label>Zoom <input type="range" min="1" max="3" step="0.01" value="1" data-z></label>
      <div class="row-actions"><button class="btn btn--ghost btn--sm" type="button" data-top>Top-aligned (default)</button><button class="btn btn--ghost btn--sm" type="button" data-mid>Centre</button></div>`,
      foot: `<button class="btn btn--ghost" data-no type="button">Cancel</button><button class="btn" data-yes type="button">Use this crop</button>`,
      onClose: () => { if (!done) resolve(null); } });
    const cv = d.q<HTMLCanvasElement>('[data-c]'); const ctx = cv.getContext('2d')!; const zoom = d.q<HTMLInputElement>('[data-z]');
    const cover = Math.max(W / img.width, H / img.height); let ox = 0; let oy = 0; let drag: { x: number; y: number; ox: number; oy: number } | null = null;
    const sc = () => cover * Number(zoom.value);
    const clamp = () => { const iw = img.width * sc(); const ih = img.height * sc(); ox = Math.min(0, Math.max(W - iw, ox)); oy = Math.min(0, Math.max(H - ih, oy)); };
    const draw = () => { clamp(); ctx.clearRect(0, 0, W, H); ctx.drawImage(img, ox, oy, img.width * sc(), img.height * sc()); };
    const top = () => { zoom.value = '1'; ox = (W - img.width * cover) / 2; oy = 0; draw(); };
    top();
    zoom.addEventListener('input', draw);
    d.q('[data-top]').addEventListener('click', top);
    d.q('[data-mid]').addEventListener('click', () => { oy = (H - img.height * sc()) / 2; draw(); });
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ox, oy }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; ox = drag.ox + (e.clientX - drag.x); oy = drag.oy + (e.clientY - drag.y); draw(); });
    cv.addEventListener('pointerup', () => (drag = null));
    d.q('[data-no]').addEventListener('click', () => d.close());
    d.q('[data-yes]').addEventListener('click', async () => {
      const out = document.createElement('canvas'); out.width = 720; out.height = 900; const k = 720 / W;
      out.getContext('2d')!.drawImage(img, ox * k, oy * k, img.width * sc() * k, img.height * sc() * k);
      const blob = await new Promise<Blob | null>((ok) => out.toBlob(ok, 'image/webp', 0.8));
      done = true; resolve(blob); d.close();
    });
  });
}
export const photoPath = (m: Row) => `${slugOf(m.code)}.webp`;
/** Save a (cropped) photo to the PRIVATE bucket and point the record at it. */
export async function savePrivatePhoto(m: Row, blob: Blob) {
  const path = photoPath(m);
  const up = await S.sb.storage.from(PRIVATE).upload(path, blob, { contentType: 'image/webp', upsert: true });
  if (up.error) throw up.error;
  const { data, error } = await S.sb.from('maids').update({ photo_path: path }).eq('id', m.id).select().single();
  if (error) throw error;
  replaceMaid(data); S.thumbsAt = 0; await ensureThumbs(true);
  return data as Row;
}
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
    i.onchange = () => resolve(i.files?.[0] || null); i.click();
  });
}

// ---------- export ----------
export function downloadCsv(filename: string, rows: Row[]) {
  if (!rows.length) return toast('Nothing to export.', 'err');
  const cols = Object.keys(rows[0]);
  const q = (v: unknown) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\r\n') + '\r\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
export async function logExport(what: string, count: number) {
  const { error } = await S.sb.rpc('log_export', { p_what: what, p_count: count });
  if (error) throw new Error(error.message);
}

export type View = (arg?: string) => Promise<void> | void;
export const view = () => $('#view');
/** Replace the page area with fresh content. Using a NEW element each time means old click handlers can never pile up. */
export function mount(html: string): HTMLElement {
  const old = $('#view'); const nv = old.cloneNode(false) as HTMLElement; nv.innerHTML = html; old.replaceWith(nv); window.scrollTo({ top: 0 }); return nv;
}
export function setTitle(t: string, sub = '') { document.title = `${t} — Final Choice staff`; $('#page-title').innerHTML = esc(t) + (sub ? `<small>${esc(sub)}</small>` : ''); }
export function onClick(root: ParentNode, handlers: Record<string, (el: HTMLElement, ev: Event) => void>) {
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (el && handlers[el.dataset.act!]) handlers[el.dataset.act!](el, e);
  });
}
