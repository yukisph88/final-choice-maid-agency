import { site } from './config';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, ''); // '' or '/final-choice-maid-agency'

/** Site-relative link that respects the GitHub Pages base path. Pass paths like '/en/maids/'. */
export function href(path: string): string {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${p}`;
}

/** Absolute URL for canonical tags, hreflang, sitemap and structured data. */
export function absUrl(path: string): string {
  return new URL(href(path), import.meta.env.SITE).toString();
}

/** Asset inside /public, e.g. asset('images/logo.png'). */
export function asset(path: string): string {
  return href(path.replace(/^\//, ''));
}

export function whatsappLink(message: string): string {
  return `https://wa.me/${site.contact.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const telLink = `tel:+${site.contact.whatsappNumber}`;
