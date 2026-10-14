import { site } from './config';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, ''); // '' or '/final-choice-maid-agency'

/** Site-relative link that respects the GitHub Pages base path. Pass paths like '/maids/'. */
export function href(path: string): string {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${p}`;
}

/** Absolute URL for canonical tags, sitemap and structured data. */
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

export const WA = {
  home: 'Hi Final Choice, I would like to enquire about hiring a domestic helper in Malaysia.',
  indonesian: 'Hi Final Choice, I am interested in hiring an Indonesian maid. Can you assist me?',
  filipino: 'Hi Final Choice, I am interested in hiring a Filipino maid. Can you assist me?',
  profile: (code: string) => `Hi Final Choice, I would like to enquire about maid reference ${code}.`,
  interview: (code: string) => `Hi Final Choice, I would like to request an interview with maid reference ${code}.`,
  package: (tier: string, nat: string) => `Hi Final Choice, I would like a quotation for the ${tier} package (${nat} domestic helper).`,
  service: (name: string) => `Hi Final Choice, I would like to enquire about ${name}.`,
  renewal: 'Hi Final Choice, I would like to enquire about renewing my maid’s work permit / contract.',
};
