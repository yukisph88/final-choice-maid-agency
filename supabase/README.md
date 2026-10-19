# Final Choice — maid database (Supabase Free Plan)

The maid records live in a free Supabase project. The website stays on free GitHub Pages.

| Part | Where | Who can use it |
|---|---|---|
| Maid records, history, staff list | Supabase database (Row Level Security ON) | Signed-in staff only |
| Working photos, biodata PDFs | Supabase storage `maid-private` (private) | Signed-in staff only |
| Approved website photos | Supabase storage `maid-public` | Everyone, only for published maids with photo consent |
| Original PDFs, passports, consent forms, videos | **Office PC only** (`private-biodata/`) | Never uploaded |
| Staff dashboard | `https://<site>/staff/` | Staff with an account |

## Free Plan limits (checked 15 Oct 2026 — see supabase.com/pricing)
- Database 500 MB · File storage 1 GB · Egress 5 GB/month · 50,000 monthly active users · 2 projects · 50 MB max file.
- **No automatic backups** → run `npm run db:backup` at least weekly (it also runs before every migration).
- **The project pauses after 1 week without activity.** The daily website rebuild (06:00) calls the database,
  which normally keeps it active.
- Never enter a credit card or choose "Upgrade" unless management has approved paid hosting.

Expected use: 52 maids ≈ well under 1 MB of data; photos are 720×900 WebP (≈ 60–120 KB each), so 52 photos ≈ 5 MB.

## One-time setup (administrator)
1. Create a free account at supabase.com and a project named `final-choice`, region **Southeast Asia (Singapore)**.
   Choose a strong database password and keep it in the office password manager.
2. **SQL Editor** → run `migrations/0001_maid_database.sql`, then `migrations/0002_storage.sql`.
3. **Authentication → Sign In / Providers → Email**: turn OFF "Allow new users to sign up".
   **Authentication → URL Configuration**: Site URL = `https://yukisph88.github.io/final-choice-maid-agency/staff/`.
4. **Authentication → Users → Add user → Send invitation** for each staff member, then in **SQL Editor**:
   ```sql
   insert into public.staff (user_id, email, full_name, role)
   select id, email, 'Full Name', 'admin'   -- admin | editor | viewer
   from auth.users where email = 'name@apfcsb.com';
   ```
   - **viewer**: can look only · **editor**: add, edit, upload photos, change status, publish · **admin**: also delete and manage staff.
   - To remove someone: `update public.staff set active = false where email = '…';`
5. On the office PC, copy `.env.example` to `.env.local` and fill in the project URL, the **anon** key and the
   **service_role** key (Project Settings → API). `.env.local` is never uploaded.
6. `npm run db:check` — every check must pass.

## Moving the existing 52 records
```
npm run db:migrate                 # dry run: lists what would be added — changes nothing
npm run db:migrate -- --apply      # copies records + private photos; nobody is published
npm run db:check
```
Running it again never creates duplicates (matched by reference code).

## Connecting the website (only after testing is approved)
GitHub → Settings → Secrets and variables → Actions → **Variables**:
`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (public key only), `PUBLIC_MAIDS_SOURCE=supabase`,
and `PUBLIC_DEMO_CANDIDATES=false` when real approved profiles should replace the demo profiles.

- **Availability** changes appear on the website as soon as a visitor opens the page (no push needed).
- **New or edited profiles** appear after the daily rebuild at 06:00, or at once via GitHub → Actions →
  "Build and deploy website" → **Run workflow**.
- Search engines index the profile text, name, photo and the status from the last rebuild. The live status
  is added in the visitor's browser, so search results may show a status up to one day old.


## Going live with the real profiles (Supabase route) — in this order
Nothing real is uploaded or published until steps 1–4 are confirmed in writing (see `docs/publication-authorisation.md`
and `DATA-PROCESSING-CHECKLIST.md`).

1. **Approvals confirmed**: management decision, data-processing / region decision, candidate privacy notice and consent forms.
2. **One-time SQL** (Supabase → SQL Editor): run `migrations/0004_public_status_confirmed.sql` (replaces two read functions;
   deletes nothing). It makes the website show a status only when staff have *confirmed* it.
   Then run `migrations/0005_staff_portal.sql` (the staff portal: placements, documents, audit log, availability verification,
   role rules, staff-account functions; it only adds things and tightens publication to administrators — read the notes at its top).
   Afterwards `npm run db:roletest` (temporary users and synthetic data, all removed again) must pass before the portal is used.
3. **Staff accounts** (step 4 above) — at least one admin and one editor; administrators can also add staff in the portal.
4. **Migrate** (internal import; not gated by an approval file — see `DATA-PROCESSING-CHECKLIST.md` §3 for what is still required of the company): `npm run backup:local` → `npm run db:migrate` (dry run) → `npm run db:migrate -- --apply` → `npm run db:check`.
   All 52 arrive *unpublished*; their photos go to the **private** bucket.
5. **Approve maids**: staff complete `private-biodata/approval/Maid_Approval_Checklist.xlsx` (consent, date, photo consent, name display,
   discrepancies resolved, approved, initials), then `npm run db:approvals` (dry run) → `npm run db:approvals -- --apply`.
   Only approved rows are published; their approved photo is copied to the public photo bucket. Signing a row never
   confirms availability — maids stay "Availability to be confirmed" until staff confirm a status.
6. **Connect the website** (GitHub → repo → Settings → Secrets and variables → Actions → *Variables*):
   `PUBLIC_SUPABASE_URL` (project URL), `PUBLIC_SUPABASE_ANON_KEY` (the *publishable* key only), `PUBLIC_MAIDS_SOURCE` = `supabase`,
   `PUBLIC_DEMO_CANDIDATES` = `false`. Never add the secret key. Then Actions → *Build and deploy website* → **Run workflow**.
7. **Check the live site**: names, photos, "Availability to be confirmed", English and BM, mobile; Google indexing stays off until launch approval.

### Withdrawing a maid (consent withdrawn)
`npm run db:approvals` after un-ticking her row (or untick *Published* in the dashboard) → then GitHub → Actions →
**Run workflow** so her profile page text disappears too. The database stops listing her immediately and her public photo
is deleted at once, but a cached copy of the photo can stay reachable at its old address for up to 5 minutes. The old
profile page stays online until that rebuild, so run it straight away.

## Backups and recovery
- `npm run db:backup` → `private-biodata/db-backups/<date-time>/` (all records, history, staff list, every file,
  and a privacy check of the public photos).
- `npm run db:restore -- private-biodata/db-backups/<folder>` (dry run) then add `--apply`.
- **Paused project**: Supabase dashboard → the project → **Restore project** (free; usually a few minutes).
  Paused projects can be restored for 90 days; after that, create a new project, run the two SQL files,
  and `npm run db:restore -- <latest backup> --apply`.
- The old CSV system (`npm run maids:*`) keeps working and is not changed by the database.
