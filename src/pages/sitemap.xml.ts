// Bilingual sitemap generated from real published pages. Only canonical, indexable URLs are listed,
// each with hreflang alternates (en-MY, ms-MY, x-default) when the page exists in both languages.
// lastmod: content dates for profiles and articles; git commit date of the source file for other pages.
import type { APIRoute } from 'astro';
import { execFileSync } from 'node:child_process';
import { site } from '../lib/config';
import { absUrl } from '../lib/urls';
import { getPublicMaids, DEMO } from '../lib/maids';
import { getPosts, translationOf } from '../lib/blog';
import { LANGS, HTML_LANG, ROUTES, path, profilePath, postPath, withLang, type RouteKey, type Alternates } from '../i18n/routes';

function gitDate(...files: string[]): string | undefined {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...files], { encoding: 'utf8' }).trim();
    return out ? out.slice(0, 10) : undefined;
  } catch {
    return undefined;
  }
}

const VIEW_FILE: Record<RouteKey, string[]> = {
  home: ['src/views/Home.astro', 'src/data/packages.yaml', 'src/data/faq.yaml'],
  maids: ['src/views/MaidsIndex.astro', 'src/content/maids'],
  indonesian: ['src/views/Nationality.astro', 'src/content/maids', 'src/data/packages.yaml'],
  filipino: ['src/views/Nationality.astro', 'src/content/maids', 'src/data/packages.yaml'],
  services: ['src/views/ServicesIndex.astro'],
  elderly: ['src/views/ServiceDetail.astro'],
  childcare: ['src/views/ServiceDetail.astro'],
  housekeeping: ['src/views/ServiceDetail.astro'],
  process: ['src/views/Process.astro', 'src/i18n/ui.ts'],
  packages: ['src/views/Packages.astro', 'src/data/packages.yaml'],
  about: ['src/views/About.astro'],
  contact: ['src/views/Contact.astro', 'src/data/site.yaml'],
  faq: ['src/views/Faq.astro', 'src/data/faq.yaml'],
  blog: ['src/views/BlogIndex.astro', 'src/content/blog'],
  privacy: ['src/views/Privacy.astro'],
};

type Entry = { loc: string; lastmod?: string; alternates: Alternates };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const GET: APIRoute = async () => {
  const urls: Entry[] = [];
  for (const key of Object.keys(ROUTES) as RouteKey[]) {
    if (key === 'privacy' && !site.seo.privacyPolicyApproved) continue;
    const alternates = { en: path('en', key), ms: path('ms', key) };
    const lastmod = gitDate(...VIEW_FILE[key]);
    for (const lang of LANGS) urls.push({ loc: path(lang, key), lastmod, alternates });
  }

  const posts = await getPosts();
  for (const p of posts) {
    const tr = translationOf(posts, p, p.lang === 'en' ? 'ms' : 'en');
    const own = withLang(p.lang, postPath(p.lang, p.slug));
    const alternates: Alternates = tr ? { [p.lang]: own, [tr.lang]: withLang(tr.lang, postPath(tr.lang, tr.slug)) } : {};
    urls.push({ loc: own, lastmod: iso(p.entry.data.updated ?? p.entry.data.published), alternates });
  }

  if (!DEMO) {
    for (const m of await getPublicMaids()) {
      const alternates = { en: withLang('en', profilePath('en', m.slug)), ms: withLang('ms', profilePath('ms', m.slug)) };
      for (const lang of LANGS) urls.push({ loc: alternates[lang], lastmod: iso(m.statusUpdated), alternates });
    }
  }

  const altLinks = (a: Alternates) =>
    a.en && a.ms
      ? LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${HTML_LANG[l]}" href="${absUrl(a[l]!)}"/>`).join('') +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${absUrl(a.en)}"/>`
      : '';

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `  <url><loc>${absUrl(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${altLinks(u.alternates)}</url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
