// Sitemap generated from real published pages. Only canonical, indexable URLs are listed.
// lastmod: content dates for profiles and articles; git commit date of the source file for other pages.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { execFileSync } from 'node:child_process';
import { site } from '../lib/config';
import { absUrl } from '../lib/urls';
import { getPublicMaids, DEMO } from '../lib/maids';

function gitDate(...files: string[]): string | undefined {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...files], { encoding: 'utf8' }).trim();
    return out ? out.slice(0, 10) : undefined;
  } catch {
    return undefined;
  }
}

const STATIC_PAGES: { path: string; files: string[] }[] = [
  { path: '/', files: ['src/pages/index.astro', 'src/data/packages.yaml', 'src/data/faq.yaml'] },
  { path: '/maids/', files: ['src/pages/maids/index.astro', 'src/content/maids'] },
  { path: '/maids/indonesian-maids/', files: ['src/pages/maids/indonesian-maids.astro', 'src/content/maids'] },
  { path: '/maids/filipino-maids/', files: ['src/pages/maids/filipino-maids.astro', 'src/content/maids'] },
  { path: '/services/', files: ['src/pages/services/index.astro'] },
  { path: '/services/elderly-care-maid/', files: ['src/pages/services/elderly-care-maid.astro'] },
  { path: '/services/childcare-maid/', files: ['src/pages/services/childcare-maid.astro'] },
  { path: '/services/housekeeping-maid/', files: ['src/pages/services/housekeeping-maid.astro'] },
  { path: '/maid-hiring-process/', files: ['src/pages/maid-hiring-process.astro'] },
  { path: '/maid-packages/', files: ['src/pages/maid-packages.astro', 'src/data/packages.yaml'] },
  { path: '/about-us/', files: ['src/pages/about-us.astro'] },
  { path: '/contact/', files: ['src/pages/contact.astro', 'src/data/site.yaml'] },
  { path: '/faq/', files: ['src/pages/faq.astro', 'src/data/faq.yaml'] },
  { path: '/blog/', files: ['src/pages/blog/index.astro', 'src/content/blog'] },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

export const GET: APIRoute = async () => {
  const urls: { loc: string; lastmod?: string }[] = STATIC_PAGES.map((p) => ({ loc: absUrl(p.path), lastmod: gitDate(...p.files) }));

  if (site.seo.privacyPolicyApproved) urls.push({ loc: absUrl('/privacy-policy/'), lastmod: gitDate('src/pages/privacy-policy.astro') });

  const posts = await getCollection('blog', (p) => !p.data.draft);
  posts.forEach((p) => urls.push({ loc: absUrl(`/blog/${p.id}/`), lastmod: iso(p.data.updated ?? p.data.published) }));

  if (!DEMO) {
    (await getPublicMaids()).forEach((m) => urls.push({ loc: absUrl(`/maids/${m.slug}/`), lastmod: iso(m.statusUpdated) }));
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
