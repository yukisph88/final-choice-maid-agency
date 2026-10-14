// schema.org JSON-LD builders. Only facts that are also visible on the page are used.
// No Review/AggregateRating (no verified reviews) and no JobPosting (these are not vacancies).
import { site } from './config';
import { absUrl, asset } from './urls';
import { HTML_LANG, path, type Lang } from '../i18n/routes';

const ORG_ID = () => absUrl('/#organization');
const WEBSITE_ID = () => absUrl('/#website');
const img = (p: string) => new URL(asset(p), import.meta.env.SITE).toString();

const DESCRIPTION: Record<Lang, string> = {
  en: 'Licensed Malaysian employment agency assisting employers with Indonesian and Filipino domestic helper recruitment, placement and permit renewal.',
  ms: 'Agensi pekerjaan berlesen di Malaysia yang membantu majikan mengambil, menempatkan dan memperbaharui permit pembantu rumah Indonesia dan Filipina.',
};

export function organizationSchema(lang: Lang) {
  const c = site.company;
  const sameAs = Object.values(site.social).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'EmploymentAgency',
    '@id': ORG_ID(),
    name: c.brandName,
    legalName: c.legalName,
    url: absUrl(path(lang, 'home')),
    logo: img('images/logo-final-choice.png'),
    image: img(site.seo.defaultOgImage),
    description: DESCRIPTION[lang],
    telephone: `+${site.contact.whatsappNumber}`,
    email: c.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: c.address.street,
      postalCode: c.address.postcode,
      addressLocality: c.address.city,
      addressRegion: c.address.state,
      addressCountry: c.address.country,
    },
    areaServed: c.serviceAreas.length ? c.serviceAreas.map((a) => ({ '@type': 'AdministrativeArea', name: a })) : { '@type': 'Country', name: 'Malaysia' },
    openingHoursSpecification: c.hours.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.days, opens: h.opens, closes: h.closes })),
    identifier: [{ '@type': 'PropertyValue', propertyID: 'SSM', value: c.registrationNo }],
    knowsLanguage: ['en-MY', 'ms-MY'],
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteSchema(lang: Lang) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID(),
    name: site.company.brandName,
    url: absUrl(path(lang, 'home')),
    inLanguage: HTML_LANG[lang],
    publisher: { '@id': ORG_ID() },
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absUrl(c.path) })),
  };
}

export function articleSchema(a: { title: string; description: string; path: string; published: Date; updated?: Date; lang: Lang }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    mainEntityOfPage: absUrl(a.path),
    datePublished: a.published.toISOString(),
    dateModified: (a.updated ?? a.published).toISOString(),
    author: { '@type': 'Organization', name: site.company.legalName, url: absUrl(path(a.lang, 'about')) },
    publisher: { '@id': ORG_ID() },
    image: img(site.seo.defaultOgImage),
    inLanguage: HTML_LANG[a.lang],
  };
}

export function serviceSchema(s: { name: string; description: string; path: string; lang: Lang }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    description: s.description,
    url: absUrl(s.path),
    inLanguage: HTML_LANG[s.lang],
    provider: { '@id': ORG_ID() },
    areaServed: { '@type': 'Country', name: 'Malaysia' },
  };
}
