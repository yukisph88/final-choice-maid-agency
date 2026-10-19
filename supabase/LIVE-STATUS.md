# Live availability on the file-based public website (hybrid)

**What it does:** staff change a maid's availability in the Staff Portal (and confirm it) → Supabase saves it → the public GitHub Pages website shows it on the next page load. No GitHub deployment is needed for ordinary status changes.

**What does NOT change:** profile text, photos, profile pages and PDFs stay in the repository files (`PUBLIC_MAIDS_SOURCE=files`). Supabase is asked one question only: *"what is the confirmed availability of these reference codes?"*

## How it is wired
1. **Migration `0006_public_site_status.sql`** (run once in the SQL Editor) adds
   - `public_site_listing` — the reference codes already on the website. It is **not** publication and does not touch the maids' `published` flag or consent.
   - `public_site_status()` — read-only; for listed codes only it returns `code`, `status`, `verified_at`. Anything staff have not confirmed comes back as `to-be-confirmed`.
     It never returns names, notes, ages, salary, documents, photo paths, staff details — nor anything for a code that is not listed.
2. `npm run site:status-check` (read-only) proves every website profile matches exactly one database record **by reference code** (never by name); `npm run site:status-sync -- --apply` fills the listing with exactly the website's codes. The held-back maid is not on the website, so she is never listed.
3. The website script (`src/components/LiveStatus.astro`, active when `PUBLIC_LIVE_STATUS=true`) asks for the statuses after the page loads and updates the label (English and Bahasa Melayu).
4. At every build the same confirmed statuses are also baked into the static pages and PDFs.

## Safety rules (tested)
- If the request fails, times out (6 s), is empty or malformed, or a code has no row: **nothing changes** — every published card stays, with the label built into the page. A missing record is never read as Withdrawn or Hired.
- Only an **explicit confirmed** Hired or Withdrawn row marks a maid as no longer available. An initial status nobody confirmed is always shown as "Availability to be confirmed".
- Status mapping (database → English / Bahasa Melayu): to-be-confirmed → Availability to be confirmed / Status belum disahkan · available → Available / Tersedia · on-hold → On Hold / Ditahan · booked → Booked / Telah Ditempah · pending-arrival → Pending Arrival / Menunggu Ketibaan · hired → Hired / Telah Diambil Bekerja · withdrawn → Withdrawn / Ditarik Balik.

## When a maid becomes Hired or Withdrawn
- **Immediately (next page load):** her card disappears from the directory (search, filters and page counts adjust), and her profile page, if opened directly, shows "no longer available" and hides the Download Biodata button.
- **Not immediate:** hiding with JavaScript does **not** delete anything. Her static profile page and PDF files stay on GitHub Pages **until the next website build**. The build removes them automatically (it reads the confirmed status), and builds run every day at 06:00 Malaysia time, on every push to `main`, or when you run the workflow by hand (GitHub → Actions → *Build and deploy website* → Run workflow). Copies already downloaded or cached elsewhere cannot be recalled, and the files remain in the repository history.
- To remove someone from the files for good, also run `npm run maids:archive` (or delete her profile file) and push.

## Switching it off
Set the repository variable `PUBLIC_LIVE_STATUS` to `false` (Settings → Secrets and variables → Actions → Variables) and run the workflow: the site goes back to file-only statuses. Nothing else changes.
