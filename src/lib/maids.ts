import { getCollection, type CollectionEntry } from 'astro:content';
import { t } from '../i18n/ui';
import type { Lang } from '../i18n/routes';

// One shared record per candidate. Both language versions read exactly the same data
// (code, status, photo, skills), so English and Bahasa Melayu pages cannot disagree.
export type Maid = CollectionEntry<'maids'>['data'] & { slug: string; summary: string; demo: boolean };

export const DEMO = import.meta.env.PUBLIC_DEMO_CANDIDATES === 'true';
/** Local, private review of unpublished drafts (never deployed). Consent is not required in this mode. */
export const REVIEW = import.meta.env.PUBLIC_REVIEW_MODE === 'true';

/** Statuses that are never shown publicly, even if a record is still marked published. */
export const HIDDEN_STATUSES: Maid['status'][] = ['placed', 'unavailable', 'withdrawn'];

/**
 * Candidates that may appear publicly: published, consent recorded, and an active status
 * (available, interview pending, reserved or processing). Everything else is excluded from
 * pages, listings and the sitemap automatically.
 */
export async function getPublicMaids(): Promise<Maid[]> {
  const entries = DEMO ? await getCollection('demoMaids') : await getCollection('maids');
  return entries
    .map((e) => ({ ...e.data, slug: e.data.code.toLowerCase(), summary: (e.body ?? '').trim(), demo: DEMO || REVIEW }))
    .filter((m) => (REVIEW || (m.published && m.publication.consentRecorded)) && !HIDDEN_STATUSES.includes(m.status))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || +b.statusUpdated - +a.statusUpdated);
}

/** Status shown to visitors: the recorded status only once staff have verified it, otherwise "to be confirmed". */
export type ShownStatus = Maid['status'] | 'unconfirmed';
export const shownStatus = (m: Maid): ShownStatus => (m.availabilityVerified ? m.status : 'unconfirmed');

function statusRank(s: Maid['status']) {
  return ['available', 'interview-pending', 'reserved', 'processing', 'unavailable', 'placed', 'withdrawn'].indexOf(s);
}

export function experiencedSkills(m: Maid, lang: Lang): string[] {
  const L = t(lang).skill;
  return (Object.keys(m.skills) as (keyof Maid['skills'])[])
    // Cards and filters show only skills marked "experienced" (backed by work history); full levels are on the profile.
    .filter((k) => m.skills[k] === 'experienced')
    .map((k) => L[k]);
}

/** Common language names in candidate records, translated for the BM pages. Unknown names are shown as entered. */
const LANGUAGE_NAMES_MS: Record<string, string> = {
  English: 'Bahasa Inggeris', 'Bahasa Indonesia': 'Bahasa Indonesia', 'Bahasa Malaysia': 'Bahasa Melayu', 'Bahasa Melayu': 'Bahasa Melayu',
  Malay: 'Bahasa Melayu', Mandarin: 'Bahasa Mandarin', Cantonese: 'Kantonis', Hokkien: 'Hokkien', Tagalog: 'Tagalog', Filipino: 'Filipino',
  Javanese: 'Bahasa Jawa', Tamil: 'Bahasa Tamil', Arabic: 'Bahasa Arab',
};
const COUNTRY_NAMES_MS: Record<string, string> = {
  Malaysia: 'Malaysia', Singapore: 'Singapura', 'Hong Kong': 'Hong Kong', Taiwan: 'Taiwan', 'Saudi Arabia': 'Arab Saudi',
  'United Arab Emirates': 'Emiriah Arab Bersatu', Kuwait: 'Kuwait', Qatar: 'Qatar', Indonesia: 'Indonesia', Philippines: 'Filipina', Brunei: 'Brunei',
};
export const languageName = (name: string, lang: Lang) => (lang === 'ms' ? LANGUAGE_NAMES_MS[name] ?? name : name);
export const countryName = (name: string, lang: Lang) => (lang === 'ms' ? COUNTRY_NAMES_MS[name] ?? name : name);
