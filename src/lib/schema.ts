// schema.org JSON-LD builders. Only facts that are also visible on the page are used.
// No Review/AggregateRating (no verified reviews) and no JobPosting (these are not vacancies).
import { site } from './config';
import { absUrl, asset } from './urls';

const ORG_ID = () => absUrl('/#organization');
const WEBSITE_ID = () => absUrl('/#website');

export function organizationSchema() {
  const c = site.company;
  const sameAs = Object.values(site.social).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'EmploymentAgency',
    '@id': ORG_ID(),
    name: c.brandName,
    legalName: c.legalName,
    url: absUrl('/'),
    logo: new URL(asset('images/logo-final-choice.png'), import.meta.env.SITE).toString(),
    image: new URL(asset(site.seo.defaultOgImage), import.meta.env.SITE).toString(),
    description:
      'Licensed Malaysian employment agency assisting employers with Indonesian and Filipino domestic helper recruitment, placement and permit renewal.',
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
    areaServed: { '@type': 'Country', name: 'Malaysia' },
    openingHoursSpecification: c.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    identifier: [{ '@type': 'PropertyValue', propertyID: 'SSM', value: c.registrationNo }],
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID(),
    name: site.company.brandName,
    url: absUrl('/'),
    inLanguage: 'en-MY',
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

export function articleSchema(a: { title: string; description: string; path: string; published: Date; updated?: Date }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    mainEntityOfPage: absUrl(a.path),
    datePublished: a.published.toISOString(),
    dateModified: (a.updated ?? a.published).toISOString(),
    author: { '@type': 'Organization', name: site.company.legalName, url: absUrl('/about-us/') },
    publisher: { '@id': ORG_ID() },
    image: new URL(asset(site.seo.defaultOgImage), import.meta.env.SITE).toString(),
    inLanguage: 'en-MY',
  };
}

export function serviceSchema(s: { name: string; description: string; path: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    description: s.description,
    url: absUrl(s.path),
    provider: { '@id': ORG_ID() },
    areaServed: { '@type': 'Country', name: 'Malaysia' },
  };
}
