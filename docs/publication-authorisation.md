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
  - **Alternative that avoids this:** build the profiles from the private Supabase database instead of from repository
    files. Data is then not in Git history, and removal takes effect at the next rebuild. It needs the database approvals
    in `supabase/DATA-PROCESSING-CHECKLIST.md`. Decide which route before the first push.
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

## D. Publishing, once A and B are done

1. Staff complete the checklist (section B) and save it.
2. `npm run maids:approvals` — creates the public files for the **approved rows only** (others are not published).
3. In `.github/workflows/deploy.yml` set `PUBLIC_DEMO_CANDIDATES` to `'false'` so the demo profiles disappear.
4. `npm run build` and `npm run test:site`, then look at the result locally.
5. Tell Claude "approved, push" → push, GitHub Actions deploys, live check (names, photos, EN/BM, mobile, privacy scan).

## E. Wording to confirm before launch
The directory heading still reads "Available maids: Indonesian and Filipino helpers" and its intro says "latest available
domestic helpers". While availability is unconfirmed, consider "Maid biodata: Indonesian and Filipino helpers" / "Helper
profiles" (this changes the page title and description used by search engines, so it needs your approval).
