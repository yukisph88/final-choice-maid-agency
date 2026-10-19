#!/usr/bin/env node
// READ-ONLY: compare a record that already exists in the database with the version in private-biodata/import/maids.csv, field by field.
//   npm run db:compare -- CODE        (writes nothing; shows who last edited the database copy)
import { readFileSync } from 'node:fs';
import { adminClient } from './db-lib.mjs';
import { parseCsv, csvRowToDb, COMPARE_FIELDS } from '../src/staff/mapping.js';

const code = (process.argv[2] || '').toUpperCase();
if (!code) { console.error('usage: npm run db:compare -- CODE'); process.exit(1); }
const rows = parseCsv(readFileSync('private-biodata/import/maids.csv', 'utf8').replace(/^﻿/, ''));
const src = rows.find((r) => r.code.toUpperCase() === code); if (!src) { console.error(`${code} is not in maids.csv`); process.exit(1); }
const incoming = csvRowToDb(src);
const db = adminClient();
const { data: cur, error } = await db.from('maids').select('*').eq('code', code).maybeSingle(); if (error) throw error;
if (!cur) { console.log(`${code} is not in the database — it would be added as a new record.`); process.exit(0); }
const { data: hist } = await db.from('maid_history').select('action,changed_by_email,changed_at,changes').eq('maid_id', cur.id).order('changed_at', { ascending: false });
const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
const show = (v) => { const s = v === null || v === undefined || v === '' ? '(empty)' : typeof v === 'object' ? JSON.stringify(v) : String(v); return s.length > 110 ? s.slice(0, 107) + '…' : s; };
console.log(`Record ${code} — database copy created ${cur.created_at}, last updated ${cur.updated_at} (published: ${cur.published}, status: ${cur.status}${cur.status_confirmed ? ', confirmed' : ''}, photo: ${cur.photo_path ? 'yes' : 'no'})`);
console.log(`Change history in the database: ${(hist || []).length} entr${(hist || []).length === 1 ? 'y' : 'ies'}${hist?.length ? ' — last by ' + hist[0].changed_by_email + ' (' + hist[0].action + ') on ' + hist[0].changed_at : ''}\n`);
const fields = [...new Set([...COMPARE_FIELDS, 'status', 'status_confirmed'])].filter((k) => k in incoming || k in cur);
let diffs = 0;
for (const k of fields) {
  if (same(cur[k], incoming[k])) continue; diffs++;
  const dbEmpty = cur[k] === null || cur[k] === undefined || cur[k] === '' || (Array.isArray(cur[k]) && !cur[k].length);
  console.log(`${dbEmpty ? '  fills empty ' : '  DIFFERS     '} ${k}\n      database: ${show(cur[k])}\n      incoming: ${show(incoming[k])}`);
}
console.log(`\n${diffs} field(s) differ. Fields marked "DIFFERS" hold a value in the database that the import would overwrite.`);
