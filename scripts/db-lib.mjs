// Shared helpers for the office-PC database scripts (db-migrate, db-backup, db-restore, db-check).
// The SERVICE ROLE key is read from .env.local on this PC only. It bypasses all security rules, so it must
// never be put in website code, GitHub, e-mail or chat. (.env.local is excluded from Git by .gitignore.)
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

export function loadEnv() {
  const env = { ...process.env };
  if (existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  // Safety: the PUBLIC key slot must never hold a secret key (it would end up in the website)
  const pub = env.PUBLIC_SUPABASE_ANON_KEY || '';
  let jwtRole = '';
  try { if (pub.startsWith('eyJ')) jwtRole = JSON.parse(Buffer.from(pub.split('.')[1], 'base64url').toString()).role; } catch { /* not a JWT */ }
  if (pub.startsWith('sb_secret_') || jwtRole === 'service_role') {
    console.error('✗ STOP: PUBLIC_SUPABASE_ANON_KEY in .env.local contains a SECRET key. Put the Publishable/anon key there,\n  and the Secret/service_role key only in SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  return env;
}

export function adminClient() {
  const env = loadEnv();
  const url = env.PUBLIC_SUPABASE_URL; const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('✗ Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local (see .env.example).');
    process.exit(1);
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) { console.error('✗ PUBLIC_SUPABASE_URL should look like https://xxxx.supabase.co'); process.exit(1); }
  return createClient(url.replace(/\/$/, ''), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient() {
  const env = loadEnv();
  if (!env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_ANON_KEY) { console.error('✗ Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY in .env.local'); process.exit(1); }
  return createClient(env.PUBLIC_SUPABASE_URL.replace(/\/$/, ''), env.PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

/** Read every row of a table in pages (Supabase returns max 1000 rows per request). */
export async function readAll(db, table, order = 'id') {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select('*').order(order).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

export async function listAll(db, bucket, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`${bucket}: ${error.message}`);
    for (const f of data) {
      if (f.id === null) out.push(...(await listAll(db, bucket, prefix ? `${prefix}/${f.name}` : f.name)));
      else out.push({ path: prefix ? `${prefix}/${f.name}` : f.name, size: f.metadata?.size ?? 0 });
    }
    if (data.length < 1000) return out;
  }
}

export const stamp = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16).replace(/[:T]/g, '-'); // Malaysia time
