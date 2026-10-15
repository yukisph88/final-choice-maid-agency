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

## Backups and recovery
- `npm run db:backup` → `private-biodata/db-backups/<date-time>/` (all records, history, staff list, every file,
  and a privacy check of the public photos).
- `npm run db:restore -- private-biodata/db-backups/<folder>` (dry run) then add `--apply`.
- **Paused project**: Supabase dashboard → the project → **Restore project** (free; usually a few minutes).
  Paused projects can be restored for 90 days; after that, create a new project, run the two SQL files,
  and `npm run db:restore -- <latest backup> --apply`.
- The old CSV system (`npm run maids:*`) keeps working and is not changed by the database.
