// Branded A4 biodata PDF for one PUBLISHED maid, built from the same data the profile page shows.
// Public information only: authorised display name, photo (only with photo consent), reference code, nationality, marital status (if recorded),
// experience, skills, languages, work history, summary, availability label, company contact. Never age/religion unless authorised, never notes or documents.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { site } from './config';
import { t, formatDate } from '../i18n/ui';
import { shownStatus, languageName, countryName, type Maid } from './maids';
import type { Lang } from '../i18n/routes';

const NAVY = '#1f3a93'; const BLUE = '#2563eb'; const INK = '#141c2e'; const MUTED = '#566379'; const LINE = '#dde5f0'; const TINT = '#eef3ff';
const W = 595.28; const H = 841.89; const M = 40; const FOOT = 84; const BOTTOM = H - FOOT;
const FONT = (f: string) => join(process.cwd(), 'node_modules/@fontsource', f);
const OK_PUNCT = new Set([0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x2022, 0xb7]);
/** The embedded fonts cover Latin letters; anything else is replaced rather than printed as a broken glyph. */
const safe = (s: unknown) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().replace(/[^\x20-\x7e -ɏ]/g, (c) => (OK_PUNCT.has(c.codePointAt(0)!) ? c : '?'));

const LABEL = {
  en: { title: 'Domestic Helper Biodata', ref: 'Reference code', page: 'Page', of: 'of', contact: 'Enquiries', wa: 'WhatsApp', summary: 'About', facts: 'Details', whatsapp: 'To arrange an interview, WhatsApp us and quote the reference code', agency: 'Licensed private employment agency', photoRequest: 'Photo available on request', cont: 'continued' },
  ms: { title: 'Biodata Pembantu Rumah', ref: 'Kod rujukan', page: 'Halaman', of: 'daripada', contact: 'Pertanyaan', wa: 'WhatsApp', summary: 'Tentang calon', facts: 'Maklumat', whatsapp: 'Untuk mengatur temu duga, WhatsApp kami dan nyatakan kod rujukan', agency: 'Agensi pekerjaan swasta berlesen', photoRequest: 'Gambar boleh diberi atas permintaan', cont: 'sambungan' },
} as const;

async function loadPhoto(m: Maid): Promise<Buffer | null> {
  if (!m.photo || !m.publication.photoConsent) return null;
  try {
    const raw = /^https:\/\//.test(m.photo) ? Buffer.from(await (await fetch(m.photo)).arrayBuffer()) : await readFile(join(process.cwd(), 'public', m.photo.replace(/^\//, '')));
    return await sharp(raw).rotate().resize(540, 675, { fit: 'cover', position: 'top' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  } catch { return null; }   // a missing photo never stops the PDF
}

export async function buildBiodataPdf(m: Maid, lang: Lang): Promise<Buffer> {
  const T = t(lang); const P = T.profile; const L = LABEL[lang]; const ms = lang === 'ms';
  const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: FOOT, left: M, right: M }, bufferPages: true, autoFirstPage: true,
    info: { Title: `${m.displayName ? `${safe(m.displayName)} — ` : ''}${L.ref} ${m.code}`, Author: site.company.legalName, Subject: L.title, Creator: 'Final Choice website build' } });
  doc.registerFont('Body', FONT('ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff'));
  doc.registerFont('Semi', FONT('ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff'));
  doc.registerFont('Head', FONT('montserrat/files/montserrat-latin-700-normal.woff'));
  const chunks: Buffer[] = []; doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((ok, no) => { doc.on('end', () => ok(Buffer.concat(chunks))); doc.on('error', no); });

  const name = m.displayName ? safe(m.displayName) : '';
  const summary = ms && m.summary_ms ? m.summary_ms : m.summary;
  const summaryFallback = ms && !m.summary_ms && Boolean(m.summary);
  const st = shownStatus(m);
  const logo = await sharp(await readFile(join(process.cwd(), 'public/images/logo-final-choice.png'))).resize({ width: 360 }).png({ compressionLevel: 9, palette: true }).toBuffer();
  const photo = await loadPhoto(m);

  // ---------- header (first page) ----------
  doc.rect(0, 0, W, 92).fill(NAVY);
  doc.roundedRect(M, 16, 92, 60, 8).fill('#ffffff'); doc.image(logo, M + 6, 20, { fit: [80, 52], align: 'center', valign: 'center' });
  doc.fillColor('#ffffff').font('Head').fontSize(17).text(L.title.toUpperCase(), M + 112, 24, { width: W - M * 2 - 112, lineBreak: false });
  doc.font('Body').fontSize(9.5).fillColor('#cfdcff').text(safe(site.company.legalName), M + 112, 50, { width: W - M * 2 - 112, lineBreak: false });
  doc.text(safe(`${L.agency} · ${site.company.licence}`), M + 112, 64, { width: W - M * 2 - 112, lineBreak: false });

  // ---------- photo + identity ----------
  const px = M; const py = 112; const pw = 160; const ph = 200;
  doc.roundedRect(px - 2, py - 2, pw + 4, ph + 4, 8).lineWidth(1).strokeColor(LINE).stroke();
  if (photo) { doc.save(); doc.roundedRect(px, py, pw, ph, 6).clip(); doc.image(photo, px, py, { width: pw, height: ph }); doc.restore(); }
  else { doc.roundedRect(px, py, pw, ph, 6).fill(TINT); doc.fillColor(MUTED).font('Body').fontSize(10).text(L.photoRequest, px + 12, py + ph / 2 - 8, { width: pw - 24, align: 'center' }); }
  // availability badge
  const stText = safe(T.status[st]); const confirmed = st !== 'unconfirmed';
  doc.roundedRect(px, py + ph + 12, pw, 26, 13).fill(confirmed ? '#e8f6ee' : '#fff4e0');
  doc.fillColor(confirmed ? '#0e7a40' : '#8a5300').font('Semi').fontSize(9).text(stText, px + 6, py + ph + 20, { width: pw - 12, align: 'center', lineBreak: false });
  let leftEnd = py + ph + 12 + 26;
  if (confirmed) { doc.fillColor(MUTED).font('Body').fontSize(8).text(safe(`${T.card.updated} ${formatDate(m.statusUpdated, lang)}`), px, leftEnd + 6, { width: pw, align: 'center' }); leftEnd += 20; }

  const rx = M + pw + 26; const rw = W - M - rx;
  let y = 112;
  doc.fillColor(NAVY).font('Head').fontSize(name.length > 28 ? 17 : 21).text(name || `${P.reference} ${m.code}`, rx, y, { width: rw });
  y = doc.y + 4;
  if (name) { doc.fillColor(MUTED).font('Body').fontSize(11).text(`${T.card.ref}: `, rx, y, { continued: true }).font('Semi').fillColor(INK).text(m.code); y = doc.y + 8; }
  // key facts
  const facts: [string, string][] = [[P.code, m.code], [P.nationality, T.nationality[m.nationality]]];
  if (m.publication.showAge && m.age) facts.push([T.card.age, String(m.age)]);
  if (m.religion && m.publication.showReligion) facts.push([T.card.religion, safe(m.religion)]);
  if (m.maritalStatus) facts.push([P.maritalStatus, safe(m.maritalStatus)]);
  facts.push([P.workExperience, `${m.experienceYears === undefined ? T.card.notStated : m.experienceYears === 0 ? T.card.newHelper : T.card.years(m.experienceYears)}${m.overseasExperience ? ` ${P.includingOverseas}` : ''}`]);
  const interview = ms && m.interviewAvailability_ms ? m.interviewAvailability_ms : m.interviewAvailability; if (interview) facts.push([P.interview, safe(interview)]);
  doc.roundedRect(rx, y, rw, 0.1, 0).fill(LINE); y += 8;
  for (const [k, v] of facts) {
    const h = Math.max(doc.font('Semi').fontSize(10).heightOfString(safe(v), { width: rw - 128 }), 14);
    doc.fillColor(MUTED).font('Body').fontSize(10).text(safe(k), rx, y, { width: 118 }); doc.fillColor(INK).font('Semi').fontSize(10).text(safe(v), rx + 128, y, { width: rw - 128 });
    y += h + 5; doc.moveTo(rx, y - 2).lineTo(rx + rw, y - 2).lineWidth(0.5).strokeColor(LINE).stroke();
  }
  y += 6;

  // ---------- helpers for the flowing part ----------
  const ensure = (need: number) => { if (doc.y + need > BOTTOM) { doc.addPage(); drawSlim(); doc.y = 70; } };
  const drawSlim = () => { doc.rect(0, 0, W, 40).fill(NAVY); doc.fillColor('#fff').font('Head').fontSize(10).text(safe(`${name ? `${name} · ` : ''}${m.code}`), M, 15, { width: W - M * 2, lineBreak: false }); doc.fillColor('#cfdcff').font('Body').fontSize(8.5).text(`${L.title} · ${L.cont}`, M, 15, { width: W - M * 2, align: 'right', lineBreak: false }); };
  const heading = (txt: string, x: number, w: number) => { doc.fillColor(NAVY).font('Head').fontSize(11).text(txt.toUpperCase(), x, doc.y, { width: w }); const yy = doc.y + 2; doc.moveTo(x, yy).lineTo(x + w, yy).lineWidth(1.2).strokeColor(BLUE).stroke(); doc.y = yy + 7; };

  // summary beside the photo
  doc.x = rx; doc.y = y;
  if (summary) {
    heading(L.summary, rx, rw);
    for (const para of summary.split(/\n\s*\n/).filter(Boolean)) { doc.fillColor(INK).font('Body').fontSize(10).text(safe(para), rx, doc.y, { width: rw, lineGap: 2.2 }); doc.moveDown(0.5); }
    if (summaryFallback) { doc.fillColor(MUTED).font('Body').fontSize(8.5).text(safe(P.summaryInEnglish), rx, doc.y, { width: rw }); }
  }
  // continue below whichever column is lower, at full width
  doc.x = M; doc.y = Math.max(doc.y, leftEnd) + 10;

  // ---------- skills ----------
  const skills = (Object.keys(m.skills) as (keyof Maid['skills'])[]).filter((k) => m.skills[k] !== 'none');
  if (skills.length) {
    ensure(40 + Math.ceil(skills.length / 2) * 22); heading(P.skills, M, W - M * 2);
    const colW = (W - M * 2 - 16) / 2; const y0 = doc.y;
    skills.forEach((k, i) => {
      const cx = M + (i % 2) * (colW + 16); const cy = y0 + Math.floor(i / 2) * 24;
      doc.roundedRect(cx, cy, colW, 20, 4).fill(TINT);
      doc.fillColor(INK).font('Semi').fontSize(9.5).text(safe(T.skill[k]), cx + 8, cy + 5.5, { width: colW * 0.55, lineBreak: false });
      doc.fillColor(m.skills[k] === 'experienced' ? '#0e7a40' : MUTED).font('Body').fontSize(9.5).text(safe(T.level[m.skills[k]]), cx + colW * 0.55, cy + 5.5, { width: colW * 0.45 - 8, align: 'right', lineBreak: false });
    });
    doc.y = y0 + Math.ceil(skills.length / 2) * 24 + 10;
  }

  // ---------- languages ----------
  if (m.languages.length) {
    ensure(60); heading(P.languages, M, W - M * 2);
    doc.fillColor(INK).font('Body').fontSize(10).text(m.languages.map((l) => safe(`${languageName(l.language, lang)}${l.level ? ` (${T.langLevel[l.level]})` : ''}`)).join('   ·   '), M, doc.y, { width: W - M * 2, lineGap: 2 });
    doc.moveDown(0.6);
  }

  // ---------- employment history (rows never split; header repeats on a new page) ----------
  if (m.employmentHistory.length) {
    ensure(70); heading(P.history, M, W - M * 2);
    const cols = [{ x: M, w: 108 }, { x: M + 108, w: 92 }, { x: M + 200, w: W - M * 2 - 200 }];
    const head = () => { const hy = doc.y; doc.rect(M, hy, W - M * 2, 18).fill(NAVY); doc.fillColor('#fff').font('Semi').fontSize(9); [P.country, P.duration, P.duties].forEach((h, i) => doc.text(safe(h), cols[i].x + 6, hy + 5, { width: cols[i].w - 10, lineBreak: false })); doc.y = hy + 18; };
    head();
    m.employmentHistory.forEach((e, i) => {
      const cells = [safe(countryName(e.country, lang)), safe(e.duration), safe(ms && e.duties_ms ? e.duties_ms : e.duties)];
      doc.font('Body').fontSize(9.5);
      const rh = Math.max(...cells.map((c, j) => doc.heightOfString(c || ' ', { width: cols[j].w - 12, lineGap: 1.5 }))) + 12;
      if (doc.y + rh > BOTTOM) { doc.addPage(); drawSlim(); doc.y = 56; head(); }
      const ry = doc.y; if (i % 2) doc.rect(M, ry, W - M * 2, rh).fill('#f7f9fd');
      doc.fillColor(INK); cells.forEach((c, j) => doc.font(j === 0 ? 'Semi' : 'Body').fontSize(9.5).text(c, cols[j].x + 6, ry + 6, { width: cols[j].w - 12, lineGap: 1.5 }));
      doc.moveTo(M, ry + rh).lineTo(W - M, ry + rh).lineWidth(0.5).strokeColor(LINE).stroke(); doc.y = ry + rh;
    });
    doc.moveDown(0.5);
  }

  // ---------- notes ----------
  ensure(58);
  doc.roundedRect(M, doc.y, W - M * 2, 0.1, 0).fill(LINE); doc.y += 6;
  if (!confirmed) { doc.fillColor('#8a5300').font('Semi').fontSize(9).text(safe(P.unconfirmedNote), M, doc.y, { width: W - M * 2, lineGap: 1.5 }); doc.moveDown(0.6); }
  doc.fillColor(MUTED).font('Body').fontSize(8.5).text(safe(P.declared), M, doc.y, { width: W - M * 2, lineGap: 1.5 });

  // ---------- footer on every page ----------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i); doc.page.margins.bottom = 0;   // the footer sits inside the bottom margin; without this pdfkit would start a new page
    const fy = H - FOOT + 14; doc.moveTo(M, fy).lineTo(W - M, fy).lineWidth(1).strokeColor(BLUE).stroke();
    const a = site.company.address; const addr = safe(`${a.street}, ${a.postcode} ${a.city}`);
    doc.fillColor(NAVY).font('Semi').fontSize(8.8).text(safe(site.company.legalName), M, fy + 7, { width: 300, lineBreak: false });
    doc.fillColor(MUTED).font('Body').fontSize(8).text(addr, M, fy + 19, { width: 300, lineBreak: false }).text(safe(`${site.company.email}`), M, fy + 30, { width: 300, lineBreak: false });
    doc.fillColor(INK).font('Semi').fontSize(8.8).text(safe(`${L.wa}: ${site.contact.phoneDisplay} (${site.contact.consultantName})`), W - M - 230, fy + 7, { width: 230, align: 'right', lineBreak: false });
    doc.fillColor(MUTED).font('Body').fontSize(8).text(safe(`wa.me/${site.contact.whatsappNumber}`), W - M - 230, fy + 19, { width: 230, align: 'right', lineBreak: false });
    doc.text(safe(`${L.ref} ${m.code}  ·  ${L.page} ${i + 1} ${L.of} ${range.count}`), W - M - 230, fy + 30, { width: 230, align: 'right', lineBreak: false });
    doc.fillColor(MUTED).fontSize(7.6).text(safe(L.whatsapp), M, fy + 44, { width: W - M * 2, align: 'center', lineBreak: false });
  }
  doc.end();
  return done;
}
