# Publishing the real maid profiles on the public website — authorisation checklist

Nothing is pushed until every box in sections A and B is ticked by a person with authority. This is a practical
checklist, not legal advice. The 52 real profiles are ready; only the permissions are missing.

## A. Company decisions (once)

- [ ] **Written decision to publish** real candidate profiles on the public website, signed by management.
- [ ] **Understand what "public" means here.** The website is on GitHub Pages and the code lives in a *public* GitHub
      repository (the free plan needs this). Therefore:
  - Anyone with the link can view and **download the photos**. `noindex` / `robots.txt` only ask Google not to list the
    site — they are **not** privacy or a password.
  - The profile files and photos are stored in the repository's **Git history permanently**. Un-publishing a maid removes
    her from the live website, but the old files stay readable in the repository history and in any copies others made.
  - **Route chosen: Supabase.** Profiles are built from the private database instead of from repository files, so candidate
    data and photos are **not** in Git history, and removal takes effect at the next rebuild. It needs the database approvals
    in `supabase/DATA-PROCESSING-CHECKLIST.md`. (The published pages and photos are still public to anyone with the link.)
- [ ] **Candidate privacy notice / consent form** says: profile (name, photo, experience) is published on the agency's
      website; who can see it; how long; how to withdraw consent.
- [ ] **Withdrawal procedure** agreed (who removes a maid, target time — normally the same day: untick → `maids:approvals`
      → push, about 3 minutes).
- [ ] **Age and religion stay hidden** (default). Show them only with a candidate's explicit consent (religion is sensitive data).

## B. For each candidate (52)

Staff record these in `private-biodata/approval/Maid_Approval_Checklist.xlsx` (one row per maid):

- [ ] **Written publication consent on file** (signed form in the office file) → *Publication consent = Yes*, *Consent date*.
- [ ] **Photo consent** (the actual photo may be shown) → *Photo consent = Yes*. Check: face clear, no documents or other people
      in the picture.
- [ ] **Name**: *Full* (full name), *First* (given name only) or *None* (reference code only).
- [ ] **Biodata discrepancies resolved** → *Discrepancies resolved = Yes*. All 52 records carry staff notes to confirm
      (for example experience ticked on the form but not supported by the work history, own-child versus employer experience,
      newborn/elderly care, "afraid of dogs").
- [ ] **Initials of the approver** → *Approved by*.
- [ ] **Availability**: leave as is. Signing a row does **not** confirm availability; unconfirmed maids show
      "Availability to be confirmed" / "Status belum disahkan". Confirm real statuses with the status tools
      (`npm run maids:staff`, the status sheet or `maids:status`) when each maid's situation is verified.

Check the maids whose availability is flagged as uncertain **before** approving them (the list, with reasons, is in the private
file `private-biodata/MIGRATION-SUMMARY.md`; it includes a maid whose biodata also sits in the SOLD OUT folder, so she may already be placed).

## C. What the public website shows

| Shown publicly | Never shown or published |
|---|---|
| Name as heading (as far as name consent allows), reference code underneath | Age and religion (unless explicitly authorised) |
| Photo (720×900, ≈ 20 KB) | Original biodata PDFs, videos, consent forms |
| Nationality, years of experience, skills, languages | Passport / IC / phone numbers, addresses |
| Work history summary (country, years, duties) in English and BM | Medical or family-health details |
| "Availability to be confirmed" until staff confirm | Internal staff notes, source file names |
| WhatsApp "Request interview" button using the reference code | Private database, Supabase keys |

## D. Publishing, once A and B are done (Supabase route — chosen)

Candidate data is **not** committed to GitHub: profiles and photos live in the private-by-default Supabase project and the
website reads only what the database marks as published with consent.

1. Staff complete the checklist (section B) and save it.
2. `npm run db:approvals` (dry run) — read the list — then `npm run db:approvals -- --apply`.
   Approved rows are published (with the name/photo/age/religion permissions chosen); everyone else stays private.
3. Set the GitHub variables and run the workflow (see `supabase/README.md`, "Going live").
4. Verify the live site (names, photos, English/BM, mobile, privacy), then tell Claude "approved".

Before step 2 the real records must be migrated to Supabase — only after the data-processing approvals in
`supabase/DATA-PROCESSING-CHECKLIST.md`. A database check stops any record from being published without consent,
consent date and approver, and records without consent can never appear on the website.

## E. Wording
The directory heading now reads "Maid Biodata: Indonesian and Filipino Helpers" (page title, description and intro no longer imply verified availability).
