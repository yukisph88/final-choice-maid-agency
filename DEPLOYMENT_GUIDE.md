# Deployment guide

The site is built by GitHub Actions (`.github/workflows/deploy.yml`) and published to GitHub Pages on every push to `main`.
Hosting, builds and HTTPS are free for public repositories.

## 1. GitHub Pages settings (one-time)

1. Repository → **Settings → Pages**.
2. **Build and deployment → Source: GitHub Actions** (not "Deploy from a branch").
3. Push to `main` (or run the workflow manually: **Actions → Build and deploy website → Run workflow**).
4. The site appears at `https://yukisph88.github.io/final-choice-maid-agency/`.

While `seo.indexing` is `false` in `src/data/site.yaml`, every page is `noindex`, so this preview will not compete with
the real domain in Google.

## 2. Connecting a custom domain

Choose the final address, e.g. `www.finalchoice.com.my` (recommended: use `www`).

### a. Tell the build about the domain
Repository → **Settings → Secrets and variables → Actions → Variables** → add:

| Name | Value |
|---|---|
| `SITE_URL` | `https://www.your-domain.com.my` |
| `BASE_PATH` | `/` |

These control canonical URLs, sitemap, structured data and all internal links.

### b. DNS records (at your domain registrar — e.g. MYNIC reseller, Exabytes, Shopify, Cloudflare)

For `www.your-domain.com.my`:

| Type | Host | Value |
|---|---|---|
| CNAME | `www` | `yukisph88.github.io` |

For the bare domain `your-domain.com.my` (so it redirects to www), add these **A** records on host `@`:
`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
(and optionally AAAA: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`).

Check the current values in GitHub's documentation before changing DNS:
<https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>

> Do not change DNS records that serve email (MX) or other existing websites. If the domain already hosts a live site,
> plan the switch with whoever manages it.

### c. GitHub settings
1. **Settings → Pages → Custom domain** → enter `www.your-domain.com.my` → Save. GitHub checks DNS (can take up to 24 h).
2. Tick **Enforce HTTPS** once available.
3. Recommended: verify the domain for your account (**GitHub profile → Settings → Pages → Add a domain**) to prevent takeover.
4. Re-run the workflow so canonicals use the new domain.

GitHub redirects the old `github.io` URL to the custom domain automatically.

## 3. Public launch switch

When management has approved content, prices and the privacy policy:

1. In `src/data/site.yaml`: `seo.indexing: true`; and `seo.privacyPolicyApproved: true` with the approval date.
2. Commit → wait for the green tick.
3. Follow the Search Console / Business Profile steps in SEO_SETUP.md.

## 4. Rolling back

Every deployment is a commit. To undo a bad change: open the commit on GitHub → **Revert** (or edit the file back) → commit.
The previous version is rebuilt and published.

## 5. Branch protection (recommended)

To ensure changes are reviewed before going live: **Settings → Branches → Add rule** for `main` → *Require a pull request
before merging*. Staff then propose edits ("Create a new branch… and start a pull request") and a manager approves.
