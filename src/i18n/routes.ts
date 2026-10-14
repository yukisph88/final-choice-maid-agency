// Single source of truth for every page URL in both languages.
// The language switcher, hreflang tags, sitemap and internal links are all generated from this map,
// so English and Bahasa Melayu URLs can never drift apart.

export const LANGS = ['en', 'ms'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';
export const HTML_LANG: Record<Lang, string> = { en: 'en-MY', ms: 'ms-MY' };
export const OG_LOCALE: Record<Lang, string> = { en: 'en_MY', ms: 'ms_MY' };
export const LANG_LABEL: Record<Lang, { short: string; long: string }> = {
  en: { short: 'EN', long: 'English' },
  ms: { short: 'BM', long: 'Bahasa Melayu' },
};

/** Page keys → path (after the /en or /ms prefix). Paths must start and end with "/". */
export const ROUTES = {
  home: { en: '/', ms: '/' },
  maids: { en: '/maids/', ms: '/pembantu-rumah/' },
  indonesian: { en: '/maids/indonesian-maids/', ms: '/pembantu-rumah/indonesia/' },
  filipino: { en: '/maids/filipino-maids/', ms: '/pembantu-rumah/filipina/' },
  services: { en: '/services/', ms: '/perkhidmatan/' },
  elderly: { en: '/services/elderly-care-maid/', ms: '/perkhidmatan/pembantu-rumah-jaga-orang-tua/' },
  childcare: { en: '/services/childcare-maid/', ms: '/perkhidmatan/pembantu-rumah-jaga-anak/' },
  housekeeping: { en: '/services/housekeeping-maid/', ms: '/perkhidmatan/pembantu-rumah-kerja-rumah/' },
  process: { en: '/maid-hiring-process/', ms: '/proses-pengambilan-pembantu-rumah/' },
  packages: { en: '/maid-packages/', ms: '/pakej-pembantu-rumah/' },
  about: { en: '/about-us/', ms: '/tentang-kami/' },
  contact: { en: '/contact/', ms: '/hubungi-kami/' },
  faq: { en: '/faq/', ms: '/soalan-lazim/' },
  blog: { en: '/blog/', ms: '/blog/' },
  privacy: { en: '/privacy-policy/', ms: '/dasar-privasi/' },
} as const;
export type RouteKey = keyof typeof ROUTES;

/** Candidate profile and article paths (dynamic). */
export const profilePath = (lang: Lang, slug: string) => `${ROUTES.maids[lang]}${slug}/`;
export const postPath = (lang: Lang, slug: string) => `${ROUTES.blog[lang]}${slug}/`;

/** Site path including the language prefix, e.g. ('ms','packages') → '/ms/pakej-pembantu-rumah/'. Optional #hash. */
export function path(lang: Lang, key: RouteKey, hash = ''): string {
  return `/${lang}${ROUTES[key][lang]}${hash ? `#${hash}` : ''}`;
}
export const withLang = (lang: Lang, p: string) => `/${lang}${p}`;

/** Equivalent pages in each language, for hreflang and the language switcher. Missing = no translation. */
export type Alternates = Partial<Record<Lang, string>>;
export const routeAlternates = (key: RouteKey): Alternates => ({ en: path('en', key), ms: path('ms', key) });

/** Slugs that candidate codes must never use (they collide with category pages). */
export const RESERVED_PROFILE_SLUGS = ['indonesian-maids', 'filipino-maids', 'indonesia', 'filipina', 'page'];

export const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'ms' : 'en');
