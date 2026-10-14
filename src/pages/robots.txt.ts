// robots.txt. Search engines only read it at the root of a domain, so it takes effect once
// the site is on its own custom domain. While seo.indexing is false, crawling is blocked.
import type { APIRoute } from 'astro';
import { site } from '../lib/config';
import { absUrl } from '../lib/urls';

export const GET: APIRoute = () => {
  const body = site.seo.indexing
    ? `User-agent: *\nAllow: /\n\nSitemap: ${absUrl('/sitemap.xml')}\n`
    : `# Pre-launch preview: not for indexing\nUser-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
