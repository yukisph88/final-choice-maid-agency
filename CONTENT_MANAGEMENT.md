# Content management guide (for Final Choice staff)

Everything staff normally change lives in **two folders**:

| What | File / folder |
|---|---|
| Phone, WhatsApp, address, hours, social links, launch switches | `src/data/site.yaml` |
| Package prices and inclusions | `src/data/packages.yaml` |
| FAQ questions and answers | `src/data/faq.yaml` |
| Maid biodata (one file per candidate) | `src/content/maids/` |
| Approved maid photos | `public/images/maids/` |
| Approved (redacted) biodata PDFs | `public/biodata/` |
| Blog articles | `src/content/blog/en/` (English) and `src/content/blog/ms/` (Bahasa Melayu) |
| Buttons, menus, labels, WhatsApp messages (both languages) | `src/i18n/ui.ts` |
| Page addresses in both languages | `src/i18n/routes.ts` |

You edit these on **github.com** in the browser. There is no admin login on the website itself: GitHub *is* the secure admin, protected by your GitHub account (turn on two-factor authentication).

After every commit, GitHub automatically rebuilds the site (about 2 minutes). Watch progress on the repository's **Actions** tab. A green tick means the site is live; a red cross means something in your edit is wrong — **the live site keeps the previous version**, so nothing breaks. Open the failed run to see the message (it names the file and field).

> ⚠️ **The repository is public.** Anything you commit can be seen by anyone, including old versions in the history. Only commit information that is approved for the public website. Never commit passports, IC numbers, phone numbers of candidates, medical results, unredacted biodata, or employer documents.

---

## 0. Two languages: what to edit where

The website is in **English** (`/en/…`) and **Bahasa Melayu** (`/ms/…`).

- **Shared data — enter once, shown in both languages:** maid codes, status, photos, skills, prices, "verified" flags,
  contact details. You never type a price or a status twice, so the two languages cannot disagree.
- **Text that needs both languages:**
  - Package inclusions: `text` (English) **and** `text_ms` (BM) in `packages.yaml`.
  - FAQ: every question has an `en:` and an `ms:` block in `faq.yaml`.
  - Maid summary: the text below `---` is English; add an approved BM version in `summary_ms:` (optional).
    If `summary_ms` is empty, the BM page shows the English summary with the note
    *"Ringkasan ini disediakan dalam Bahasa Inggeris."* Never publish machine translation of candidate information without checking it.
  - Employment history duties: `duties` (English) and optional `duties_ms`.
- Status labels are translated automatically (Available → Tersedia, Reserved → Telah Ditempah, Placed → Telah Ditempatkan).

## 1. Add a new maid

**Before you start:** the candidate's signed publication consent must be on file in the office.

1. Prepare the photo (if photo consent was given): portrait, ideally 720×900 px, saved as **WebP or JPG**, under 200 KB, named with the reference code in lower case, e.g. `fc-id-0012.webp`. Remove any document or passport details visible in the photo.
2. Prepare the biodata PDF (optional): the **redacted** public version only, named e.g. `fc-id-0012.pdf`.
3. On GitHub, open `public/images/maids/` → **Add file → Upload files** → upload the photo → **Commit changes**. Do the same for the PDF in `public/biodata/`.
4. Open `src/content/maids/_TEMPLATE.md` and copy all its text.
5. Go to `src/content/maids/` → **Add file → Create new file**. Name it with the reference code in lower case: `fc-id-0012.md`. Paste the template.
6. Fill in the fields (the comments in the template explain each one):
   - `code`: the agency reference code, e.g. `FC-ID-0012`. **Never** a passport or IC number. Don't reuse a code from a different candidate.
   - `photo: "images/maids/fc-id-0012.webp"` and `publication.photoConsent: true` (only if photo consent was given).
   - `biodataPdf: "biodata/fc-id-0012.pdf"` (optional).
   - `published: true` and `publication.consentRecorded: true` when ready to go live.
   - `publication.approvedBy`: your initials.
7. Below the second `---` line, write a 2–4 sentence factual summary.
8. Click **Commit changes**.

The profile appears at `/maids/fc-id-0012/`, in the directory, on its nationality page, and (if `featured: true` and available) on the homepage.

### Suggested reference code format
`FC-ID-0001` (Indonesian) and `FC-PH-0001` (Filipino), numbered in sequence. Keep a code for the life of the candidate's record.

## 2. Update availability

1. Open the candidate's file, e.g. `src/content/maids/fc-id-0012.md`, and click the ✏️ pencil.
2. Change `status:` to one of: `available`, `interview-pending`, `reserved`, `temporarily-unavailable`, `placed`.
3. **Change `statusUpdated:` to today's date** (YYYY-MM-DD). The website shows this date so visitors know the status is not real-time.
4. Commit.

`placed` removes the profile from the website automatically (the page then shows "not found").

## 3. Unpublish or remove a candidate

| Situation | What to do |
|---|---|
| Temporarily hide | Set `published: false` and commit. *(The file is still visible in the public repository — see below.)* |
| Placed | Set `status: placed` and commit, then **delete the file** within 30 days. |
| Withdrawn, or consent withdrawn | **Delete** the `.md` file, the photo and the PDF (open each file → ⋯ menu → **Delete file** → Commit). Do this the same day. |

**Why delete rather than hide:** the repository is public, so a hidden file is still readable on GitHub. Deleting removes it from the current site and repository.

**If personal data was committed by mistake** (e.g. an unredacted PDF), deleting the file is not enough, because it stays in the Git history. Tell the website administrator immediately: they need to rewrite the history (e.g. with `git filter-repo`) and ask GitHub Support to clear cached views. Keep a record of the incident for PDPA purposes.

## 4. Choose featured maids (homepage)

Set `featured: true` on up to 8 candidates. Only candidates who are `available` or `interview-pending` appear on the homepage. If fewer than 4 are featured, other available candidates fill the space.

## 5. Change package prices

Open `src/data/packages.yaml` → ✏️:
- Change `price: 15600` (numbers only, no "RM" or commas). Use `price: null` to show "Request a quotation".
- Each inclusion has `verified: true/false`. **Only `true` items are shown.** Set `true` only after management confirms the term in writing.
- Update `lastReviewed:` to today's date.

Indonesian and Filipino packages are separate on purpose — change each one.

## 6. Change WhatsApp / phone / address

Open `src/data/site.yaml` → ✏️ → `contact:`
- `whatsappNumber`: digits only, starting with 60, no `+` or spaces — e.g. `60183773333`.
- `phoneDisplay`: how it is shown, e.g. `018-377 3333`.
- `consultantName`: the name shown next to the number.

Every WhatsApp button, the floating button, the call buttons and the structured data update automatically.

## 7. Edit FAQ

Open `src/data/faq.yaml`. Each item has `q:` and `a:`. `home: true` also shows it on the homepage.

## 8. Write a blog article

English articles go in `src/content/blog/en/`, Malay articles in `src/content/blog/ms/`.
A Malay translation must include `translationKey: <file name of the English article without .md>` so the two
versions are linked (language switcher + Google hreflang). An article without a translation is fine — the switcher
then goes to the other language's homepage.

Copy an existing article in the right folder, rename it (the file name becomes the URL, e.g. `maid-levy-explained.md` → `/blog/maid-levy-explained/`), and edit the top section:
- `title` (max 70 characters), `description` (70–170 characters), `published` date, `primaryKeyword`.
- `draft: true` keeps it off the website until ready.

Links inside articles use relative paths: `../../maids/` (English) or `../../pembantu-rumah/` (BM) to a page, or `../other-article/` to another article in the same language. `related:` uses page keys from `src/i18n/routes.ts`, e.g. `"process"`, `"packages"`.

## 9. Common build errors

| Message | Fix |
|---|---|
| `src/data/site.yaml has a problem: contact.whatsappNumber` | Use digits only, starting with 60 |
| `Cannot publish without recorded consent` | Set `publication.consentRecorded: true` only once consent is on file |
| `A photo is set but publication.photoConsent is false` | Remove the `photo:` line or set `photoConsent: true` |
| `Code must be 3–30 characters` | Capitals, numbers and hyphens only |
| `bad indentation` / YAML error | Keep the spaces at the start of lines exactly as in the template; don't use tabs |
| `broken link` (in "Quality checks") | A photo/PDF path doesn't match the uploaded file name |

## 10. Testing changes locally (optional, for the administrator)

```bash
npm install
npm run dev          # http://localhost:4321/final-choice-maid-agency/
npm run dev:demo     # same, with clearly-labelled DEMO profiles to test filters/pagination
npm run build && npm run test:site
```

Demo profiles live in `src/content/demo-maids/` and are never used by the GitHub Pages build.

## Future option: a visual editor (phase 2)

If staff prefer forms to editing files, **Decap CMS** (free, open source) can be added at `/admin/`. It saves to this same GitHub repository. Because GitHub Pages has no server, Decap needs a small authentication service for the GitHub login. Free options include a Cloudflare Worker OAuth proxy. This involves a second hosting service, so it was left out of phase 1.
