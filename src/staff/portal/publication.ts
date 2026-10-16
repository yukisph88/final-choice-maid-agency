// Publication rules shared by the maid editor and the Approvals screen.
// The DATABASE enforces these rules (consent, date, approver, discrepancies resolved, administrator only); this file only
// explains them to staff and performs the photo copy that goes with publishing.
import { S, PRIVATE, PUBLIC, type Row, esc, slugOf, dialog, nameOf, thumbUrl, natLabel, fmtDate } from './core';
import { SKILLS, SKILL_LABEL, STATUS_LABEL, HIDDEN } from '../mapping.js';

export function readiness(m: Row) {
  const missing: string[] = [];
  if (!m.consent_recorded) missing.push('written consent not recorded');
  if (!m.consent_date) missing.push('consent date');
  if (!String(m.approved_by || '').trim()) missing.push('approver initials');
  if (!m.discrepancies_resolved) missing.push('biodata discrepancies not resolved');
  if (HIDDEN.includes(m.status)) missing.push(`status is ${STATUS_LABEL[m.status as keyof typeof STATUS_LABEL]}`);
  return { ready: missing.length === 0, missing };
}

/** The name the website may show, following the candidate's name permission (same rule as the database). */
export function publicName(m: Row): string | null {
  if (m.display_name_override && m.name_consent !== 'none') return m.display_name_override;
  if (m.name_consent === 'full') return m.full_name || null;
  if (m.name_consent === 'first') return m.first_name || null;
  return null;
}

/** Copy the approved photo to the public bucket (or remove it). Administrators only (enforced by the database). */
export async function syncPublicPhoto(m: Row): Promise<Row> {
  const slug = `${slugOf(m.code)}.webp`;
  const want = m.published && m.photo_consent && m.consent_recorded && m.photo_path;
  if (want) {
    const { data: blob, error } = await S.sb.storage.from(PRIVATE).download(m.photo_path);
    if (error || !blob) throw new Error(`The private photo could not be read: ${error?.message || 'missing'}`);
    const up = await S.sb.storage.from(PUBLIC).upload(slug, blob, { contentType: 'image/webp', upsert: true, cacheControl: '300' });
    if (up.error) throw up.error;
    if (m.public_photo_path !== slug) {
      const r = await S.sb.from('maids').update({ public_photo_path: slug }).eq('id', m.id).select().single();
      if (r.error) throw r.error;
      return r.data;
    }
    return m;
  }
  if (m.public_photo_path) {
    const r = await S.sb.from('maids').update({ public_photo_path: '' }).eq('id', m.id).select().single();
    if (r.error) throw r.error;
    await S.sb.storage.from(PUBLIC).remove([slug]);
    return r.data;
  }
  return m;
}

/** Take a maid off the website (listing and photo). The profile text disappears at the next website rebuild. */
export async function unpublish(m: Row): Promise<Row> {
  const { data, error } = await S.sb.from('maids').update({ published: false, public_photo_path: '' }).eq('id', m.id).select().single();
  if (error) throw error;
  await S.sb.storage.from(PUBLIC).remove([`${slugOf(m.code)}.webp`]);
  return data;
}

const L = {
  en: { ref: 'Ref', years: (n: number) => `${n} yr${n === 1 ? '' : 's'}`, exp: 'Experience', nr: 'Not stated', hist: 'Work experience', lang: 'Languages', tbc: 'Availability to be confirmed', skills: 'Experienced in', info: 'Candidate details', verified: 'Status confirmed' },
  ms: { ref: 'Rujukan', years: (n: number) => `${n} tahun`, exp: 'Pengalaman', nr: 'Tidak dinyatakan', hist: 'Pengalaman kerja', lang: 'Bahasa', tbc: 'Status belum disahkan', skills: 'Berpengalaman dalam', info: 'Maklumat calon', verified: 'Status disahkan' },
};
const SKILL_MS: Record<string, string> = { childcare: 'Jaga anak', newborn: 'Jaga bayi', elderlyCare: 'Jaga warga emas', cooking: 'Memasak', housekeeping: 'Kerja rumah', petCare: 'Jaga haiwan' };
const STATUS_MS: Record<string, string> = { available: 'Tersedia', 'on-hold': 'Ditahan', booked: 'Telah Ditempah', 'pending-arrival': 'Menunggu Ketibaan', 'to-be-confirmed': 'Status belum disahkan' };

/** "What the public would see": a faithful, simplified preview of the card and profile, English or Bahasa Melayu. */
export function previewDialog(m: Row) {
  const draw = (lang: 'en' | 'ms') => {
    const t = L[lang]; const name = publicName(m);
    const confirmed = m.status_confirmed && m.status !== 'to-be-confirmed';
    const status = confirmed ? (lang === 'ms' ? STATUS_MS[m.status] || STATUS_LABEL[m.status as keyof typeof STATUS_LABEL] : STATUS_LABEL[m.status as keyof typeof STATUS_LABEL]) : t.tbc;
    const skills = SKILLS.filter((k) => m.skills?.[k] === 'experienced').map((k) => (lang === 'ms' ? SKILL_MS[k] : SKILL_LABEL[k as keyof typeof SKILL_LABEL]));
    const summary = lang === 'ms' ? m.summary_ms || m.summary_en : m.summary_en;
    const photo = m.photo_consent && thumbUrl(m) ? `<img src="${esc(thumbUrl(m))}" alt="">` : `<div class="pv-nophoto">${m.photo_consent ? 'No photo yet' : 'Photo not authorised — placeholder shown'}</div>`;
    const jobs = (m.employment_history || []).map((e: Row) => `<li><b>${esc(e.country)}</b> · ${esc(e.duration)} — ${esc(lang === 'ms' ? e.duties_ms || e.duties : e.duties)}</li>`).join('');
    const langs = (m.languages || []).map((l: Row) => esc(l.language + (l.level ? ` (${l.level})` : ''))).join(', ');
    return `<div class="pv ${m.published ? '' : 'pv--draft'}">
      ${m.published ? '' : '<div class="pv-ribbon">NOT PUBLISHED — preview only</div>'}
      <div class="pv-card"><div class="pv-photo">${photo}</div><div class="pv-body">
        <div class="pv-top"><span class="pill pill--${confirmed ? 'ok' : 'tbc'}">${esc(status)}</span><span class="pv-nat">${esc(natLabel(m.nationality))}</span></div>
        <h3>${esc(name || m.code)}</h3><p class="pv-ref">${t.ref}: <b>${esc(m.code)}</b></p>
        <dl><div><dt>${t.exp}</dt><dd>${m.experience_years == null ? t.nr : t.years(Number(m.experience_years))}${m.overseas_experience ? ' · overseas' : ''}</dd></div>
        ${m.show_age && m.age ? `<div><dt>Age</dt><dd>${esc(m.age)}</dd></div>` : ''}${m.show_religion && m.religion ? `<div><dt>Religion</dt><dd>${esc(m.religion)}</dd></div>` : ''}</dl>
        ${skills.length ? `<p class="pv-chips">${skills.map((s) => `<span>${esc(s)}</span>`).join('')}</p>` : ''}</div></div>
      <div class="pv-profile"><p>${esc(summary || '—')}</p>
        ${jobs ? `<h4>${t.hist}</h4><ul>${jobs}</ul>` : ''}${langs ? `<h4>${t.lang}</h4><p>${langs}</p>` : ''}
        ${m.marital_status ? `<p class="hint">${esc(m.marital_status)}</p>` : ''}</div>
      <p class="hint">Hidden from the public: ${[!m.show_age && 'age', !m.show_religion && 'religion', !publicName(m) && 'name (reference code only)', !m.photo_consent && 'photo'].filter(Boolean).join(', ') || 'nothing'} · internal notes, documents, employer and placement details are never shown.</p></div>`;
  };
  const d = dialog({ title: `Public preview — ${nameOf(m)}`, wide: true, body: `<div class="seg"><button class="seg-b on" data-l="en" type="button">English</button><button class="seg-b" data-l="ms" type="button">Bahasa Melayu</button></div><div data-out>${draw('en')}</div>` });
  d.el.querySelectorAll<HTMLElement>('[data-l]').forEach((b) => b.addEventListener('click', () => {
    d.el.querySelectorAll('[data-l]').forEach((x) => x.classList.toggle('on', x === b)); d.q('[data-out]').innerHTML = draw(b.dataset.l as 'en' | 'ms');
  }));
}
export const dateOrDash = fmtDate;
