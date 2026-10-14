# Final Choice — Maid Agency Website

Website for **Agensi Pekerjaan Final Choice Sdn Bhd** (Co. No. 201201028954 (1013441-H), licence JTKSM 483 Category C):
domestic helper recruitment and placement in Malaysia.

- **Bilingual:** English (`/en/`) and Bahasa Melayu (`/ms/`), with localised URLs, hreflang and one shared data source.
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
  layouts/         BaseLayout (SEO head, hreflang, header with EN | BM switch, footer)
  i18n/
    routes.ts      ← every page URL in English and Bahasa Melayu (single source)
    ui.ts          ← buttons, labels, statuses, WhatsApp messages in both languages
  views/           page content (one component per page type, both languages)
  pages/           [lang]/[...slug].astro builds all /en/ and /ms/ pages; index (language entry), sitemap, robots, 404
  content/
    maids/         ← one Markdown file per published candidate (_TEMPLATE.md = template)
    demo-maids/    DEMO profiles for local testing only (never deployed)
    blog/en/, blog/ms/  ← articles
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

Requires Node.js 22.12 or later (GitHub Actions uses Node 22).

## Pages

| English | Bahasa Melayu |
|---|---|
| `/en/` | `/ms/` |
| `/en/maids/` | `/ms/pembantu-rumah/` |
| `/en/maids/indonesian-maids/` | `/ms/pembantu-rumah/indonesia/` |
| `/en/maids/filipino-maids/` | `/ms/pembantu-rumah/filipina/` |
| `/en/maids/[code]/` | `/ms/pembantu-rumah/[code]/` |
| `/en/services/` | `/ms/perkhidmatan/` |
| `/en/services/elderly-care-maid/` | `/ms/perkhidmatan/pembantu-rumah-jaga-orang-tua/` |
| `/en/services/childcare-maid/` | `/ms/perkhidmatan/pembantu-rumah-jaga-anak/` |
| `/en/services/housekeeping-maid/` | `/ms/perkhidmatan/pembantu-rumah-kerja-rumah/` |
| `/en/maid-hiring-process/` | `/ms/proses-pengambilan-pembantu-rumah/` |
| `/en/maid-packages/` | `/ms/pakej-pembantu-rumah/` |
| `/en/about-us/` | `/ms/tentang-kami/` |
| `/en/contact/` | `/ms/hubungi-kami/` |
| `/en/faq/` | `/ms/soalan-lazim/` |
| `/en/blog/…` (7 articles) | `/ms/blog/…` (7 articles) |
| `/en/privacy-policy/` | `/ms/dasar-privasi/` |

Plus `/` (language entry page) and a bilingual 404.

## Images

- Logos in `public/images/logo-final-choice*.{png,webp}` and favicons are Final Choice's official artwork, copied unchanged from the approved company website assets.
- `home-helper-housekeeping-*.webp` is a crop of a licensed Pexels photo already used on the Final Choice foreign-worker site (<https://www.pexels.com/photo/two-women-fixing-a-bed-together-9462745/>, Pexels License). The people shown are not Final Choice helpers and must not be captioned as such. Replace it with your own photography when available.
