import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { RESERVED_PROFILE_SLUGS as RESERVED_SLUGS } from './i18n/routes';

// Local review mode (npm run maids:preview): reads private drafts from private-biodata/staging.
// That build goes to private-biodata/review-site/ and is never deployed.
const REVIEW = Boolean(process.env.REVIEW_MAIDS_DIR);

const skillLevel = z.enum(['experienced', 'some-experience', 'willing-to-learn', 'none']).default('none');

const maidSchema = z
  .object({
    // Safe agency reference code — NEVER a passport or IC number.
    code: z
      .string()
      .regex(/^[A-Z0-9][A-Z0-9-]{2,29}$/, 'Code must be 3–30 characters: capital letters, numbers and hyphens only'),
    displayName: z.string().max(60).optional(), // public name — only as far as the candidate's name consent allows
    reviewName: z.string().max(80).optional(), // PRIVATE: full name for the local review only; removed on publish
    nationality: z.enum(['indonesian', 'filipino']),
    age: z.number().int().min(21).max(60).optional(), // shown only if publication.showAge is true
    religion: z.string().max(30).optional(),
    maritalStatus: z.string().max(30).optional(),
    experienceYears: z.number().min(0).max(40).optional(), // leave out when the biodata does not state years
    overseasExperience: z.boolean().default(false),
    skills: z.object({
      childcare: skillLevel,
      newborn: skillLevel,
      elderlyCare: skillLevel,
      cooking: skillLevel,
      housekeeping: skillLevel,
      petCare: skillLevel,
    }),
    // level is optional: leave it out when the biodata only ticks the language without a level
    languages: z.array(z.object({ language: z.string(), level: z.enum(['basic', 'conversational', 'fluent', 'native']).optional() })).default([]),
    // Summary only: country, duration, main duties. No employer names or addresses.
    employmentHistory: z
      .array(z.object({ country: z.string(), duration: z.string(), duties: z.string().max(200), duties_ms: z.string().max(200).optional() }))
      .default([]),
    // available | interview-pending | reserved | processing  → shown publicly (if published + consent)
    // placed | unavailable | withdrawn                       → automatically hidden from the website
    status: z.enum(['available', 'interview-pending', 'reserved', 'processing', 'placed', 'unavailable', 'withdrawn']),
    statusUpdated: z.coerce.date(),
    // true only when staff have confirmed the status with the candidate/supplier; otherwise shown as "to be confirmed"
    availabilityVerified: z.boolean().default(false),
    interviewAvailability: z.string().max(120).optional(),
    interviewAvailability_ms: z.string().max(120).optional(),
    // Optional approved Bahasa Melayu summary. If empty, the BM page shows the English summary with a note.
    summary_ms: z.string().max(800).optional(),
    photo: z.string().optional(), // e.g. images/maids/fc-id-0001.webp (inside /public)
    biodataPdf: z.string().optional(), // e.g. biodata/fc-id-0001.pdf — REDACTED version only
    featured: z.boolean().default(false),
    published: z.boolean().default(false),
    publication: z.object({
      consentRecorded: z.boolean(), // signed consent kept in the office file — not in this repository
      consentDate: z.coerce.date(),
      photoConsent: z.boolean().default(false),
      showAge: z.boolean().default(false),
      showReligion: z.boolean().default(false), // religion is sensitive data under the PDPA — explicit consent only
      approvedBy: z.string().max(10), // staff initials
    }),
  })
  .superRefine((m, ctx) => {
    const slug = m.code.toLowerCase();
    if (RESERVED_SLUGS.includes(slug)) {
      ctx.addIssue({ code: 'custom', message: `Code "${m.code}" is reserved` });
    }
    if (m.photo && !m.publication.photoConsent && !REVIEW) {
      ctx.addIssue({ code: 'custom', path: ['photo'], message: 'A photo is set but publication.photoConsent is false' });
    }
    if (m.published && !m.publication.consentRecorded) {
      ctx.addIssue({ code: 'custom', path: ['published'], message: 'Cannot publish without recorded consent' });
    }
  });

const maids = defineCollection({
  loader: glob({ pattern: ['*.md', '!_*.md'], base: process.env.REVIEW_MAIDS_DIR || './src/content/maids' }),
  schema: maidSchema,
});

// Clearly-labelled demonstration profiles used ONLY for local testing (PUBLIC_DEMO_CANDIDATES=true).
const demoMaids = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*.md'], base: './src/content/demo-maids' }),
  schema: maidSchema,
});

const blog = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*.md'], base: './src/content/blog' }),
  schema: z.object({
    title: z.string().max(70),
    // English articles: omit. Malay articles: the file name of the English original (without .md).
    translationKey: z.string().optional(),
    description: z.string().min(70).max(170),
    h1: z.string().optional(),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    primaryKeyword: z.string(),
    draft: z.boolean().default(false),
    related: z.array(z.string()).default([]), // route keys from src/i18n/routes.ts, e.g. "process"
  }),
});

export const collections = { maids, demoMaids, blog };
