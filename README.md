# Final Choice — Maid Agency Website

Website for **Agensi Pekerjaan Final Choice Sdn Bhd** (Co. No. 201201028954 (1013441-H), licence JTKSM 483 Category C):
domestic helper recruitment and placement in Malaysia.

- Static site built with [Astro](https://astro.build), hosted free on **GitHub Pages**, deployed by **GitHub Actions**.
- All SEO content is in the generated HTML; JavaScript is used only for the mobile menu, filters, package tabs and the enquiry form.
- No database, no server, no paid services, no secrets in the code.

## Documentation

| File | For |
|---|---|
| [CONTENT_MANAGEMENT.md](CONTENT_MANAGEMENT.md) | **Staff:** adding maids, availability, prices, WhatsApp, FAQ, blog |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | GitHub Pages, custom domain, DNS, launch switch |
| [SEO_SETUP.md](SEO_SETUP.md) | Keyword-to-page map, Search Console, editorial plan |
| [PRIVACY_CHECKLIST.md](PRIVACY_CHECKLIST.md) | Candidate data rules and pre-launch privacy checks |
| [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) | Information still needed from management before public launch |

## Project structure

```
src/
  components/      Header, Footer, MaidCard, MaidDirectory, PackageCards, EnquiryForm, …
  layouts/         BaseLayout (SEO head, header/footer), ServiceLayout
  pages/           One file per URL (index, maids/, services/, blog/, sitemap.xml, robots.txt, 404)
  content/
    maids/         ← one Markdown file per published candidate (_TEMPLATE.md = template)
    demo-maids/    DEMO profiles for local testing only (never deployed)
    blog/          ← articles
  data/
    site.yaml      ← company details, WhatsApp, launch switches
    packages.yaml  ← package prices and inclusions
    faq.yaml       ← FAQ
  lib/             config loading/validation, URLs & WhatsApp links, schema.org JSON-LD
  styles/          global.css (brand colours in :root)
public/
  images/          logos (official, unchanged), photos, og-image.jpg, maids/
  biodata/         redacted biodata PDFs
  favicon/
scripts/check-site.mjs   post-build checks (links, titles, JSON-LD, privacy patterns)
.github/workflows/deploy.yml
```

## Commands

```bash
npm install
npm run dev            # local preview at http://localhost:4321/final-choice-maid-agency/
npm run dev:demo       # with DEMO candidates, to test filters and pagination
npm run build          # production build into dist/
npm run test:site      # checks dist/ (run after build)
```

Requires Node.js 20 or later.

## Pages

`/` · `/maids/` · `/maids/indonesian-maids/` · `/maids/filipino-maids/` · `/maids/[code]/` · `/services/` ·
`/services/elderly-care-maid/` · `/services/childcare-maid/` · `/services/housekeeping-maid/` · `/maid-hiring-process/` ·
`/maid-packages/` · `/about-us/` · `/contact/` · `/faq/` · `/blog/` · `/blog/[article]/` · `/privacy-policy/` · 404

## Images

- Logos in `public/images/logo-final-choice*.{png,webp}` and favicons are Final Choice's official artwork, copied unchanged from the approved company website assets.
- `home-helper-housekeeping-*.webp` is a crop of a licensed Pexels photo already used on the Final Choice foreign-worker site (<https://www.pexels.com/photo/two-women-fixing-a-bed-together-9462745/>, Pexels License). The people shown are not Final Choice helpers and must not be captioned as such. Replace it with your own photography when available.
