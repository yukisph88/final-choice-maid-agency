#!/usr/bin/env node
// Final Choice — offline security tests for supabase/migrations/0001_maid_database.sql
//   npm run db:test
// Runs the real migration in PGlite (PostgreSQL in WebAssembly, local, free) with a minimal stand-in for
// Supabase's auth schema, then checks every access rule using SYNTHETIC records only (no real maid data).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
let pass = 0; let fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };
const throws = async (name, fn, re) => { try { await fn(); ok(name, false, '(no error)'); } catch (e) { ok(name, !re || re.test(e.message), `(${e.message})`); } };

// --- minimal Supabase stand-in: auth schema, auth.uid(), anon/authenticated roles ---
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
try { await db.exec(readFileSync('supabase/migrations/0001_maid_database.sql', 'utf8')); } catch (e) { console.error('✗ migration failed:', e.message); process.exit(1); }
console.log('Migration applied.\n');

const U = { admin: '00000000-0000-0000-0000-00000000000a', editor: '00000000-0000-0000-0000-00000000000e', viewer: '00000000-0000-0000-0000-00000000000f', stranger: '00000000-0000-0000-0000-000000000099' };
for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users values ($1, $2)', [id, `${k}@test.local`]);
await db.query(`insert into public.staff (user_id, email, role) values ($1,'admin@test.local','admin'), ($2,'editor@test.local','editor'), ($3,'viewer@test.local','viewer')`, [U.admin, U.editor, U.viewer]);

// run as a given user (null = anonymous website visitor)
const as = async (who, sql, params = []) => {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who ? U[who] : '']);
  await db.exec(`set role ${who ? 'authenticated' : 'anon'}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
};
const SK = JSON.stringify({ childcare: 'experienced', newborn: 'none', elderlyCare: 'some-experience', cooking: 'none', housekeeping: 'experienced', petCare: 'none' });

console.log('Editors can add and edit; viewers and strangers cannot');
await as('editor', `insert into public.maids (code, full_name, first_name, nationality, age, religion, skills, summary_en, summary_ms, status_set_by)
  values ('TEST-ID-001','Test Person One','Test','indonesian',30,'TestReligion',$1,'Synthetic EN','Sintetik BM','MGMT'),
         ('TEST-PH-002','Test Person Two','Test','filipino',35,'',$1,'Synthetic EN 2','Sintetik BM 2','MGMT')`, [SK]);
ok('editor inserted 2 synthetic maids', (await as('editor', 'select count(*)::int n from public.maids')).rows[0].n === 2);
await throws('viewer cannot insert', () => as('viewer', `insert into public.maids (code, nationality) values ('TEST-X-003','filipino')`), /row-level security/);
ok('viewer can read all maids', (await as('viewer', 'select count(*)::int n from public.maids')).rows[0].n === 2);
ok('viewer update changes nothing', (await as('viewer', `update public.maids set status='reserved' where code='TEST-ID-001' returning code`)).rows.length === 0);
ok('signed-in non-staff sees no maids', (await as('stranger', 'select count(*)::int n from public.maids')).rows[0].n === 0);
await throws('duplicate reference code rejected', () => as('editor', `insert into public.maids (code, nationality) values ('TEST-ID-001','indonesian')`), /duplicate key|unique/);
await throws('invalid status rejected', () => as('editor', `update public.maids set status='sold' where code='TEST-ID-001'`), /check constraint/);
await throws('lower-case/space code rejected', () => as('editor', `insert into public.maids (code, nationality) values ('bad code','indonesian')`), /check constraint/);

console.log('\nWebsite visitors (anon) never read tables');
await throws('anon cannot select maids', () => as(null, 'select * from public.maids'), /permission denied/);
await throws('anon cannot select history', () => as(null, 'select * from public.maid_history'), /permission denied/);
await throws('anon cannot select staff', () => as(null, 'select * from public.staff'), /permission denied/);
await throws('anon cannot insert maids', () => as(null, `insert into public.maids (code, nationality) values ('TEST-Z-009','filipino')`), /permission denied/);
ok('anon public_maids() is empty before approval', (await as(null, 'select * from public.public_maids()')).rows.length === 0);

console.log('\nPublishing requires recorded consent');
await throws('publish without consent rejected', () => as('editor', `update public.maids set published=true where code='TEST-ID-001'`), /publish_requires_consent/);
await throws('public photo without photo consent rejected', () => as('editor', `update public.maids set consent_recorded=true, consent_date='2026-10-15', approved_by='TT', published=true, public_photo_path='test-id-001.webp' where code='TEST-ID-001'`), /public_photo_requires_consent/);
await as('editor', `update public.maids set consent_recorded=true, consent_date='2026-10-15', approved_by='TT', published=true where code='TEST-ID-001'`);
let pub = (await as(null, 'select * from public.public_maids()')).rows;
ok('anon sees exactly the 1 approved maid', pub.length === 1 && pub[0].code === 'TEST-ID-001');
ok('no name without name consent', pub[0].display_name === null);
ok('age hidden without show_age', pub[0].age === null);
ok('religion hidden without show_religion', pub[0].religion === null);
ok('no photo without photo consent', pub[0].photo_path === null);
ok('public row has no private columns', !('internal_notes' in pub[0]) && !('full_name' in pub[0]) && !('consent_date' in pub[0]));
await as('editor', `update public.maids set name_consent='first', show_age=true, photo_consent=true, public_photo_path='test-id-001.webp' where code='TEST-ID-001'`);
pub = (await as(null, 'select * from public.public_maids()')).rows;
ok('first-name consent shows given name only', pub[0].display_name === 'Test');
ok('age shown with show_age', pub[0].age === 30);
ok('photo shown with photo consent', pub[0].photo_path === 'test-id-001.webp');
await throws('unpublish while public photo still set is rejected (forces photo removal)', () => as('editor', `update public.maids set published=false where code='TEST-ID-001'`), /public_photo_requires_consent/);

console.log('\nLive availability');
await as('editor', `update public.maids set status='reserved', status_set_by='TT', status_confirmed=true where code='TEST-ID-001'`);
let st = (await as(null, 'select * from public.public_maid_status()')).rows;
ok('status change visible to website immediately', st.length === 1 && st[0].status === 'reserved');
await as('editor', `update public.maids set status='placed' where code='TEST-ID-001'`);
ok('placed maid removed from public_maids()', (await as(null, 'select * from public.public_maids()')).rows.length === 0);
ok('placed status still reported so the website can hide the card', (await as(null, 'select status from public.public_maid_status()')).rows[0].status === 'placed');
ok('unpublished maid never in public_maid_status()', !(await as(null, 'select code from public.public_maid_status()')).rows.some((r) => r.code === 'TEST-PH-002'));

console.log('\nHistory');
const h = (await as('viewer', `select action, changes, changed_by_email from public.maid_history where code='TEST-ID-001' order by id`)).rows;
ok('every change logged', h.length >= 5, `(${h.length})`);
ok('status change logged with from/to', h.some((x) => x.changes.status?.from === 'reserved' && x.changes.status?.to === 'placed'));
ok('change logged with editor e-mail', h.every((x) => x.changed_by_email === 'editor@test.local'));
await throws('nobody can edit history', () => as('admin', `update public.maid_history set code='X'`), /row-level security|permission denied/);
ok('nobody can delete history', (await as('admin', `delete from public.maid_history returning id`).catch(() => ({ rows: [] }))).rows.length === 0);

console.log('\nDeleting and staff management');
ok('editor cannot delete', (await as('editor', `delete from public.maids where code='TEST-PH-002' returning code`)).rows.length === 0);
ok('admin can delete', (await as('admin', `delete from public.maids where code='TEST-PH-002' returning code`)).rows.length === 1);
ok('delete logged', (await as('viewer', `select count(*)::int n from public.maid_history where code='TEST-PH-002' and action='delete'`)).rows[0].n === 1);
ok('editor cannot change own role', (await as('editor', `update public.staff set role='admin' where user_id=$1 returning role`, [U.editor])).rows.length === 0);
ok('viewer sees only own staff row', (await as('viewer', 'select count(*)::int n from public.staff')).rows[0].n === 1);
await as('admin', `update public.staff set active=false where user_id=$1`, [U.editor]);
ok('deactivated staff lose access', (await as('editor', 'select count(*)::int n from public.maids')).rows[0].n === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
