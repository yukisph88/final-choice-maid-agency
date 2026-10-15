// Post-build quality checks for the generated site in dist/.
// Run: npm run build && npm run test:site
// Fails (exit 1) on: broken internal links/images, missing or duplicate titles/descriptions,
// missing canonical, not exactly one <h1>, invalid JSON-LD, forbidden schema types,
// sitemap URLs that do not exist, and data that looks like passport / IC numbers.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const BASE = (process.env.BASE_PATH ?? '/final-choice-maid-agency').replace(/\/$/, '');
const errors = [];
const warn = [];

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const toUrl = (f) => '/' + relative(DIST, f).split(sep).join('/').replace(/index\.html$/, '');

function resolveTarget(urlPath) {
  let p = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
  if (!p.startsWith(BASE + '/') && p !== BASE) return { outside: true };
  p = p.slice(BASE.length) || '/';
  const candidates = p.endsWith('/') ? [join(DIST, p, 'index.html')] : [join(DIST, p), join(DIST, p, 'index.html')];
  return { ok: candidates.some((c) => existsSync(c)) };
}

const titles = new Map();
const descs = new Map();
const PASSPORT = /\b[A-Z]{1,2}\d{7,8}\b/; // e.g. passport-like numbers
const MYKAD = /\b\d{6}-\d{2}-\d{4}\b/;
const SITE = (process.env.SITE_URL ?? 'https://yukisph88.github.io').replace(/\/$/, '');
const pages = new Map(); // absolute URL → { url, htmlLang, hreflang }

for (const f of htmlFiles) {
  const html = readFileSync(f, 'utf8');
  const url = toUrl(f);
  const is404 = url.startsWith('/404');
  const isRoot = url === '/'; // language entry page: forwards to /en/ or /ms/
  const isStaff = url.startsWith('/staff/'); // private staff dashboard: no language versions, noindex, not in sitemap
  const htmlLang = html.match(/<html lang="([^"]+)"/)?.[1];
  const canonicalHref = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  const hreflang = Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  if (!is404 && !isRoot && !isStaff) {
    const own = `${SITE}${BASE}${url}`;
    pages.set(own, { url, htmlLang, hreflang });
    const prefix = url.split('/')[1];
    if (!['en', 'ms'].includes(prefix)) errors.push(`${url}: page outside /en/ or /ms/`);
    if ((prefix === 'en' && htmlLang !== 'en-MY') || (prefix === 'ms' && htmlLang !== 'ms-MY')) errors.push(`${url}: <html lang="${htmlLang}"> does not match URL language`);
    if (canonicalHref !== own) errors.push(`${url}: canonical is not self-referencing (${canonicalHref})`);
  }
  const decode = (s) => s?.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim());
  const desc = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim());
  const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '';
  if (!title) errors.push(`${url}: missing <title>`);
  if (!desc) errors.push(`${url}: missing meta description`);
  if (!html.includes('rel="canonical"')) errors.push(`${url}: missing canonical`);
  if (!isRoot && !/rel="stylesheet"|<style[\s>]/.test(html)) errors.push(`${url}: no stylesheet linked (page would render unstyled)`);
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1 && !isRoot) errors.push(`${url}: has ${h1} <h1> elements (expected 1)`);
  if (!is404 && !isRoot) {
    if (title) titles.set(title, [...(titles.get(title) || []), url]);
    if (desc) descs.set(desc, [...(descs.get(desc) || []), url]);
  }
  if (title && title.length > 70) warn.push(`${url}: title is ${title.length} chars`);
  if (desc && (desc.length < 70 || desc.length > 170)) warn.push(`${url}: description is ${desc.length} chars`);

  // Links and images
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  const srcsets = [...html.matchAll(/srcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(' ')[0]));
  for (const r of [...refs, ...srcsets]) {
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/.test(r)) continue;
    const abs = r.startsWith('/') ? r : new URL(r, `http://x${BASE}${url}`).pathname; // markdown uses relative links
    const t = resolveTarget(abs);
    if (t.outside) errors.push(`${url}: link outside base path: ${r}`);
    else if (!t.ok) errors.push(`${url}: broken link → ${r}`);
  }
  // WhatsApp links must carry a number
  for (const m of html.matchAll(/href="https:\/\/wa\.me\/([^"?]*)/g)) {
    if (!/^60\d{8,10}$/.test(m[1])) errors.push(`${url}: invalid WhatsApp link number "${m[1]}"`);
  }
  // JSON-LD
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      const types = JSON.stringify(data).match(/"@type":"([^"]+)"/g) || [];
      for (const t of types) if (/AggregateRating|Review|JobPosting/.test(t)) errors.push(`${url}: forbidden schema ${t}`);
    } catch (e) {
      errors.push(`${url}: invalid JSON-LD (${e.message})`);
    }
  }
  // Privacy patterns in visible text
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  if (PASSPORT.test(text)) errors.push(`${url}: text looks like a passport number: ${text.match(PASSPORT)[0]}`);
  if (MYKAD.test(text)) errors.push(`${url}: text looks like an IC number: ${text.match(MYKAD)[0]}`);
}

// hreflang: every alternate must exist, point back (reciprocal) and include x-default
let hreflangPages = 0;
for (const [own, pg] of pages) {
  if (!Object.keys(pg.hreflang).length) continue;
  hreflangPages++;
  for (const need of ['en-MY', 'ms-MY', 'x-default']) if (!pg.hreflang[need]) errors.push(`${pg.url}: hreflang missing ${need}`);
  if (pg.hreflang[pg.htmlLang] !== own) errors.push(`${pg.url}: hreflang for its own language does not point to itself`);
  for (const code of ['en-MY', 'ms-MY']) {
    const target = pages.get(pg.hreflang[code]);
    if (!target) { errors.push(`${pg.url}: hreflang ${code} → page does not exist (${pg.hreflang[code]})`); continue; }
    if (target.hreflang[pg.htmlLang] !== own) errors.push(`${pg.url}: hreflang ${code} target does not link back`);
  }
}
const enCount = [...pages.values()].filter((p) => p.htmlLang === 'en-MY').length;
const msCount = [...pages.values()].filter((p) => p.htmlLang === 'ms-MY').length;
console.log(`pages: ${enCount} English, ${msCount} Bahasa Melayu, ${hreflangPages} with reciprocal hreflang`);

for (const [t, urls] of titles) if (urls.length > 1) errors.push(`Duplicate title "${t}": ${urls.join(', ')}`);
for (const [d, urls] of descs) if (urls.length > 1) errors.push(`Duplicate description on: ${urls.join(', ')}`);

// Sitemap
const sm = join(DIST, 'sitemap.xml');
if (!existsSync(sm)) errors.push('sitemap.xml missing');
else {
  const locs = [...readFileSync(sm, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const l of locs) {
    const path = new URL(l).pathname;
    const t = resolveTarget(path);
    if (!t.ok) { errors.push(`sitemap: URL has no page: ${l}`); continue; }
    const page = readFileSync(join(DIST, path.slice(BASE.length), 'index.html'), 'utf8');
    const canon = page.match(/rel="canonical" href="([^"]+)"/)?.[1];
    if (canon !== l) errors.push(`sitemap: ${l} canonical mismatch (${canon})`);
  }
  const xml = readFileSync(sm, 'utf8');
  const alts = [...xml.matchAll(/<xhtml:link rel="alternate" hreflang="[^"]+" href="([^"]+)"/g)].map((m) => m[1]);
  for (const a of alts) if (!pages.has(a)) errors.push(`sitemap: hreflang alternate has no page: ${a}`);
  console.log(`sitemap: ${locs.length} URLs, ${alts.length} hreflang alternates`);
}
// Secrets: a Supabase SERVICE ROLE key must never be in the website (it bypasses all database security)
for (const f of files.filter((x) => /\.(html|js|json|txt|xml)$/.test(x))) {
  const text = readFileSync(f, 'utf8');
  for (const jwt of text.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || []) {
    try { if (JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role !== 'anon') errors.push(`${relative(DIST, f)}: contains a non-public Supabase key — remove it`); } catch { /* not a key */ }
  }
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) errors.push(`${relative(DIST, f)}: contains a Supabase SECRET key — remove it`);
}
if (!existsSync(join(DIST, 'robots.txt'))) errors.push('robots.txt missing');
if (!existsSync(join(DIST, '404.html'))) errors.push('404.html missing');

console.log(`checked ${htmlFiles.length} HTML pages`);
warn.forEach((w) => console.log('  warn:', w));
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  errors.forEach((e) => console.error('  ✗', e));
  process.exit(1);
}
console.log('✓ all checks passed');
