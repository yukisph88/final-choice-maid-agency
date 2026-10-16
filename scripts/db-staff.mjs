#!/usr/bin/env node
// Final Choice — create staff accounts for the staff dashboard (office PC only).
//   npm run db:staff -- add EMAIL "Full Name" admin|editor|viewer     create a login + staff role
//   npm run db:staff -- list                                          show staff accounts
//   npm run db:staff -- deactivate EMAIL                              block an account (keeps the history)
//   npm run db:staff -- reset EMAIL                                   make a new temporary password
//
// A strong random password is generated and saved ONLY in private-biodata/approval/STAFF-LOGINS.txt (excluded from Git).
// It is never printed, e-mailed or sent anywhere. The person must change it at first login (dashboard → "Change password").
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { adminClient } from './db-lib.mjs';

const [cmd, email, name, role] = process.argv.slice(2);
const db = adminClient();
const FILE = 'private-biodata/approval/STAFF-LOGINS.txt';
const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makePassword = () => Array.from({ length: 5 }, () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('')).join('-');
const save = (line) => {
  mkdirSync('private-biodata/approval', { recursive: true });
  if (!existsSync(FILE)) writeFileSync(FILE, 'Final Choice staff logins (PRIVATE — office PC only, never upload). Each person must change the password at first login.\nLogin page: the website address + /staff/\n\n');
  appendFileSync(FILE, line + '\n');
};
const findUser = async (mail) => {
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === mail.toLowerCase());
    if (u || data.users.length < 200) return u;
  }
};

if (cmd === 'list') {
  const { data, error } = await db.from('staff').select('email, full_name, role, active, created_at').order('created_at');
  if (error) { console.error('✗', error.message); process.exit(1); }
  console.table(data.map((s) => ({ email: s.email, name: s.full_name, role: s.role, active: s.active })));
} else if (cmd === 'add') {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '') || !name || !['admin', 'editor', 'viewer'].includes(role)) {
    console.error('Usage: npm run db:staff -- add EMAIL "Full Name" admin|editor|viewer'); process.exit(1);
  }
  if (await findUser(email)) { console.error(`✗ ${email} already has a login. Use "reset" for a new temporary password.`); process.exit(1); }
  const password = makePassword();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) { console.error('✗', error.message); process.exit(1); }
  const r = await db.from('staff').insert({ user_id: data.user.id, email, full_name: name, role, active: true });
  if (r.error) { await db.auth.admin.deleteUser(data.user.id); console.error('✗', r.error.message); process.exit(1); }
  save(`${new Date().toISOString().slice(0, 16)}  ${role.padEnd(6)}  ${email}  temporary password: ${password}`);
  console.log(`✓ ${role} account created for ${email}. The temporary password is saved in ${FILE} (not shown here).`);
} else if (cmd === 'reset') {
  const u = email && (await findUser(email));
  if (!u) { console.error('✗ No such login.'); process.exit(1); }
  const password = makePassword();
  const { error } = await db.auth.admin.updateUserById(u.id, { password });
  if (error) { console.error('✗', error.message); process.exit(1); }
  save(`${new Date().toISOString().slice(0, 16)}  RESET   ${email}  temporary password: ${password}`);
  console.log(`✓ New temporary password for ${email} saved in ${FILE} (not shown here).`);
} else if (cmd === 'deactivate') {
  const { error } = await db.from('staff').update({ active: false }).eq('email', email);
  if (error) { console.error('✗', error.message); process.exit(1); }
  console.log(`✓ ${email} can no longer use the dashboard.`);
} else {
  console.error('Usage: npm run db:staff -- add|list|reset|deactivate …'); process.exit(1);
}
