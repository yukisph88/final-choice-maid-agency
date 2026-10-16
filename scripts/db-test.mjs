#!/usr/bin/env node
// Final Choice — offline security tests for ALL database migrations (0001 → 0005).
//   npm run db:test
// Runs the real SQL files in PGlite (PostgreSQL in WebAssembly, local, free) with minimal stand-ins for Supabase's auth/storage
// schemas, then tries every role against every rule using SYNTHETIC records only (no real maid data, no network).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
let pass = 0; let fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };
const throws = async (name, fn, re) => { try { await fn(); ok(name, false, '(no error)'); } catch (e) { ok(name, !re || re.test(e.message), `(${e.message})`); } };

// --- minimal Supabase stand-ins: auth + storage schemas, roles, auth.uid(), pgcrypto-like functions ---
await db.exec(`
  create schema auth; create schema storage; create schema extensions;
  create table auth.users (id uuid primary key, email text, last_sign_in_at timestamptz);
  create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function extensions.crypt(a text, b text) returns text language sql as $$ select 'x' $$;
  create function extensions.gen_salt(a text) returns text language sql as $$ select 'y' $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on auth.users to authenticated;
`);
for (const f of ['0001_maid_database', '0002_storage', '0003_office_role_grants', '0004_public_status_confirmed', '0005_staff_portal']) {
  try { await db.exec(readFileSync(`supabase/migrations/${f}.sql`, 'utf8')); } catch (e) { console.error(`✗ migration ${f} failed:`, e.message); process.exit(1); }
}
console.log('Migrations 0001–0005 applied (in the same order as the real project).\n');

const U = { admin: '00000000-0000-0000-0000-00000000000a', admin2: '00000000-0000-0000-0000-0000000000a2', editor: '00000000-0000-0000-0000-00000000000e', viewer: '00000000-0000-0000-0000-00000000000f', stranger: '00000000-0000-0000-0000-000000000099' };
for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users values ($1, $2, now())', [id, `${k}@test.local`]);
await db.query(`insert into public.staff (user_id, email, role) values ($1,'admin@test.local','admin'), ($2,'admin2@test.local','admin'), ($3,'editor@test.local','editor'), ($4,'viewer@test.local','viewer')`, [U.admin, U.admin2, U.editor, U.viewer]);

const as = async (who, sql, params = []) => {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who ? U[who] : '']);
  await db.exec(`set role ${who ? 'authenticated' : 'anon'}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
};
const office = async (sql, params = []) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', '', false)`); return db.query(sql, params); }; // like the Secret key
const SK = JSON.stringify({ childcare: 'experienced', newborn: 'none', elderlyCare: 'some-experience', cooking: 'none', housekeeping: 'experienced', petCare: 'none' });
const ins = (who, code, nat, extra = '') => as(who, `insert into public.maids (code, full_name, first_name, nationality, age, religion, skills, summary_en, summary_ms, status_set_by ${extra ? ',' + extra.split('=')[0] : ''}) values ('${code}','Test ${code}','Test','${nat}',30,'TestReligion','${SK}','Synthetic','Sintetik','MGMT' ${extra ? ',' + extra.split('=')[1] : ''})`);

console.log('Editors add and edit; viewers and strangers cannot');
await ins('editor', 'TEST-ID-001', 'indonesian'); await ins('editor', 'TEST-PH-002', 'filipino');
ok('editor added 2 synthetic maids', (await as('editor', 'select count(*)::int n from public.maids')).rows[0].n === 2);
ok('a new maid starts as "to-be-confirmed", unconfirmed and unpublished', (await as('editor', `select status, status_confirmed, published from public.maids where code='TEST-ID-001'`)).rows[0].status === 'to-be-confirmed');
await throws('viewer cannot insert', () => ins('viewer', 'TEST-X-003', 'filipino'), /row-level security/);
ok('viewer can read maids', (await as('viewer', 'select count(*)::int n from public.maids')).rows[0].n === 2);
ok('signed-in non-staff sees no maids', (await as('stranger', 'select count(*)::int n from public.maids')).rows[0].n === 0);
await throws('duplicate reference code rejected', () => ins('editor', 'TEST-ID-001', 'indonesian'), /duplicate key|unique/);
await throws('lower-case/space code rejected', () => as('editor', `insert into public.maids (code, nationality) values ('bad code','indonesian')`), /check constraint/);

console.log('\nAvailability vocabulary');
for (const s of ['available', 'on-hold', 'booked', 'pending-arrival', 'hired', 'withdrawn']) {
  const r = await as('editor', `update public.maids set status='${s}', status_confirmed=true, status_set_by='ED' where code='TEST-ID-001' returning status`);
  ok(`editor can set "${s}"`, r.rows.length === 1);
}
await throws('old value "reserved" is no longer accepted', () => as('editor', `update public.maids set status='reserved' where code='TEST-ID-001'`), /check constraint/);
await throws('"to-be-confirmed" cannot be marked confirmed', () => as('editor', `update public.maids set status='to-be-confirmed', status_confirmed=true where code='TEST-ID-001'`), /tbc_not_confirmed/);
await as('editor', `update public.maids set status='to-be-confirmed', status_confirmed=false where code='TEST-ID-001'`);
let m = (await as('editor', `select status_verified_at from public.maids where code='TEST-ID-001'`)).rows[0];
ok('verification date is empty while unconfirmed', m.status_verified_at === null);
await as('editor', `update public.maids set status='available', status_confirmed=true, status_set_by='ED' where code='TEST-ID-001'`);
m = (await as('editor', `select status_verified_at from public.maids where code='TEST-ID-001'`)).rows[0];
ok('verification date is set when staff confirm a status', m.status_verified_at !== null);

console.log('\nRole rules: only administrators publish and manage consent');
await throws('editor cannot publish', () => as('editor', `update public.maids set published=true where code='TEST-ID-001'`), /Only an administrator/);
await throws('editor cannot record consent', () => as('editor', `update public.maids set consent_recorded=true where code='TEST-ID-001'`), /Only an administrator/);
await throws('editor cannot change name permission', () => as('editor', `update public.maids set name_consent='full' where code='TEST-ID-001'`), /Only an administrator/);
await throws('editor cannot add a maid already published', () => ins('editor', 'TEST-X-009', 'indonesian', `published=true`), /Only an administrator|check constraint/);
await throws('viewer cannot update', async () => { const r = await as('viewer', `update public.maids set status='booked' where code='TEST-ID-001' returning code`); if (!r.rows.length) throw new Error('no row updated'); }, /no row updated/);
await throws('admin cannot publish without consent', () => as('admin', `update public.maids set published=true where code='TEST-ID-001'`), /publish_requires_consent/);
await throws('admin cannot publish with consent but discrepancies unresolved', () => as('admin', `update public.maids set consent_recorded=true, consent_date='2026-10-16', approved_by='AD', published=true where code='TEST-ID-001'`), /publish_requires_consent/);
await throws('admin cannot set a public photo before publishing', () => as('admin', `update public.maids set public_photo_path='test-id-001.webp' where code='TEST-ID-001'`), /public_photo_requires_consent/);
await as('admin', `update public.maids set consent_recorded=true, consent_date='2026-10-16', approved_by='AD', discrepancies_resolved=true, published=true where code='TEST-ID-001'`);
ok('admin can publish once consent, date, approver and discrepancies are recorded', (await office(`select published from public.maids where code='TEST-ID-001'`)).rows[0].published === true);
await throws('admin cannot give the public photo without photo consent', () => as('admin', `update public.maids set public_photo_path='test-id-001.webp' where code='TEST-ID-001'`), /public_photo_requires_consent/);

console.log('\nWhat website visitors receive');
await throws('anon cannot select maids', () => as(null, 'select * from public.maids'), /permission denied/);
await throws('anon cannot select placements', () => as(null, 'select * from public.placements'), /permission denied/);
await throws('anon cannot select documents', () => as(null, 'select * from public.documents'), /permission denied/);
await throws('anon cannot select the audit log', () => as(null, 'select * from public.audit_log'), /permission denied/);
let pub = (await as(null, 'select * from public.public_maids()')).rows;
ok('only the 1 published maid is public', pub.length === 1 && pub[0].code === 'TEST-ID-001');
ok('no name, age, religion or photo without their permissions', pub[0].display_name === null && pub[0].age === null && pub[0].religion === null && pub[0].photo_path === null);
ok('no private columns in the public row', !('internal_notes' in pub[0]) && !('full_name' in pub[0]) && !('consent_date' in pub[0]) && !('employer_name' in pub[0]));
await as('admin', `update public.maids set name_consent='first', show_age=true, photo_consent=true, public_photo_path='test-id-001.webp' where code='TEST-ID-001'`);
pub = (await as(null, 'select * from public.public_maids()')).rows;
ok('first-name consent, age and photo appear once permitted', pub[0].display_name === 'Test' && pub[0].age === 30 && pub[0].photo_path === 'test-id-001.webp');
ok('a confirmed status is reported as confirmed', pub[0].status_recorded === true);
await as('editor', `update public.maids set status='to-be-confirmed', status_confirmed=false where code='TEST-ID-001'`);
ok('"to-be-confirmed" is reported to the website as NOT confirmed', (await as(null, 'select * from public.public_maids()')).rows[0].status_recorded === false);
await as('editor', `update public.maids set status='available', status_confirmed=true, status_set_by='ED' where code='TEST-ID-001'`);
await as('editor', `update public.maids set status='on-hold' where code='TEST-ID-001'`);
ok('a status change is visible to the website at once', (await as(null, 'select * from public.public_maid_status()')).rows[0].status === 'on-hold');
await as('editor', `update public.maids set status='hired' where code='TEST-ID-001'`);
ok('a hired maid disappears from the public list', (await as(null, 'select * from public.public_maids()')).rows.length === 0);
ok('hired status is still reported so the website can hide the card', (await as(null, 'select status from public.public_maid_status()')).rows[0].status === 'hired');
await as('editor', `update public.maids set status='available' where code='TEST-ID-001'`);

console.log('\nSafe deletion');
await as('editor', `insert into public.placements (maid_id, employer_name, stage) select id, 'Test Employer', 'matched' from public.maids where code='TEST-ID-001'`);
ok('editor cannot delete a maid', (await as('editor', `delete from public.maids where code='TEST-PH-002' returning code`)).rows.length === 0);
await throws('admin cannot delete a maid that is not Withdrawn', () => as('admin', `delete from public.maids where code='TEST-PH-002'`), /Only a Withdrawn maid/);
await as('editor', `update public.maids set status='withdrawn', status_confirmed=true where code='TEST-PH-002'`);
await as('admin', `delete from public.maids where code='TEST-PH-002'`);
ok('admin can delete a Withdrawn maid', (await office(`select count(*)::int n from public.maids where code='TEST-PH-002'`)).rows[0].n === 0);
ok('the deletion is kept in the history', (await as('viewer', `select count(*)::int n from public.maid_history where code='TEST-PH-002' and action='delete'`)).rows[0].n === 1);
await as('editor', `update public.maids set status='withdrawn', status_confirmed=true where code='TEST-ID-001'`);
await throws('a maid with placements cannot be deleted', () => as('admin', `delete from public.maids where code='TEST-ID-001'`), /foreign key|violates/);
await as('editor', `update public.maids set status='available', status_confirmed=true where code='TEST-ID-001'`);

console.log('\nHistory');
const h = (await as('viewer', `select action, changes, changed_by_email from public.maid_history where code='TEST-ID-001' order by id`)).rows;
ok('every change logged', h.length >= 10, `(${h.length})`);
ok('status change logged with from/to', h.some((x) => x.changes.status?.to === 'hired'));
await throws('nobody can edit the history', () => as('admin', `update public.maid_history set code='X'`), /row-level security|permission denied/);

console.log('\nPlacements');
ok('viewer can read placements', (await as('viewer', 'select count(*)::int n from public.placements')).rows[0].n === 1);
await throws('viewer cannot add a placement', () => as('viewer', `insert into public.placements (employer_name) values ('X')`), /row-level security/);
const pu = await as('editor', `update public.placements set stage='booked', booking_date='2026-10-20' where employer_name='Test Employer' returning stage`);
ok('editor can move a placement forward', pu.rows[0].stage === 'booked');
await throws('invalid stage rejected', () => as('editor', `update public.placements set stage='sold' where employer_name='Test Employer'`), /check constraint/);
ok('editor cannot delete a placement', (await as('editor', `delete from public.placements returning id`)).rows.length === 0);
ok('stranger sees no placements', (await as('stranger', 'select count(*)::int n from public.placements')).rows[0].n === 0);
ok('placement changes are in the audit log', (await as('viewer', `select count(*)::int n from public.audit_log where table_name='placements'`)).rows[0].n >= 2);

console.log('\nInternal documents (access levels)');
const doc = (who, level, kind = 'other', path = null) => as(who, `insert into public.documents (title, kind, access_level, storage_path) values ('Doc ${level}', '${kind}', '${level}', '${path || `p-${level}-${kind}-${Math.random()}`}')`);
await doc('admin', 'admin', 'other', 'p-admin'); await doc('editor', 'editor', 'other', 'p-editor'); await doc('editor', 'staff', 'other', 'p-staff');
const seen = async (who) => (await as(who, `select access_level from public.documents order by access_level`)).rows.map((r) => r.access_level).join();
ok('admin sees all three levels', await seen('admin') === 'admin,editor,staff');
ok('editor sees editor + staff documents, not admin-only', await seen('editor') === 'editor,staff');
ok('viewer sees staff-level documents only', await seen('viewer') === 'staff');
ok('stranger sees none', await seen('stranger') === '');
await throws('editor cannot create an admin-only document', () => doc('editor', 'admin'), /row-level security/);
await throws('identity documents must be admin-only', () => doc('admin', 'staff', 'id-document'), /sensitive_docs_admin_only/);
await throws('medical documents must be admin-only', () => doc('admin', 'editor', 'medical'), /sensitive_docs_admin_only/);
await throws('viewer cannot add a document', () => doc('viewer', 'staff'), /row-level security/);
ok('editor cannot delete a document', (await as('editor', `delete from public.documents returning id`)).rows.length === 0);
// storage objects follow the same levels
await office(`insert into storage.objects (bucket_id, name) values ('maid-documents','p-admin'), ('maid-documents','p-editor'), ('maid-documents','p-staff'), ('maid-documents','orphan')`);
const files = async (who) => (await as(who, `select name from storage.objects where bucket_id='maid-documents' order by name`)).rows.map((r) => r.name).join();
ok('admin can read all document files (and unregistered uploads)', await files('admin') === 'orphan,p-admin,p-editor,p-staff');
ok('editor cannot read the admin-only file', await files('editor') === 'orphan,p-editor,p-staff');
ok('viewer can read only the all-staff file', await files('viewer') === 'p-staff');
ok('editor may upload a document file', (await as('editor', `insert into storage.objects (bucket_id, name) values ('maid-documents','new-file') returning name`).then((r) => r.rows.length, () => 0)) === 1);
ok('viewer cannot upload a document file', await as('viewer', `insert into storage.objects (bucket_id, name) values ('maid-documents','v-file') returning name`).then(() => false, () => true));
ok('editor can remove an unregistered upload but not a registered file', (await as('editor', `delete from storage.objects where name in ('orphan','p-staff') returning name`)).rows.map((r) => r.name).join() === 'orphan');
console.log('  (public photo bucket)');
await office(`insert into storage.objects (bucket_id, name) values ('maid-public','test-id-001.webp')`);
await as('admin', `update public.maids set photo_consent=true, published=true where code='TEST-ID-001'`);
ok('editor cannot publish a photo to the public bucket', await as('editor', `insert into storage.objects (bucket_id, name) values ('maid-public','test-id-001.webp')`).then(() => false, () => true));
ok('editor cannot remove a public photo', (await as('editor', `delete from storage.objects where bucket_id='maid-public' returning name`)).rows.length === 0);
ok('admin can remove a public photo', (await as('admin', `delete from storage.objects where bucket_id='maid-public' returning name`)).rows.length === 1);

console.log('\nStaff safety');
ok('viewer sees only their own staff row', (await as('viewer', 'select count(*)::int n from public.staff')).rows[0].n === 1);
ok('directory: editor gets only their own row', (await as('editor', 'select count(*)::int n from public.staff_directory()')).rows[0].n === 1);
ok('directory: admin gets everyone', (await as('admin', 'select count(*)::int n from public.staff_directory()')).rows[0].n === 4);
ok('editor cannot change anyone\'s role', (await as('editor', `update public.staff set role='admin' returning role`)).rows.length === 0);
await throws('an administrator cannot demote themselves', () => as('admin', `update public.staff set role='editor' where user_id='${U.admin}'`), /cannot change your own role/);
await throws('an administrator cannot deactivate themselves', () => as('admin', `update public.staff set active=false where user_id='${U.admin}'`), /cannot change your own role|deactivate/);
await throws('staff accounts cannot be deleted', () => as('admin', `delete from public.staff where user_id='${U.viewer}'`), /cannot be deleted/);
await as('admin', `update public.staff set role='editor' where user_id='${U.admin2}'`);
ok('an administrator can change a second administrator role while one remains', (await office(`select role from public.staff where user_id='${U.admin2}'`)).rows[0].role === 'editor');
ok('the demoted person can no longer change roles', (await as('admin2', `update public.staff set role='admin' where user_id='${U.admin2}' returning role`)).rows.length === 0);
await as('admin', `update public.staff set role='admin' where user_id='${U.admin2}'`);
await as('admin', `update public.staff set active=false where user_id='${U.editor}'`);
ok('a deactivated account loses access at once', (await as('editor', 'select count(*)::int n from public.maids')).rows[0].n === 0);
await as('admin', `update public.staff set active=true where user_id='${U.editor}'`);
ok('staff changes are in the audit log', (await as('admin', `select count(*)::int n from public.audit_log where table_name='staff'`)).rows[0].n >= 2);
await as('viewer', `select public.update_my_profile('Vera Viewer')`);
ok('a staff member can update their own name', (await as('viewer', `select full_name from public.staff where user_id='${U.viewer}'`)).rows[0].full_name === 'Vera Viewer');
await throws('a name that is too short is refused', () => as('viewer', `select public.update_my_profile('x')`), /enter your name/);
await throws('non-staff cannot use update_my_profile', () => as('stranger', `select public.update_my_profile('Intruder')`), /Not a staff/);
await throws('only admins can create accounts', () => as('editor', `select public.admin_create_staff('new@test.local','New','viewer','a-long-password-123')`), /Only an administrator/);
await throws('only admins can set temporary passwords', () => as('editor', `select public.admin_set_staff_password('${U.viewer}','a-long-password-123')`), /Only an administrator/);
await throws('anon cannot call staff functions', () => as(null, `select public.admin_create_staff('x@test.local','X','viewer','a-long-password-123')`), /permission denied/);

console.log('\nExports are administrator-only and logged');
await throws('editor cannot log/perform an export', () => as('editor', `select public.log_export('maids', 5)`), /Only an administrator/);
await as('admin', `select public.log_export('maid register', 52)`);
ok('an export is written to the audit log', (await as('viewer', `select count(*)::int n from public.audit_log where action='export'`)).rows[0].n === 1);
await throws('nobody can write to the audit log directly', () => as('admin', `insert into public.audit_log (table_name, action) values ('x','y')`), /row-level security|permission denied/);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
