# Before the real maid records go to Supabase — approvals checklist

The 52 real records stay on the office PC until **every box below is ticked** by a person with authority
(management / the person responsible for PDPA matters). This is a practical checklist, not legal advice.

## 1. Decisions to confirm
- [ ] **Hosting region.** The current project is in **Tokyo, Japan**. Supabase has no Malaysian region, so any region is a
      transfer of personal data outside Malaysia. A project's region **cannot be changed later**; to use Singapore instead,
      create a new project now (while it is empty) and re-run the three SQL files and the connection tests.
- [ ] **Cross-border transfer is acceptable** for the company, and the reason is written down
      (e.g. destination has comparable data-protection law and Supabase's Data Processing Agreement applies).
- [ ] **Supabase Data Processing Agreement** accepted (Supabase dashboard → Organisation settings → Legal / DPA).
- [ ] **Candidate privacy notice / consent forms** tell candidates that their biodata is stored with a cloud provider
      outside Malaysia, and what is published on the website (name, photo, age, religion only with consent).
- [ ] **Religion** (sensitive data): published only with explicit consent. Stored privately for all 52 records.
- [ ] **Staff access rules**: who may view, edit, publish and delete (roles: viewer / editor / admin).
- [ ] **Retention**: how long records of placed or withdrawn maids are kept, and who deletes them.
- [ ] **Backups**: `npm run backup:local` (office PC) and `npm run db:backup` (database) at least weekly; a second copy kept off the PC.

## 2. What the migration uploads (and what it never uploads)

| Uploaded to Supabase (private) | NEVER uploaded |
|---|---|
| Reference code, nationality, age, marital status, religion | Passport numbers, IC numbers, phone numbers, addresses |
| Name (full name and given name) | Original biodata PDFs and interview videos |
| Experience years, skills, languages, work-history summary (country, years, duties) | Medical reports, FOMEMA results, family health details |
| English and Bahasa Melayu profile text | Consent forms and any identity documents |
| Availability status and who set it | Employer names or addresses |
| Staff-only notes (reference-level flags, no document numbers) | |
| One cropped working photo per maid (720×900 WebP, ≈ 20 KB) in the **private** bucket | |

The migration script refuses to upload any record whose text looks like a passport, IC or phone number, and never uploads
PDF files. Every record is imported as **unpublished**; consent, photo consent and name consent all start as "not given".

## 3. The migration command is no longer gated by an approval file
On the owner's instruction (2026-10-19, see `private-biodata/approval/internal-import-authorisation.md`) `npm run db:migrate -- --apply` no longer requires
`data-processing-approval.json`. **This does not remove any legal or company data-protection obligation** — informing candidates, the cross-border
transfer to the Tokyo region, the Supabase data-processing terms and access/retention rules stay the company's responsibility; the items above remain a checklist
for the company, not for the script. What the system itself still enforces: staff login and roles, Row Level Security, PRIVATE storage, duplicate protection,
protection of staff-edited records (only empty fields are filled; `--only-new` leaves existing records alone) and the rule that an import **never publishes anyone and never
records publication consent**. Publication on the public website is a separate, protected process (consent, date, approver, resolved discrepancies — enforced by the database).

## 4. Importing
1. Create the approval record (above), then `npm run backup:local`
2. `npm run db:migrate` — dry run; read the list.
3. `npm run db:migrate -- --apply`
4. `npm run db:check`
5. Create staff accounts (see `README.md`, step 4), then publish maids one by one as each consent is confirmed.
