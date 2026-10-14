import { getCollection, type CollectionEntry } from 'astro:content';

export type Maid = CollectionEntry<'maids'>['data'] & { slug: string; summary: string; demo: boolean };

export const DEMO = import.meta.env.PUBLIC_DEMO_CANDIDATES === 'true';

export const STATUS_LABEL: Record<Maid['status'], string> = {
  available: 'Available',
  'interview-pending': 'Interview Pending',
  reserved: 'Reserved',
  placed: 'Placed',
  'temporarily-unavailable': 'Temporarily Unavailable',
};

export const SKILL_LABEL: Record<keyof Maid['skills'], string> = {
  childcare: 'Childcare',
  newborn: 'Newborn care',
  elderlyCare: 'Elderly care',
  cooking: 'Cooking',
  housekeeping: 'Housekeeping',
  petCare: 'Pet care',
};

export const LEVEL_LABEL = {
  experienced: 'Experienced',
  'some-experience': 'Some experience',
  'willing-to-learn': 'Willing to learn',
  none: '',
} as const;

export const NATIONALITY_LABEL = { indonesian: 'Indonesian', filipino: 'Filipino' } as const;

/**
 * Candidates that may appear publicly. A profile must be published, have recorded consent,
 * and must not be placed. Everything else is excluded from pages, listings and the sitemap.
 */
export async function getPublicMaids(): Promise<Maid[]> {
  const entries = DEMO ? await getCollection('demoMaids') : await getCollection('maids');
  return entries
    .map((e) => ({ ...e.data, slug: e.data.code.toLowerCase(), summary: (e.body ?? '').trim(), demo: DEMO }))
    .filter((m) => m.published && m.publication.consentRecorded && m.status !== 'placed')
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || +b.statusUpdated - +a.statusUpdated);
}

function statusRank(s: Maid['status']) {
  return ['available', 'interview-pending', 'reserved', 'temporarily-unavailable', 'placed'].indexOf(s);
}

export function experiencedSkills(m: Maid): string[] {
  return (Object.keys(m.skills) as (keyof Maid['skills'])[])
    .filter((k) => m.skills[k] === 'experienced' || m.skills[k] === 'some-experience')
    .map((k) => SKILL_LABEL[k]);
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
}
