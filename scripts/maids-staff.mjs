#!/usr/bin/env node
// Final Choice — local staff page for maid status updates (office PC only, free, no online services).
//
//   npm run maids:staff      → open http://127.0.0.1:4331
//
// Choose a maid and a status from the dropdowns, type your initials, press "Save status".
// It uses exactly the same checks and records as "npm run maids:status" (maids.mjs). The page listens on
// 127.0.0.1 only, so it cannot be reached from other computers or the internet. It also serves the
// private review site on http://127.0.0.1:4330 if nothing else is already serving it.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { readRecords, recordName, readHistory, applyStatusChanges, preview, STATUS_LABEL, HIDDEN } from './maids.mjs';

const HOST = '127.0.0.1';
const PORT = 4331;
const REVIEW_PORT = 4330;
const TOKEN = randomBytes(16).toString('hex'); // stops other websites from submitting this form
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const stamp = (t) => (t ? t.slice(0, 16).replace('T', ' ') : '—');
let busy = false;

function page({ msg = '', err = '', sel = {} } = {}) {
  const rows = readRecords().sort((a, b) => a.nationality.localeCompare(b.nationality) || recordName(a).localeCompare(recordName(b)));
  const opt = (r) => `<option value="${esc(r.code)}"${sel.code === r.code ? ' selected' : ''}>${esc(recordName(r))} — ${esc(r.code)} — ${r.statusSetBy ? `${esc(STATUS_LABEL[r.status])}${r.statusConfirmed === 'yes' ? '' : ' (not yet confirmed)'}` : 'Status not set – to be confirmed'}</option>`;
  const group = (nat, label) => `<optgroup label="${label}">${rows.filter((r) => r.nationality === nat).map(opt).join('')}</optgroup>`;
  const hist = readHistory(15);
  const counts = Object.fromEntries(Object.keys(STATUS_LABEL).map((k) => [k, rows.filter((r) => r.status === k).length]));
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Maid status — Final Choice staff</title>
<style>
:root{--ink:#141c2e;--muted:#4f5d73;--line:#dde5f0;--blue:#1f3a93;--green:#0e7a40;--red:#b42318}
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,Segoe UI,Arial,sans-serif;color:var(--ink);background:#f6f8fb}
main{max-width:860px;margin:0 auto;padding:24px 16px 48px}h1{font-size:1.5rem;margin:0 0 4px}h2{font-size:1.1rem;margin:28px 0 8px}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px}.muted{color:var(--muted)}
label{display:block;font-weight:600;margin:14px 0 6px}select,input{width:100%;font:inherit;padding:10px 12px;border:1px solid #b9c4d6;border-radius:8px;background:#fff}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:600px){.row{grid-template-columns:1fr}}
button{font:inherit;font-weight:700;padding:11px 20px;border-radius:8px;border:0;background:var(--blue);color:#fff;cursor:pointer;margin-top:18px}
button.secondary{background:#fff;color:var(--blue);border:1px solid var(--blue)}button:disabled{opacity:.6}
.ok{background:#e8f6ee;border:1px solid #b6e2c6;color:var(--green);padding:12px 14px;border-radius:8px;margin-bottom:16px;white-space:pre-line}
.err{background:#fdecea;border:1px solid #f5c2bd;color:var(--red);padding:12px 14px;border-radius:8px;margin-bottom:16px;white-space:pre-line}
table{width:100%;border-collapse:collapse;font-size:.92rem;background:#fff}td,th{border-bottom:1px solid var(--line);padding:7px 8px;text-align:left;vertical-align:top}
code{background:#eef1f6;padding:2px 6px;border-radius:5px;font-size:.88rem}.pill{display:inline-block;padding:2px 9px;border-radius:99px;background:#eef1f6;margin:2px 4px 2px 0;font-size:.85rem}
</style>
<main>
<h1>Maid status update</h1>
<p class="muted">Private office tool · ${rows.length} maids · changes are saved to the private records only. The live website changes after the next approved GitHub update.</p>
${msg ? `<div class="ok">${esc(msg)}</div>` : ''}${err ? `<div class="err">${esc(err)}</div>` : ''}
<form class="card" method="post" action="/status">
<input type="hidden" name="token" value="${TOKEN}">
<label for="code">Maid</label>
<select id="code" name="code" required><option value="">Choose a maid…</option>${group('indonesian', 'Indonesian')}${group('filipino', 'Filipino')}</select>
<div class="row">
<div><label for="status">New status</label>
<select id="status" name="status" required>${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}"${sel.status === k ? ' selected' : ''}>${v}${HIDDEN.includes(k) ? ' (removed from listings)' : ''}</option>`).join('')}</select></div>
<div><label for="by">Your initials</label><input id="by" name="by" maxlength="10" required autocomplete="off" value="${esc(sel.by || '')}" placeholder="e.g. NA"></div>
</div>
<label for="note">Note (optional, private)</label><input id="note" name="note" maxlength="200" autocomplete="off" placeholder="e.g. confirmed by phone with supplier">
<button type="submit">Save status</button>
<p class="muted" style="margin:10px 0 0;font-size:.9rem">Choosing the same status again records that you have confirmed it today.</p>
</form>
<form method="post" action="/preview" style="margin-top:12px"><input type="hidden" name="token" value="${TOKEN}">
<button class="secondary" type="submit"${busy ? ' disabled' : ''}>${busy ? 'Updating preview…' : 'Update the private preview site'}</button>
<span class="muted" style="margin-left:8px">then open <a href="http://${HOST}:${REVIEW_PORT}/en/maids/" target="_blank" rel="noopener">http://${HOST}:${REVIEW_PORT}/en/maids/</a></span></form>
<h2>Current totals</h2><p>${Object.entries(counts).map(([k, n]) => `<span class="pill">${STATUS_LABEL[k]}: ${n}</span>`).join('')}</p>
<h2>Recent changes</h2>
${hist.length ? `<table><tr><th>When</th><th>Maid</th><th>Change</th><th>By</th><th>How</th></tr>${hist.map((h) => `<tr><td>${esc(stamp(h.timestamp))}</td><td>${esc(h.maidName)}<br><span class="muted">${esc(h.code)}</span></td><td>${esc(STATUS_LABEL[h.fromStatus] ?? h.fromStatus)} → <b>${esc(STATUS_LABEL[h.toStatus] ?? h.toStatus)}</b>${h.note ? `<br><span class="muted">${esc(h.note)}</span>` : ''}</td><td>${esc(h.updatedBy)}</td><td>${esc(h.method)}</td></tr>`).join('')}</table>` : '<p class="muted">No changes yet.</p>'}
<h2>Same thing by command</h2>
<p><code>npm run maids:status -- REFERENCE_CODE STATUS INITIALS</code><br>
<span class="muted">STATUS = available · interview-pending · reserved · processing · placed · unavailable · withdrawn</span></p>
</main></html>`;
}

const readBody = (req) => new Promise((ok, fail) => {
  let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e5) { req.destroy(); fail(new Error('too large')); } });
  req.on('end', () => ok(Object.fromEntries(new URLSearchParams(b)))); req.on('error', fail);
});
const send = (res, code, html) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY' }); res.end(html); };
const sameOrigin = (req) => { const o = req.headers.origin; return req.headers.host === `${HOST}:${PORT}` && (!o || o === `http://${HOST}:${PORT}`); };

createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) return send(res, 200, page());
    if (req.method !== 'POST' || !sameOrigin(req)) return send(res, 404, 'Not found');
    const f = await readBody(req);
    if (f.token !== TOKEN) return send(res, 403, page({ err: 'This page was open before the tool restarted. Please try again.' }));
    if (req.url === '/status') {
      try {
        const r = await applyStatusChanges([{ code: f.code, status: f.status, by: f.by, note: f.note }], { method: 'staff page' });
        const c = r.changed[0];
        const msg = c ? `Saved: ${c.name} (${c.code}) — ${c.from === c.to ? `${STATUS_LABEL[c.to]}, confirmed today` : `${STATUS_LABEL[c.from]} → ${STATUS_LABEL[c.to]}`}${c.hidden ? '\nThis maid is now removed from the active listings. The private record and history are kept.' : ''}\nPress "Update the private preview site" to see it in the preview.` : `No change: ${f.code} was already recorded as ${STATUS_LABEL[f.status]} by ${f.by} today.`;
        console.log(`[staff page] ${msg.split('\n')[0]}`);
        return send(res, 200, page({ msg, sel: { by: f.by } }));
      } catch (e) { return send(res, 200, page({ err: e.message, sel: f })); }
    }
    if (req.url === '/preview') {
      if (busy) return send(res, 200, page({ msg: 'The preview is already being updated — please wait.' }));
      busy = true;
      try { await preview(); return send(res, 200, page({ msg: `Private preview updated. Open http://${HOST}:${REVIEW_PORT}/en/maids/` })); }
      catch (e) { return send(res, 200, page({ err: `Preview update failed: ${e.message}` })); }
      finally { busy = false; }
    }
    return send(res, 404, 'Not found');
  } catch (e) { send(res, 500, `Error: ${esc(e.message)}`); }
}).listen(PORT, HOST, () => console.log(`Staff page: http://${HOST}:${PORT}  (office PC only — press Ctrl+C to stop)`));

// Private review site (only if nothing else is already serving it on port 4330)
const SITE = join(process.cwd(), 'private-biodata', 'review-site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const review = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let p = normalize(join(SITE, url));
  if (!p.startsWith(SITE)) { res.writeHead(403); return res.end(); }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end(existsSync(join(SITE, '404.html')) ? readFileSync(join(SITE, '404.html')) : 'Not found'); }
  res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(readFileSync(p));
});
review.on('error', () => console.log(`Private review site: already running on http://${HOST}:${REVIEW_PORT}`));
review.listen(REVIEW_PORT, HOST, () => console.log(`Private review site: http://${HOST}:${REVIEW_PORT}`));
