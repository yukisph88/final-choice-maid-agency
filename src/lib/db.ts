// Supabase connection for the PUBLIC website. Only the public "anon" key is used here: it can call
// public_maids() / public_maid_status() and nothing else (enforced by Row Level Security in the database).
// The service-role key is never imported anywhere under src/.
export const DB_URL = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
export const DB_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';
export const DB_ENABLED = Boolean(DB_URL && DB_KEY);
/** Build maid profiles from the database instead of src/content/maids (switch: PUBLIC_MAIDS_SOURCE=supabase). */
export const DB_SOURCE = DB_ENABLED && import.meta.env.PUBLIC_MAIDS_SOURCE === 'supabase';

/**
 * HYBRID mode: profiles, photos and PDFs stay in the GitHub files; only the live AVAILABILITY comes from the database, through
 * public_site_status() (migration 0006: reference code + confirmed status + verification time, only for codes already on the website).
 * Switch: PUBLIC_LIVE_STATUS=true. It never replaces the file-based directory, and a failed or empty answer never hides anyone.
 */
export const LIVE_STATUS = DB_ENABLED && !DB_SOURCE && import.meta.env.PUBLIC_LIVE_STATUS === 'true';
export interface SiteStatusRow { code: string; status: string; verified_at: string | null }
/** Build time (optional): confirmed statuses by reference code. ANY problem returns an empty map — the build never fails and nobody is hidden because of it. */
export async function fetchSiteStatus(): Promise<Map<string, SiteStatusRow>> {
  try {
    const res = await fetch(`${DB_URL}/rest/v1/rpc/public_site_status`, { method: 'POST', headers: dbHeaders(), body: '{}', signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as SiteStatusRow[];
    if (!Array.isArray(rows)) throw new Error('unexpected answer');
    return new Map(rows.filter((r) => r && typeof r.code === 'string' && typeof r.status === 'string').map((r) => [r.code.toUpperCase(), r]));
  } catch (e) {
    console.warn(`[live status] not applied at build time (${(e as Error).message}); the pages keep their file-based status`);
    return new Map();
  }
}

/** New "sb_publishable_" keys go in the apikey header only; legacy JWT "anon" keys also as a Bearer token. */
export const dbHeaders = (): Record<string, string> => ({
  apikey: DB_KEY, 'Content-Type': 'application/json', ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}),
});

export const publicPhotoUrl = (path: string) => `${DB_URL}/storage/v1/object/public/maid-public/${encodeURIComponent(path)}`;

export interface PublicMaidRow {
  code: string; display_name: string | null; nationality: 'indonesian' | 'filipino'; age: number | null; religion: string | null; marital_status: string | null;
  experience_years: number | null; overseas_experience: boolean; skills: Record<string, string>; languages: { language: string; level?: string }[];
  employment_history: { country: string; duration: string; duties: string; duties_ms?: string }[];
  summary_en: string; summary_ms: string; interview_availability_en: string; interview_availability_ms: string;
  status: string; status_updated_at: string; status_recorded: boolean; featured: boolean; photo_path: string | null;
}

/** Called at BUILD time. A failure stops the build, so the live site keeps its previous version. */
export async function fetchPublicMaids(): Promise<PublicMaidRow[]> {
  const res = await fetch(`${DB_URL}/rest/v1/rpc/public_maids`, {
    method: 'POST',
    headers: dbHeaders(),
    body: '{}',
  });
  if (!res.ok) throw new Error(`Supabase public_maids() failed: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}
