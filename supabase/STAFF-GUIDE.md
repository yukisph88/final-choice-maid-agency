# Final Choice staff guide — the staff portal

Open **https://yukisph88.github.io/final-choice-maid-agency/staff/** (it is not linked anywhere on the public website) and sign in
with your own e-mail and password. On a phone use the **Menu** button. You are signed out after 60 minutes without activity.

## What each section does
| Section | Use it to… |
|---|---|
| **Dashboard** | See totals, availability, the placement pipeline, and what needs attention (unverified availability, missing photos, maids ready to publish). |
| **All Maid Biodata** | Search and filter all maids; open one to edit. **Import CSV** adds maids in bulk (never publishes). Administrators can **Export**. |
| **Add New Maid** | Import an existing biodata (recommended) or enter it manually. New maids start *private* and *To Be Confirmed*. |
| **Photo Management** | Upload, replace, re-crop and preview photos. Drag and zoom to crop. Photos are private until the maid is published with photo consent. |
| **Availability Tracking** | Set Available / On Hold / Booked / Pending Arrival / Hired / Withdrawn / To Be Confirmed, one by one or in bulk. Choosing a status records who verified it and when. **Re-verify** confirms a status is still right today. |
| **Applications & Placements** | Record employer, package, interview/booking/arrival dates and the stage. Moving a placement offers to update the maid's availability. |
| **Publication Approvals** | (Administrators.) Record written consent, date, approver initials, photo/name permission, then publish. Everyone else can view the state. |
| **Documents** | Store consent forms, contracts and similar files privately, with an access level (administrators only / administrators + editors / all staff). Identity and medical documents are always administrators only. |
| **Reports** | Register summary, availability verification, publication & consent, photo coverage, placements, staff activity. Print; administrators can export CSV (recorded in the audit log). |
| **Staff Management** | (Administrators.) Add staff, change roles, set a temporary password, deactivate. |
| **Settings** | Change your name and password. |

## Add New Maid — import the biodata, do not retype it
**Maid Management → Add New Maid → Import Existing Biodata** (the manual form is the secondary option).
1. Drop the biodata file (PDF, Word .docx or picture) on the box. Drop several files for a **bulk import**.
2. The document is read in your browser. The screen shows the **original on the left** and the **extracted details and photo on the right**.
   Amber = check against the document; red = not found. Fix anything wrong, then tick *I have compared…* and press **Confirm & Save**.
3. The maid is saved **private, unpublished, availability To Be Confirmed**, with your name and the time recorded. You land on her profile.

What is read: reference code, name, nationality, age, marital status, religion, work experience (country, years, duties), the E / W skill tick boxes,
the BM / BI(English) / CN language boxes, the Day Off box, remarks. Facts with no field of their own (children's ages, education, height, weight) go into the private internal notes.
What is **not** read: scanned pictures and scanned PDFs have no text — you type the details beside the original (the photo is still offered). Total years of experience and
salary are not printed on the standard biodata, so they stay blank. Only page 1 of a PDF is read.
Duplicates: a code that already exists is refused; you may choose to fill only the *empty* fields of the existing record. In a bulk import, **Ready to Save** records can be saved together
(they are marked "not individually reviewed" in their notes); anything else needs **Review**. Failed saves never leave a half-saved record or an orphan photo.
Original documents are *not* stored unless you tick *keep the original* (then only administrators and editors can open it).

## Roles
| | Administrator | Editor | Viewer |
|---|---|---|---|
| Read everything allowed to staff | ✓ | ✓ | ✓ |
| Add / edit biodata, photos, availability, placements, documents | ✓ | ✓ | — |
| Record consent, publish / unpublish, update website photo | ✓ | — | — |
| Delete (a **Withdrawn** maid, placements, documents) | ✓ | — | — |
| Export data, manage staff | ✓ | — | — |

The database enforces these rules — a hidden button is not the only protection.

## The maid profile
Tabs: Personal biodata · Experience & skills · Languages · Salary & rest day · Availability · Photos · Placement & employer ·
Internal notes · Documents · Public profile & approval · Change history. **Preview public version** shows exactly what a
visitor would see (English or Bahasa Melayu) and what stays hidden. The top of the page shows who changed it last and when;
**Change history** lists every change with the person and time.

## What appears on the website
Only maids an administrator has published after recording written consent. Availability labels update as soon as a visitor opens
the page; edited text, new publications and photos appear at the next website rebuild (daily, or GitHub → Actions →
*Build and deploy website* → **Run workflow**). Hired and Withdrawn maids are not listed.

## Everyday rules
- Never type passport, IC or phone numbers, addresses, medical or family-health details into a maid field.
- Do not upload identity or medical documents unless the company is authorised to hold them; if you do, keep them **administrators only**.
- Publish only with the candidate's written consent on file.
- Before a large import: administrators take a backup (office PC: `npm run db:backup`).

## Office PC commands (administrators)
| I want to… | Command |
|---|---|
| Back up | `npm run backup:local` and `npm run db:backup` |
| Check what a migration would do | `npm run db:migrate` (dry run; locked until the written approval record exists) |
| Send the 52 records to the database | `npm run db:migrate -- --apply` (after the approval record is confirmed; never publishes anyone) |
| Bulk-publish from the signed checklist | `npm run db:approvals` (dry run) then `npm run db:approvals -- --apply` |
| Staff accounts from the PC | `npm run db:staff -- list` / `add` / `reset` / `deactivate` |
