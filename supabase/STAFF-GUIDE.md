# Final Choice staff guide — the staff portal

Open **https://yukisph88.github.io/final-choice-maid-agency/staff/** (it is not linked anywhere on the public website) and sign in
with your own e-mail and password. On a phone use the **Menu** button. You are signed out after 60 minutes without activity.

## What each section does
| Section | Use it to… |
|---|---|
| **Dashboard** | See totals, availability, the placement pipeline, and what needs attention (unverified availability, missing photos, maids ready to publish). |
| **All Maid Biodata** | Search and filter all maids; open one to edit. **Import CSV** adds maids in bulk (never publishes). Administrators can **Export**. |
| **Add New Maid** | Register a maid. Only fill what the biodata says. New maids start *private* and *To Be Confirmed*. |
| **Photo Management** | Upload, replace, re-crop and preview photos. Drag and zoom to crop. Photos are private until the maid is published with photo consent. |
| **Availability Tracking** | Set Available / On Hold / Booked / Pending Arrival / Hired / Withdrawn / To Be Confirmed, one by one or in bulk. Choosing a status records who verified it and when. **Re-verify** confirms a status is still right today. |
| **Applications & Placements** | Record employer, package, interview/booking/arrival dates and the stage. Moving a placement offers to update the maid's availability. |
| **Publication Approvals** | (Administrators.) Record written consent, date, approver initials, photo/name permission, then publish. Everyone else can view the state. |
| **Documents** | Store consent forms, contracts and similar files privately, with an access level (administrators only / administrators + editors / all staff). Identity and medical documents are always administrators only. |
| **Reports** | Register summary, availability verification, publication & consent, photo coverage, placements, staff activity. Print; administrators can export CSV (recorded in the audit log). |
| **Staff Management** | (Administrators.) Add staff, change roles, set a temporary password, deactivate. |
| **Settings** | Change your name and password. |

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
