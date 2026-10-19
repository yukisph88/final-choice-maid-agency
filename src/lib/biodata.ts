// Download links for the generated biodata PDFs. The PDFs are created during the website build from the same published
// profile data as the profile pages (src/pages/biodata/[file].pdf.ts), one English and one Bahasa Melayu file per published maid.
import { href } from './urls';
import type { Lang } from '../i18n/routes';

/** File name without ".pdf", unique per maid (reference code) and language. */
export const biodataName = (code: string, lang: Lang) => `Final-Choice-Biodata-${code.replace(/[^A-Za-z0-9-]/g, '')}${lang === 'ms' ? '-BM' : ''}`;
export const biodataHref = (code: string, lang: Lang) => href(`/biodata/${biodataName(code, lang)}.pdf`);
