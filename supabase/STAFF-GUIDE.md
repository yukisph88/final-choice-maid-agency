# Final Choice staff guide — adding maids, availability and photos

Two ways to work. Use the dashboard once staff accounts exist; until then use the office-PC method.

## A. Staff dashboard (needs a staff account — set up after the database connection is approved)
Open **https://yukisph88.github.io/final-choice-maid-agency/staff/** (not linked anywhere on the website) and sign in.

| I want to… | Do this |
|---|---|
| Find a maid | Type the name or reference code in **Search**; filter by nationality, status or website. |
| Change availability | In the list, use the **status dropdown** on the maid's row. Placed, Unavailable and Withdrawn maids disappear from the website's listings. Pick the same status again to record "confirmed today". |
| Add a new maid | **+ Add maid** → fill the tabs (Details, Experience & skills, Profile text) → **Save**. New maids are *not* published. |
| Upload or change a photo | Open the maid → **Photo & files** → choose the picture → **Save**. It is cropped to a small portrait automatically and kept **private** until the maid is published with photo consent. |
| Publish a maid | Open the maid → **Availability & website** → tick *Written consent on file*, the date and your initials (and *Photo consent* if the photo may be shown) → tick **Published** → Save. The system refuses to publish without consent. |
| Unpublish a maid | Untick **Published** → Save (the website photo is removed automatically). |
| Add many maids | **Import CSV** (same columns as the office list). A preview shows what is new or changed; nothing is published. |
| See who changed what | **History** (all changes) or the maid's **History** tab. |

What appears on the website: availability changes show as soon as a visitor opens the page. Edited profile text, new
publications and new photos appear after the website rebuilds (daily at 06:00, or at once via GitHub → Actions →
*Build and deploy website* → **Run workflow**).

## B. Office PC (works today, no accounts needed)
Open a terminal in `C:\Users\user\Documents\final-choice-maid-agency`.

| I want to… | Command or file |
|---|---|
| Change availability (one maid) | `npm run maids:status -- REFERENCE_CODE STATUS INITIALS` (e.g. `reserved`) |
| Change availability (many) | `npm run maids:status-sheet` → edit the Excel file → `npm run maids:status-apply` |
| Add or correct a maid | Edit `private-biodata/import/maids.csv` (one row per maid), put the portrait in `private-biodata/import/photos/<CODE>.jpg`, then `npm run maids:import` |
| Check before anything goes to the database | `npm run db:migrate` (dry run — shows exactly what would be added or changed) |
| Send the changes to the database | `npm run db:migrate -- --apply` (takes a backup first; never publishes anyone) |
| Back up | `npm run backup:local` and `npm run db:backup` |

Rules for everyone
- Never type passport, IC or phone numbers, addresses, medical or family-health details into any maid field.
- Publish only with the candidate's written consent on file.
- Do not upload original PDFs or identity documents to the database. They stay in the office files.
