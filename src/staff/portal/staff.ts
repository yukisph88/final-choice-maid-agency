// Staff Management (administrators only): accounts and roles. Passwords are never shown to anyone except as a
// one-time temporary password the administrator hands over; staff set their own password at first sign-in.
import { S, esc, mount, setTitle, toast, ask, isAdmin, pill, fmtDT, onClick, dialog, historyTable, type Row } from './core';

const ROLES: [string, string, string][] = [['admin', 'Administrator', 'Everything: publish, delete, export, staff accounts'], ['editor', 'Editor', 'Biodata, photos, availability, placements, documents — never publication or consent'], ['viewer', 'Viewer', 'Read-only']];
const tempPassword = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; const r = crypto.getRandomValues(new Uint32Array(16)); return [...r].map((x) => a[x % a.length]).join('') + '-7'; };

export async function renderStaff() {
  setTitle('Staff Management', 'Accounts and roles');
  if (!isAdmin()) { mount('<div class="card pad"><p>Only administrators can manage staff accounts. You can change your own name and password under <a href="#/settings">Settings</a>.</p></div>'); return; }
  const { data, error } = await S.sb.rpc('staff_directory'); if (error) { mount(`<div class="err">${esc(error.message)}</div>`); return; }
  const list = data as Row[];
  const root = mount(`
    <div class="note">Staff sign in with their own e-mail and password. Every change is recorded. You cannot change your own role or deactivate yourself, and at least one administrator must always remain. Accounts are deactivated, never deleted, so the history stays intact.</div>
    <div class="actions-bar"><button class="btn" data-act="add" type="button">+ Add staff member</button></div>
    <div class="card"><div class="tbl-wrap"><table class="tbl"><tr><th>Name</th><th>E-mail</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr>${list.map((s) => `<tr><td class="strong">${esc(s.full_name || '—')}${s.user_id === S.me.user_id ? ' <span class="hint">(you)</span>' : ''}</td><td>${esc(s.email)}</td>
      <td>${s.user_id === S.me.user_id ? pill(ROLES.find((r) => r[0] === s.role)![1], 'blue') : `<select data-role="${esc(s.user_id)}" aria-label="Role">${ROLES.map(([k, l]) => `<option value="${k}"${k === s.role ? ' selected' : ''}>${l}</option>`).join('')}</select>`}</td>
      <td>${s.active ? pill('Active', 'ok') : pill('Deactivated', 'grey')}</td><td class="hint nw">${fmtDT(s.last_sign_in_at)}</td>
      <td class="nw">${s.user_id === S.me.user_id ? '' : `<button class="btn btn--ghost btn--sm" data-act="pw" data-id="${esc(s.user_id)}" data-email="${esc(s.email)}" type="button">Temporary password</button> <button class="btn btn--sm ${s.active ? 'btn--danger' : 'btn--ghost'}" data-act="toggle" data-id="${esc(s.user_id)}" data-active="${s.active}" type="button">${s.active ? 'Deactivate' : 'Reactivate'}</button>`}</td></tr>`).join('')}</table></div></div>
    <h3 class="sec">Roles</h3><div class="tbl-wrap"><table class="tbl"><tr><th>Role</th><th>Can do</th></tr>${ROLES.map(([, l, d]) => `<tr><td class="strong">${l}</td><td>${d}</td></tr>`).join('')}</table></div>
    <h3 class="sec">Staff changes</h3><div id="hist"><p class="hint">Loading…</p></div>`);
  S.sb.from('audit_log').select('*').eq('table_name', 'staff').order('at', { ascending: false }).limit(40).then(({ data: h }) => { const el = document.getElementById('hist'); if (el) el.innerHTML = historyTable(h || [], { showRecord: true }); });
  root.addEventListener('change', async (e) => {
    const t = e.target as HTMLSelectElement; if (!t.dataset.role) return;
    const { error: er } = await S.sb.from('staff').update({ role: t.value }).eq('user_id', t.dataset.role);
    if (er) { toast(er.message, 'err'); return renderStaff(); } toast('Role updated.');
  });
  const showPassword = (email: string, pw: string) => {
    const d = dialog({ title: 'Temporary password', body: `<p>Give this to <b>${esc(email)}</b> in person or by phone. It is shown <b>only now</b>. They should change it under Settings after signing in.</p><p class="pwbox">${esc(pw)}</p>`, foot: '<button class="btn" data-ok type="button">Done</button>' });
    d.q('[data-ok]').addEventListener('click', () => d.close());
  };
  onClick(root, {
    add: () => {
      const d = dialog({ title: 'Add staff member', body: `<div class="g2"><div class="fld"><label>Full name *</label><input data-n></div><div class="fld"><label>E-mail *</label><input type="email" data-e></div>
        <div class="fld"><label>Role</label><select data-r>${ROLES.map(([k, l]) => `<option value="${k}"${k === 'editor' ? ' selected' : ''}>${l}</option>`).join('')}</select></div></div><p class="hint">A temporary password is created for you to hand over.</p><div data-msg></div>`,
        foot: '<button class="btn btn--ghost" data-no type="button">Cancel</button><button class="btn" data-go type="button">Create account</button>' });
      d.q('[data-no]').addEventListener('click', () => d.close());
      d.q('[data-go]').addEventListener('click', async () => {
        const pw = tempPassword(); const email = d.q<HTMLInputElement>('[data-e]').value.trim();
        const { error: er } = await S.sb.rpc('admin_create_staff', { p_email: email, p_name: d.q<HTMLInputElement>('[data-n]').value, p_role: d.q<HTMLSelectElement>('[data-r]').value, p_password: pw });
        if (er) return (d.q('[data-msg]').innerHTML = `<div class="err">${esc(er.message)}</div>`);
        d.close(); showPassword(email, pw); toast('Account created.'); renderStaff();
      });
    },
    pw: async (b) => { if (!(await ask(`Set a new temporary password for ${b.dataset.email}? They are signed out everywhere.`, { ok: 'Set password' }))) return; const pw = tempPassword(); const { error: er } = await S.sb.rpc('admin_set_staff_password', { p_user_id: b.dataset.id, p_password: pw }); if (er) return toast(er.message, 'err'); showPassword(b.dataset.email!, pw); },
    toggle: async (b) => { const on = b.dataset.active === 'true'; if (!(await ask(on ? 'Deactivate this account? They can no longer sign in or see any data.' : 'Reactivate this account?', { ok: on ? 'Deactivate' : 'Reactivate', danger: on }))) return; const { error: er } = await S.sb.from('staff').update({ active: !on }).eq('user_id', b.dataset.id); if (er) return toast(er.message, 'err'); toast(on ? 'Account deactivated.' : 'Account reactivated.'); renderStaff(); },
  });
}
