# Privacy checklist — candidate biodata and website data

Applies under Malaysia's Personal Data Protection Act 2010 (as amended). This is an operational checklist, not legal advice.

## Golden rules

1. **The GitHub repository is public.** Anything committed — including deleted files in the history — can be seen by anyone.
2. **No consent, no file.** A candidate's file, photo or PDF is added to the repository only after her signed publication consent is on file in the office.
3. **Reference codes only.** Use agency codes such as `FC-ID-0012`. Never use passport numbers, IC numbers or anything derived from them.
4. **Minimum data.** Publish only what helps an employer decide whether to interview.

## Never publish

- Passport numbers, IC / national ID numbers, visa or work-permit numbers
- Personal phone numbers, email addresses, social-media accounts
- Exact home addresses or village names
- Names of family members, children, previous employers
- Medical information or FOMEMA results
- Images of passports, IDs or any immigration document (check photo backgrounds too)
- Unredacted biodata from the source agency
- Full names (first name only, and only with consent; the template defaults to code only)

## Before publishing each candidate

- [ ] Signed consent covers: online publication, photo (if used), age (if shown), and how to withdraw
- [ ] Consent date recorded in `publication.consentDate`; approving staff initials in `publication.approvedBy`
- [ ] Photo checked: no documents, no other people, no location clues
- [ ] PDF is the **redacted** public version (re-open it and check every page)
- [ ] Employment history lists country, duration and duties only
- [ ] Second staff member has reviewed the file before commit (recommended)

## When status changes

- [ ] Placed → set `status: placed` (removes the profile from the site), delete the file within 30 days
- [ ] Withdrawn or consent withdrawn → delete the `.md`, photo and PDF **the same day**
- [ ] Data committed by mistake → treat as an incident: history rewrite (`git filter-repo`), contact GitHub Support to purge cached views, record the incident

## Website enquiries

- [x] The enquiry form does not store data: it opens WhatsApp with the details filled in (no "received" message is shown)
- [x] No submissions are written to the repository
- [x] Honeypot field filters simple spam bots
- [ ] If a form service (e.g. Web3Forms free tier) is connected later: update privacy policy sections 4 and 6, and check where the service stores data
- [ ] If Google Analytics is added: update privacy policy section 10 and consider a consent banner

## Built-in safeguards (automatic)

- The build **fails** if a profile is `published: true` without `consentRecorded: true`, or has a photo without `photoConsent: true`
- Only `published` + consented + not-`placed` candidates are rendered, listed or included in the sitemap
- `scripts/check-site.mjs` fails the deployment if page text contains passport-like (e.g. `A1234567`) or MyKad-like (`900101-14-5678`) patterns
- Files starting with `_` (the template) are never published
- `.gitignore` blocks `private/`, `.env` files and files containing `_unredacted`

## Before public launch

- [ ] Privacy policy reviewed and approved; `[CONFIRM]` items resolved; `seo.privacyPolicyApproved: true` in `site.yaml`
- [ ] Bahasa Malaysia version of the privacy policy prepared
- [ ] Candidate consent form wording approved
- [ ] Decide retention periods (enquiries, candidate records)
- [ ] Confirm whether a Data Protection Officer appointment is required
