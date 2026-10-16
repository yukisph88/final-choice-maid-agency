// Settings: my profile, password, and how this system protects the data.
import { S, esc, mount, setTitle, toast, isAdmin, pill, onClick, type Row } from './core';

export async function renderSettings(passwordOnly = false) {
  setTitle('Settings', 'Your account');
  const role = { admin: 'Administrator', editor: 'Editor', viewer: 'Viewer' }[S.role as string] || S.role;
  const root = mount(`<div class="g2">
    <div class="card pad"><h3 class="sec">My profile</h3><div class="fld"><label>E-mail</label><input value="${esc(S.me.email)}" disabled></div>
      <div class="fld"><label for="nm">Name</label><input id="nm" value="${esc(S.me.full_name || '')}" maxlength="80"></div><p>Role: ${pill(String(role), 'blue')}</p><div id="pmsg"></div><button class="btn" data-act="name" type="button">Save name</button></div>
    <div class="card pad" id="pwcard"><h3 class="sec">Change password</h3><p class="hint">At least 12 characters. Use a password you do not use anywhere else.</p>
      <div class="fld"><label for="p1">New password</label><input id="p1" type="password" autocomplete="new-password"></div><div class="fld"><label for="p2">Repeat new password</label><input id="p2" type="password" autocomplete="new-password"></div>
      <div id="wmsg"></div><button class="btn" data-act="pw" type="button">Save password</button></div></div>
    <div class="card pad"><h3 class="sec">How your data is protected</h3><ul class="plain">
      <li>Maid records, photos and documents are <b>private</b>. They are visible only after you sign in with a staff account.</li>
      <li>Your role decides what you can do. The database enforces it — hiding a button is not the only protection.</li>
      <li>Nothing is shown on the public website until an administrator records the candidate's written consent and publishes.</li>
      <li>Every change to a maid record is kept in her change history with the person and time. Exports are recorded.</li>
      <li>You are signed out automatically after 60 minutes of inactivity. Always sign out on shared computers.</li></ul></div>
    ${isAdmin() ? `<div class="card pad"><h3 class="sec">For administrators</h3><ul class="plain"><li>Take a fresh backup before any large import: <code>npm run db:backup</code> (kept off GitHub, in <code>private-biodata/</code>).</li>
      <li>Staff accounts: <a href="#/staff">Staff Management</a>. Publication: <a href="#/approvals">Publication Approvals</a>.</li><li>The website refreshes daily; availability labels also update live.</li></ul></div>` : ''}`);
  if (passwordOnly) document.getElementById('pwcard')?.scrollIntoView();
  onClick(root, {
    name: async () => { const { error } = await S.sb.rpc('update_my_profile', { p_name: (document.getElementById('nm') as HTMLInputElement).value }); if (error) return (document.getElementById('pmsg')!.innerHTML = `<div class="err">${esc(error.message)}</div>`); S.me.full_name = (document.getElementById('nm') as HTMLInputElement).value.trim(); document.getElementById('pmsg')!.innerHTML = ''; document.dispatchEvent(new Event('fc:profile')); toast('Name saved.'); },
    pw: async () => {
      const a = (document.getElementById('p1') as HTMLInputElement).value; const b = (document.getElementById('p2') as HTMLInputElement).value; const msg = document.getElementById('wmsg')!;
      if (a.length < 12) return (msg.innerHTML = '<div class="err">Use at least 12 characters.</div>'); if (a !== b) return (msg.innerHTML = '<div class="err">The two passwords are not the same.</div>');
      const { error } = await S.sb.auth.updateUser({ password: a }); if (error) return (msg.innerHTML = `<div class="err">${esc(error.message)}</div>`);
      (document.getElementById('p1') as HTMLInputElement).value = ''; (document.getElementById('p2') as HTMLInputElement).value = ''; msg.innerHTML = '<div class="ok">Password saved.</div>'; toast('Password saved.');
    },
  });
}
export type { Row };
