# Launch checklist

✅ = done / verified · ⬜ = needs staff or management input

## Verified business facts in use

| Item | Value | Source |
|---|---|---|
| Company | Agensi Pekerjaan Final Choice Sdn Bhd | Official logo, approved foreign-worker site |
| Company No. | 201201028954 (1013441-H) | Approved foreign-worker site |
| Licence | JTKSM 483 (Category C) | Approved foreign-worker site |
| Office | No. 58, Jalan Mutiara Barat 6, Taman Mutiara Barat, 56000 Kuala Lumpur | Approved foreign-worker site |
| Email | apfinalchoice@gmail.com | Approved foreign-worker site |
| Hours | Mon–Fri 09:00–18:00 · Sat 09:00–13:00 | Approved foreign-worker site |
| WhatsApp / phone | Yuki — 018-377 3333 (`60183773333`) | Provided by management, 14 Oct 2026 |

## ⬜ Please confirm before public launch

1. **WhatsApp number.** The maid site uses **018-377 3333** as instructed. The foreign-worker site uses **013-377 3333**,
   and the official logo's mascot shows **011-1852 3311**. Please confirm 018-377 3333 is correct for maid enquiries.
2. **Package prices** RM15,600 / RM17,600 / RM19,600 — confirm for both nationalities (`src/data/packages.yaml`).
3. **Indonesian package terms** (90/180-day warranty, RM3,800 replacement fee, Diamond no replacement fee) are shown as
   provided. Confirm they are current and match the service agreement.
4. **Filipino package inclusions** (SOCSO, ACC, Diamond no replacement fee) are **hidden** (`verified: false`) until confirmed.
5. **"Two-year contracts" badge** on the homepage, based on the brief ("generally arranges a two-year contract").
6. **Regulatory wording** on the nationality pages, hiring process, FAQ and articles — review by operations staff
   (Indonesian procedures, Philippine contract verification, FOMEMA, documents list).
7. **Privacy policy** — resolve `[CONFIRM]` items, then set `seo.privacyPolicyApproved: true`. A Bahasa Malaysia version is recommended.
8. **Final domain** (e.g. www.finalchoice.com.my) — see DEPLOYMENT_GUIDE.md.
9. **Google Business Profile** link (replaces the Google Maps search link).
10. **Official social media links** (Facebook / Instagram / TikTok) — currently hidden.
11. **Candidate consent form** wording, before adding any real biodata.

## ⬜ Content to supply

- Real, consented maid biodata (the site currently shows a tasteful "ask for biodata" panel instead of fake profiles)
- Own photography: office, team (with consent), orientation/training sessions. The hero photo is a licensed stock image and should be replaced
- Company history (year started, number of placements) — only if verifiable

## ✅ Done

- Original logo, brand colours from the logo, favicon, share image
- All 16 page types, sitemap, robots, 404, structured data
- WhatsApp CTAs with page-specific messages; floating WhatsApp button; enquiry form → WhatsApp (no fake "received")
- Candidate directory with filters, code search, pagination; profile template; consent gating
- Staff guides (CONTENT_MANAGEMENT.md), privacy checklist, SEO plan, deployment guide
- Automatic build checks on every deployment
- Preview is `noindex` until `seo.indexing: true`
