import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const RESERVED_SLUGS = ['indonesian-maids', 'filipino-maids', 'page'];

const skillLevel = z.enum(['experienced', 'some-experience', 'willing-to-learn', 'none']).default('none');

const maidSchema = z
  .object({
    // Safe agency reference code — NEVER a passport or IC number.
    code: z
      .string()
      .regex(/^[A-Z0-9][A-Z0-9-]{2,29}$/, 'Code must be 3–30 characters: capital letters, numbers and hyphens only'),
    displayName: z.string().max(30).optional(), // first name only, and only with consent
    nationality: z.enum(['indonesian', 'filipino']),
    age: z.number().int().min(21).max(60).optional(), // shown only if publication.showAge is true
    religion: z.string().max(30).optional(),
    maritalStatus: z.string().max(30).optional(),
    experienceYears: z.number().min(0).max(40),
    overseasExperience: z.boolean().default(false),
    skills: z.object({
      childcare: skillLevel,
      newborn: skillLevel,
      elderlyCare: skillLevel,
      cooking: skillLevel,
      housekeeping: skillLevel,
      petCare: skillLevel,
    }),
    languages: z.array(z.object({ language: z.string(), level: z.enum(['basic', 'conversational', 'fluent', 'native']) })).default([]),
    // Summary only: country, duration, main duties. No employer names or addresses.
    employmentHistory: z
      .array(z.object({ country: z.string(), duration: z.string(), duties: z.string().max(200) }))
      .default([]),
    status: z.enum(['available', 'interview-pending', 'reserved', 'placed', 'temporarily-unavailable']),
    statusUpdated: z.coerce.date(),
    interviewAvailability: z.string().max(120).optional(),
    photo: z.string().optional(), // e.g. images/maids/fc-id-0001.webp (inside /public)
    biodataPdf: z.string().optional(), // e.g. biodata/fc-id-0001.pdf — REDACTED version only
    featured: z.boolean().default(false),
    published: z.boolean().default(false),
    publication: z.object({
      consentRecorded: z.boolean(), // signed consent kept in the office file — not in this repository
      consentDate: z.coerce.date(),
      photoConsent: z.boolean().default(false),
      showAge: z.boolean().default(false),
      approvedBy: z.string().max(10), // staff initials
    }),
  })
  .superRefine((m, ctx) => {
    const slug = m.code.toLowerCase();
    if (RESERVED_SLUGS.includes(slug)) {
      ctx.addIssue({ code: 'custom', message: `Code "${m.code}" is reserved` });
    }
    if (m.photo && !m.publication.photoConsent) {
      ctx.addIssue({ code: 'custom', path: ['photo'], message: 'A photo is set but publication.photoConsent is false' });
    }
    if (m.published && !m.publication.consentRecorded) {
      ctx.addIssue({ code: 'custom', path: ['published'], message: 'Cannot publish without recorded consent' });
    }
  });

const maids = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*.md'], base: './src/content/maids' }),
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
    description: z.string().min(70).max(170),
    h1: z.string().optional(),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    primaryKeyword: z.string(),
    draft: z.boolean().default(false),
    related: z.array(z.string()).default([]), // site paths, e.g. /maid-hiring-process/
  }),
});

export const collections = { maids, demoMaids, blog };
