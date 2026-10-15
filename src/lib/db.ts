// Supabase connection for the PUBLIC website. Only the public "anon" key is used here: it can call
// public_maids() / public_maid_status() and nothing else (enforced by Row Level Security in the database).
// The service-role key is never imported anywhere under src/.
export const DB_URL = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
export const DB_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';
export const DB_ENABLED = Boolean(DB_URL && DB_KEY);
/** Build maid profiles from the database instead of src/content/maids (switch: PUBLIC_MAIDS_SOURCE=supabase). */
export const DB_SOURCE = DB_ENABLED && import.meta.env.PUBLIC_MAIDS_SOURCE === 'supabase';

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
    headers: { apikey: DB_KEY, Authorization: `Bearer ${DB_KEY}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`Supabase public_maids() failed: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}
