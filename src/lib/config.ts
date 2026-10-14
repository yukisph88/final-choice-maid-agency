// Loads and validates the staff-editable YAML files in src/data/.
// A typo in those files fails the build with a readable message, so a broken
// configuration never reaches the live website.
import { load as parseYaml } from 'js-yaml';
import { z } from 'astro/zod';
import siteRaw from '../data/site.yaml?raw';
import packagesRaw from '../data/packages.yaml?raw';
import faqRaw from '../data/faq.yaml?raw';

function load<T>(name: string, raw: string, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(parseYaml(raw));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`\n\nsrc/data/${name} has a problem:\n${issues}\n`);
  }
  return parsed.data;
}

const siteSchema = z.object({
  company: z.object({
    legalName: z.string().min(1),
    brandName: z.string().min(1),
    registrationNo: z.string(),
    licence: z.string(),
    email: z.string().email(),
    address: z.object({ street: z.string(), postcode: z.string(), city: z.string(), state: z.string(), country: z.string().length(2) }),
    mapsUrl: z.string().url(),
    hours: z.array(z.object({ label: z.string(), opens: z.string(), closes: z.string(), days: z.array(z.string()) })),
  }),
  contact: z.object({
    consultantName: z.string(),
    phoneDisplay: z.string(),
    whatsappNumber: z.string().regex(/^60\d{8,10}$/, 'Use international digits only, starting with 60, e.g. 60183773333'),
  }),
  social: z.object({
    facebook: z.string(),
    instagram: z.string(),
    tiktok: z.string(),
    googleBusinessProfile: z.string(),
  }),
  seo: z.object({ indexing: z.boolean(), googleSiteVerification: z.string(), defaultOgImage: z.string(), privacyPolicyApproved: z.boolean(), privacyPolicyDate: z.string() }),
  forms: z.object({ endpoint: z.string(), accessKey: z.string() }),
});

const inclusion = z.object({ text: z.string().min(1), verified: z.boolean() });
const pkg = z.object({ price: z.number().positive().nullable(), inclusions: z.array(inclusion).default([]) });
const nationalityPackages = z.object({
  label: z.string(),
  shortLabel: z.string(),
  packages: z.object({ premium: pkg, platinum: pkg, diamond: pkg }),
});
const packagesSchema = z.object({
  priceNote: z.string(),
  lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  tiers: z.array(z.object({ id: z.enum(['premium', 'platinum', 'diamond']), name: z.string(), highlight: z.boolean() })),
  nationalities: z.object({ indonesian: nationalityPackages, filipino: nationalityPackages }),
});

const faqSchema = z.array(z.object({ q: z.string().min(5), a: z.string().min(10), home: z.boolean().default(false) }));

export const site = load('site.yaml', siteRaw, siteSchema);
export const packages = load('packages.yaml', packagesRaw, packagesSchema);
export const faq = load('faq.yaml', faqRaw, faqSchema);

export type Nationality = 'indonesian' | 'filipino';
export type TierId = 'premium' | 'platinum' | 'diamond';
