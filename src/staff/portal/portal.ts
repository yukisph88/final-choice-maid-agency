// Final Choice staff portal — start-up: sign-in, password, role, navigation and routing.
// Uses ONLY the public publishable key plus the signed-in person's own session; the database decides what each role may do.
import { createClient } from '@supabase/supabase-js';
import { S, $, $$, esc, toast, initials, canEdit, isAdmin, type Row } from './core';
import { UI, renderEditor } from './editor';
import { renderMaids } from './maids';
import { renderDashboard } from './dashboard';
import { renderPhotos } from './photos';
import { renderAvailability } from './availability';
import { renderPlacements } from './placements';
import { renderApprovals } from './approvals';
import { renderDocuments } from './documents';
import { renderReports } from './reports';
import { renderStaff } from './staff';
import { renderSettings } from './settings';

const IDLE_MINUTES = 60;
interface Nav { id: string; label: string; icon: string; show: () => boolean }
const NAV: Nav[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦', show: () => true },
  { id: 'maids', label: 'All Maid Biodata', icon: '☰', show: () => true },
  { id: 'add', label: 'Add New Maid', icon: '＋', show: () => canEdit() },
  { id: 'photos', label: 'Photo Management', icon: '◧', show: () => true },
  { id: 'availability', label: 'Availability Tracking', icon: '◔', show: () => true },
  { id: 'placements', label: 'Applications & Placements', icon: '⇄', show: () => true },
  { id: 'approvals', label: 'Publication Approvals', icon: '✓', show: () => true },
  { id: 'documents', label: 'Documents', icon: '❏', show: () => true },
  { id: 'reports', label: 'Reports', icon: '▤', show: () => true },
  { id: 'staff', label: 'Staff Management', icon: '☺', show: () => isAdmin() },
  { id: 'settings', label: 'Settings', icon: '⚙', show: () => true },
];
const cfg = $('#cfg').dataset;
let passFromReset = false; let prevHash = '';
let started = false;

function show(view: 'login' | 'denied' | 'app' | 'pass') { for (const v of ['login', 'denied', 'app', 'pass']) $(`#v-${v}`).hidden = v !== view; }

// ---------- start ----------
if (cfg.url && cfg.key) {
  S.sb = createClient(cfg.url, cfg.key, { auth: { persistSession: true, storageKey: 'fc-staff-auth' } });
  S.sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { passFromReset = true; $('#p-cancel').hidden = true; show('pass'); } else if (!session && started) { location.reload(); }
  });
  start();
}
async function start() {
  if (passFromReset) return;
  const { data } = await S.sb.auth.getSession();
  if (!data.session) return show('login');
  const r = await S.sb.rpc('staff_role'); S.role = (r.data as string) || '';
  if (!S.role) return show('denied');
  S.me = (await S.sb.from('staff').select('*').eq('user_id', data.session.user.id).single()).data || { email: data.session.user.email, user_id: data.session.user.id };
  S.loadedMaids = false;
  buildShell(); show('app');
  if (!started) { started = true; idleTimer(); addEventListener('hashchange', onHash); document.addEventListener('fc:profile', buildShell); }
  if (!location.hash.startsWith('#/')) history.replaceState(null, '', '#/dashboard');
  prevHash = location.hash; await route();
}
function idleTimer() {
  let last = Date.now();
  for (const ev of ['click', 'keydown', 'mousemove', 'touchstart']) addEventListener(ev, () => (last = Date.now()), { passive: true });
  setInterval(async () => { if (Date.now() - last > IDLE_MINUTES * 60e3) { await S.sb.auth.signOut(); location.reload(); } }, 60e3);
}

// ---------- shell ----------
function buildShell() {
  const name = S.me.full_name || S.me.email || 'Staff'; const roleLabel = ({ admin: 'Administrator', editor: 'Editor', viewer: 'Viewer' } as Record<string, string>)[S.role] || S.role;
  $('#nav').innerHTML = NAV.filter((n) => n.show()).map((n) => `<a class="nav-a" href="#/${n.id}" data-nav="${n.id}"><span class="nav-i" aria-hidden="true">${n.icon}</span><span>${esc(n.label)}</span></a>`).join('');
  $('#me-av').textContent = initials(name); $('#me-name').textContent = name; $('#me-role').textContent = roleLabel;
  $('#menu-name').textContent = name; $('#menu-mail').textContent = S.me.email || ''; $('#menu-role').textContent = roleLabel;
  highlight();
}
function highlight() {
  const id = (location.hash.replace(/^#\//, '').split('/')[0]) || 'dashboard'; const key = id === 'maid' ? 'maids' : id;
  $$('#nav [data-nav]').forEach((a) => a.classList.toggle('nav-on', a.dataset.nav === key));
}
const closeMenus = () => { $('#menu').hidden = true; $('#side').classList.remove('open'); $('#scrim').hidden = true; $('#me-btn').setAttribute('aria-expanded', 'false'); };
$('#me-btn').addEventListener('click', (e) => { e.stopPropagation(); const open = $('#menu').hidden; $('#menu').hidden = !open; $('#me-btn').setAttribute('aria-expanded', String(open)); });
document.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('#menu, #me-btn')) $('#menu').hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
$('#burger').addEventListener('click', () => { $('#side').classList.add('open'); $('#scrim').hidden = false; });
$('#scrim').addEventListener('click', closeMenus);
$('#nav').addEventListener('click', closeMenus);
$$('[data-signout]').forEach((b) => b.addEventListener('click', async () => { await S.sb.auth.signOut(); location.reload(); }));
$('#menu-settings').addEventListener('click', closeMenus);
$('#menu-pass').addEventListener('click', () => { closeMenus(); location.hash = '#/settings/password'; });

// ---------- routing ----------
function onHash() {
  if (location.hash === prevHash) return;
  if (UI.dirty && !confirm('You have unsaved changes on this page. Leave without saving?')) { const h = prevHash; history.replaceState(null, '', h); return; }
  UI.dirty = false; prevHash = location.hash; route();
}
async function route() {
  const [id, arg] = location.hash.replace(/^#\//, '').split('/'); closeMenus(); highlight();
  try {
    switch (id || 'dashboard') {
      case 'dashboard': return await renderDashboard();
      case 'maids': return await renderMaids();
      case 'maid': return await renderEditor(decodeURIComponent(arg || ''));
      case 'add': if (!canEdit()) return deny(); return await renderEditor();
      case 'photos': return await renderPhotos();
      case 'availability': return await renderAvailability();
      case 'placements': return await renderPlacements();
      case 'approvals': return await renderApprovals();
      case 'documents': return await renderDocuments();
      case 'reports': return await renderReports();
      case 'staff': return await renderStaff();
      case 'settings': return await renderSettings(arg === 'password');
      default: location.hash = '#/dashboard';
    }
  } catch (e) {
    $('#view').innerHTML = `<div class="card pad"><div class="err">Something went wrong: ${esc((e as Error).message)}</div><p><button class="btn" id="retry" type="button">Try again</button></p></div>`;
    document.getElementById('retry')?.addEventListener('click', () => route());
  }
}
function deny() { $('#view').innerHTML = '<div class="card pad"><p>Your role does not allow this page.</p><a class="btn" href="#/dashboard">Back to dashboard</a></div>'; }

// ---------- sign-in / password ----------
$('#f-login').addEventListener('submit', async (e) => {
  e.preventDefault(); const msg = $('#l-msg'); msg.innerHTML = '';
  const { error } = await S.sb.auth.signInWithPassword({ email: $<HTMLInputElement>('#l-email').value.trim(), password: $<HTMLInputElement>('#l-pass').value });
  if (error) { msg.innerHTML = `<div class="err">${esc(error.message === 'Invalid login credentials' ? 'E-mail or password is not correct.' : error.message)}</div>`; return; }
  $<HTMLInputElement>('#l-pass').value = ''; start();
});
$('#f-pass').addEventListener('submit', async (e) => {
  e.preventDefault();
  const a = $<HTMLInputElement>('#p-new').value; const b = $<HTMLInputElement>('#p-new2').value; const msg = $('#p-msg');
  if (a.length < 12) { msg.innerHTML = '<div class="err">Use at least 12 characters.</div>'; return; }
  if (a !== b) { msg.innerHTML = '<div class="err">The two passwords are not the same.</div>'; return; }
  const { error } = await S.sb.auth.updateUser({ password: a });
  if (error) { msg.innerHTML = `<div class="err">${esc(error.message)}</div>`; return; }
  $<HTMLInputElement>('#p-new').value = ''; $<HTMLInputElement>('#p-new2').value = ''; passFromReset = false; history.replaceState(null, '', location.pathname);
  await start(); toast('Password saved.');
});
$('#l-forgot').addEventListener('click', async (e) => {
  e.preventDefault(); const email = $<HTMLInputElement>('#l-email').value.trim();
  if (!email) return ($('#l-msg').innerHTML = '<div class="err">Type your e-mail first.</div>');
  await S.sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
  $('#l-msg').innerHTML = '<div class="ok">If this e-mail belongs to a staff account, a reset link has been sent.</div>';
});
addEventListener('beforeunload', (e) => { if (UI.dirty) { e.preventDefault(); e.returnValue = ''; } });
export type { Row };
