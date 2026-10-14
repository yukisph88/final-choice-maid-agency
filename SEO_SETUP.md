# SEO setup

Approach: Google Search Central fundamentals — helpful original content, one clear intent per page, crawlable HTML,
accurate structured data, fast mobile pages. No keyword stuffing, no doorway pages, no fake reviews.

> **Search volumes and difficulty scores are not included.** No verified SEO tool data was available for this build.
> Assessments below are qualitative (intent and competition judged from the Malaysian SERP landscape and how
> competitors structure their sites). Validate with Google Search Console data after launch, or with Google
> Keyword Planner (free with a Google Ads account).

## Bilingual structure (English + Bahasa Melayu)

| | English | Bahasa Melayu |
|---|---|---|
| URL prefix | `/en/` | `/ms/` |
| `<html lang>` / `og:locale` | `en-MY` / `en_MY` | `ms-MY` / `ms_MY` |
| Canonical | self-referencing | self-referencing (never canonicalised to English) |
| hreflang | `en-MY`, `ms-MY`, `x-default` (→ English) on every page that exists in both languages | same |
| Sitemap | every URL listed with `xhtml:link` alternates | same |

- The root address `/` is a small language entry page (`noindex`). It opens the language the visitor chose before with the
  EN | BM switch (saved in their browser), otherwise English. It **never** redirects based on browser language or user agent,
  so Google always sees the same behaviour.
- Localised slugs, e.g. `/en/maids/indonesian-maids/` ↔ `/ms/pembantu-rumah/indonesia/`,
  `/en/maid-hiring-process/` ↔ `/ms/proses-pengambilan-pembantu-rumah/`. The full map is `src/i18n/routes.ts`.
- `npm run test:site` fails the build if any hreflang is not reciprocal, a canonical is not self-referencing, or `<html lang>` does not match the URL.

## Bahasa Melayu keyword-to-page map

| Keyword | Landing page |
|---|---|
| agensi pembantu rumah Malaysia, cari pembantu rumah | `/ms/` and `/ms/pembantu-rumah/` |
| agensi pembantu rumah Indonesia, pembantu rumah Indonesia | `/ms/pembantu-rumah/indonesia/` |
| agensi pembantu rumah Filipina, pembantu rumah Filipina | `/ms/pembantu-rumah/filipina/` |
| pembantu rumah untuk jaga orang tua | `/ms/perkhidmatan/pembantu-rumah-jaga-orang-tua/` (+ `/ms/blog/memilih-pembantu-rumah-jaga-orang-tua/`) |
| pembantu rumah jaga anak | `/ms/perkhidmatan/pembantu-rumah-jaga-anak/` |
| perkhidmatan pembantu rumah | `/ms/perkhidmatan/` |
| permohonan pembantu rumah Malaysia | `/ms/proses-pengambilan-pembantu-rumah/` (+ `/ms/blog/cara-mengambil-pembantu-rumah-di-malaysia/`) |

## English keyword-to-page map (paths below are under `/en/`)

| Keyword(s) | Search intent | Competition | Opportunity | Landing page | Conversion potential |
|---|---|---|---|---|---|
| maid agency Malaysia, maid recruitment agency Malaysia, maid placement agency Malaysia, domestic helper agency Malaysia | Commercial — choosing an agency | High (many established agencies) | Medium; needs authority over time | `/` | High |
| maid agency near me, maid agency Kuala Lumpur | Local commercial | High, but location-filtered | **High** with a verified Google Business Profile | `/` + `/contact/` + GBP | Very high |
| Indonesian maid agency Malaysia, hire Indonesian maid, Indonesian maid Malaysia, agensi pembantu rumah Indonesia | Commercial, nationality-specific | High | Medium–high | `/maids/indonesian-maids/` | High |
| Filipino maid agency Malaysia, hire Filipino maid, Filipino maid Malaysia, agensi pembantu rumah Filipina | Commercial, nationality-specific | Medium–high | Medium–high | `/maids/filipino-maids/` | High |
| maid for elderly care Malaysia | Commercial, need-specific | Medium | **High** (fewer dedicated pages) | `/services/elderly-care-maid/` | High |
| childcare maid Malaysia | Commercial, need-specific | Medium | High | `/services/childcare-maid/` | High |
| housekeeping maid Malaysia | Commercial, need-specific | Medium | Medium | `/services/housekeeping-maid/` | Medium |
| maid service Malaysia, maid permit renewal Malaysia, maid contract renewal Malaysia | Mixed; renewal = existing employers | Medium | Medium | `/services/` (anchors `#permit-renewal`, `#contract-renewal`) | Medium (repeat business) |
| hire maid Malaysia, how to hire a maid in Malaysia | Informational → commercial | Medium | High | `/blog/how-to-hire-a-maid-in-malaysia/` → links to `/maid-hiring-process/` | Medium |
| maid hiring process Malaysia | Informational | Medium | High | `/maid-hiring-process/` | Medium–high |
| maid package price Malaysia | Commercial, price comparison | Medium | High (many agencies hide prices) | `/maid-packages/` | Very high |
| maid biodata Malaysia | Navigational/commercial | Medium | Medium; grows with real profiles | `/maids/` | High |
| pembantu rumah Malaysia, agensi pembantu rumah | Malay-language queries | Medium | **High once a genuine Bahasa Malaysia version exists** | Future `/ms/` pages | High |

Notes:
- Malay-language keywords appear only as natural eyebrow labels on the nationality pages. A real Bahasa Malaysia
  translation (with `hreflang`) is the correct way to rank for them — see "Internationalisation" below.
- One page per intent. Several keyword variants map to the same page on purpose, to avoid thin duplicate pages.

## On-page implementation (done)

- Unique `<title>` and meta description on every page (checked automatically by `npm run test:site`)
- Exactly one `<h1>` per page, logical H2/H3 below it
- Descriptive URLs, trailing-slash canonical URLs, breadcrumbs (visible + `BreadcrumbList`)
- Internal links: homepage → categories/services/process/packages; category ↔ category; services ↔ guides; articles → commercial pages
- Image `alt` text, explicit `width`/`height` (no layout shift), lazy loading below the fold, WebP images
- Open Graph and Twitter card tags, 1200×630 share image (`public/images/og-image.jpg`)

## Technical SEO (done)

| Item | Implementation |
|---|---|
| sitemap.xml | Generated from real pages (`src/pages/sitemap.xml.ts`). Lists only canonical, indexable URLs; includes published candidate profiles; excludes 404, draft privacy policy and demo profiles. `lastmod` = article/profile dates or git commit date |
| robots.txt | Generated. Blocks all crawling while `seo.indexing: false`; allows all + sitemap line when `true` |
| Canonicals | Absolute URL on every page, built from `SITE_URL` + `BASE_PATH` |
| noindex | Every page is `noindex` until `seo.indexing: true` (prevents the github.io preview from competing with the real domain). The privacy policy stays `noindex` until approved |
| 404 | Custom `404.html` (GitHub Pages serves it with HTTP 404) |
| Filters | Run in the browser and do not create URLs → no duplicate filter pages |
| Structured data | `EmploymentAgency` (a `LocalBusiness` subtype) with verified NAP + hours; `WebSite`; `BreadcrumbList`; `Article` on posts; `Service` on category/service pages. **No** Review/AggregateRating, **no** JobPosting, **no** FAQPage (Google limits FAQ rich results to authoritative government/health sites) |
| Performance | No framework JS, self-hosted fonts with `font-display: swap`, ~35 KB hero image, CSS inlined/cached |

### Validate structured data
After deployment, test the homepage and an article at <https://search.google.com/test/rich-results> and <https://validator.schema.org/>.

## Launch steps

1. Connect the final domain (DEPLOYMENT_GUIDE.md) and set `SITE_URL`/`BASE_PATH`.
2. In `src/data/site.yaml` set `seo.indexing: true`. Commit.
3. **Google Search Console** (free): <https://search.google.com/search-console>
   - Add property → **Domain** (verify with a DNS TXT record at your domain registrar), or **URL prefix** (verify by
     pasting the HTML-tag code into `seo.googleSiteVerification` in `site.yaml`).
   - Sitemaps → submit `sitemap.xml`.
   - URL Inspection → request indexing for `/en/`, `/ms/`, `/en/maids/indonesian-maids/`, `/ms/pembantu-rumah/indonesia/`, `/en/maid-packages/`, `/ms/pakej-pembantu-rumah/`.
4. **Google Business Profile** (free, the most important step for "maid agency near me"): <https://business.google.com>
   - Category: *Employment agency*. Name exactly `Agensi Pekerjaan Final Choice Sdn Bhd` (or the trading name used on signage).
   - Address and phone **identical** to the website footer (consistent NAP).
   - Website: the homepage URL. Add office photos and hours.
   - Once verified, paste the profile link into `social.googleBusinessProfile` and replace `company.mapsUrl` in `site.yaml`.
   - Ask genuine customers for reviews **on Google** (never on-site fake reviews).
5. Bing Webmaster Tools (free): import from Search Console.

## Core Web Vitals

Targets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. Measure after deployment with PageSpeed Insights
(<https://pagespeed.web.dev/>) for mobile, and monitor the Core Web Vitals report in Search Console once there is traffic.

## Adding another language later (e.g. Simplified Chinese)

Add `'zh'` to `LANGS` in `src/i18n/routes.ts` with its slugs, add a `zh` block to `src/i18n/ui.ts`, and add `zh` content
to each view. hreflang, the sitemap and the switcher pick it up automatically. Use genuine translations only.

## Editorial plan

| # | Title | URL | Primary keyword | Intent | Status | Outline |
|---|---|---|---|---|---|---|
| 1 | How to hire a maid in Malaysia | `/blog/how-to-hire-a-maid-in-malaysia/` | hire maid Malaysia | Informational → commercial | Published | Needs → nationality → licensed agency → biodata/interview → documents → approvals/arrival → handover; checklist |
| 2 | Indonesian maid vs Filipino maid | `/blog/indonesian-maid-vs-filipino-maid/` | Indonesian maid vs Filipino maid | Comparison | Published | Language table, food, religion, experience, procedures, salary/packages, how to decide |
| 3 | Documents needed to hire a domestic helper | `/blog/documents-needed-to-hire-a-domestic-helper/` | documents to hire maid Malaysia | Informational | Published — **verify list with operations staff** | ID, income, address, household docs; helper-side docs; tips; renewals |
| 4 | How to choose a maid for elderly care | `/blog/how-to-choose-a-maid-for-elderly-care/` | maid for elderly care Malaysia | Informational → commercial | Published | Assess needs, limits of a helper, experience, personality/language, interview questions, home prep, helper wellbeing |
| 5 | How to interview a domestic helper | `/blog/how-to-interview-a-domestic-helper/` | how to interview a maid | Informational | Published | Preparation, rapport, open questions by duty, describing the job, warning signs, after |
| 6 | Maid hiring process in Malaysia | **`/maid-hiring-process/`** (core page, not a blog post) | maid hiring process Malaysia | Informational/commercial | Published | 7 detailed steps, timing factors, contract/salary/rest days. Kept as one page to avoid two URLs competing for the same query |
| 7 | Common mistakes when hiring a maid | `/blog/common-mistakes-when-hiring-a-maid/` | mistakes hiring maid Malaysia | Informational | Published | 7 mistakes with fixes |
| 8 | What happens after your maid arrives | `/blog/what-happens-after-your-maid-arrives-in-malaysia/` | after maid arrives Malaysia | Informational (post-purchase) | Published | FOMEMA, work pass, orientation, handover, first-month plan, wellbeing, when to call |

Next topics (only once facts are verified against official sources): maid levy and costs explained; renewing a maid
permit step by step; hiring a maid for a newborn; Bahasa Malaysia versions of the top 3 articles.
Publish one well-researched article a month rather than many thin ones.
