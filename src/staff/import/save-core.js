// Safe save of an imported biodata record — no DOM, so the browser and scripts/import-save-test.mjs run exactly the same code.
//  1. validate  2. duplicate check against the live database  3. photo first  4. record created WITH its photo path  5. photo removed again if the record cannot be created.
// Always: unpublished, availability To Be Confirmed, importer + time recorded in the notes (and the change history).
import { SKILLS, validateRow, splitName } from '../mapping.js';

const MERGE_FIELDS = ['full_name', 'first_name', 'age', 'religion', 'marital_status', 'rest_day_preference', 'salary_note', 'experience_years'];

/** @param {{sb:any, who:string, email?:string, privateBucket?:string, docsBucket?:string}} ctx */
export async function findExisting(ctx, code) {
  if (!code) return null;
  const { data } = await ctx.sb.from('maids').select('*').eq('code', String(code).toUpperCase()).maybeSingle();
  return data || null;
}

/**
 * @param {*} ctx   {sb, who, email, now}
 * @param {*} fields reviewed fields
 * @param {Blob|Buffer|null} photo  ALREADY converted to the final private picture (720×900 WebP)
 * @param {{fileName:string, reviewed:boolean, merge?:boolean, keepOriginal?:{name:string,type:string,size:number,body:any}|null}} o
 */
export async function saveImportWith(ctx, fields, photo, o) {
  const PRIVATE = ctx.privateBucket || 'maid-private'; const DOCS = ctx.docsBucket || 'maid-documents';
  const code = String(fields.code || '').trim().toUpperCase();
  try {
    const nm = fields.full_name ? splitName(fields.full_name) : { firstName: '' };
    const stamp = (ctx.now ? ctx.now() : new Date()).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' });
    const importNote = `Imported from "${o.fileName}" by ${ctx.who} on ${stamp} (${o.reviewed ? 'extracted details reviewed by staff before saving' : 'read automatically — details not yet individually reviewed'}).`;
    const base = { ...fields, code, first_name: fields.first_name || nm.firstName, internal_notes: [String(fields.internal_notes || '').trim(), importNote].filter(Boolean).join('\n') };
    const { errors } = validateRow({ ...base, status: 'to-be-confirmed', name_consent: 'none', published: false, photo_path: photo ? 'pending' : '' });
    if (!base.full_name) errors.push('Enter the full name');
    if (!code) errors.push('Enter the reference code');
    if (errors.length) return { ok: false, code, error: errors.join('; ') };
    const existing = await findExisting(ctx, code);
    let maid;
    if (existing) {
      if (!o.merge) return { ok: false, code, error: `Reference code ${code} already exists (${existing.full_name || 'no name'}).`, duplicate: true };
      // safe update: only fill what is still empty — nothing already recorded is overwritten
      const patch = {};
      for (const k of MERGE_FIELDS) if ((existing[k] === null || existing[k] === '' || existing[k] === undefined) && base[k] !== null && base[k] !== '' && base[k] !== undefined) patch[k] = base[k];
      if (!(existing.employment_history || []).length && base.employment_history?.length) patch.employment_history = base.employment_history;
      if (!(existing.languages || []).length && base.languages?.length) patch.languages = base.languages;
      const sk = { ...(existing.skills || {}) }; let skChanged = false;
      for (const k of SKILLS) if ((!sk[k] || sk[k] === 'none') && base.skills?.[k] && base.skills[k] !== 'none') { sk[k] = base.skills[k]; skChanged = true; }
      if (skChanged) patch.skills = sk;
      patch.internal_notes = [existing.internal_notes, importNote].filter(Boolean).join('\n');
      if (photo && !existing.photo_path) {
        const path = `${code.toLowerCase()}.webp`;
        const up = await ctx.sb.storage.from(PRIVATE).upload(path, photo, { contentType: 'image/webp', upsert: true }); if (up.error) throw up.error; patch.photo_path = path;
      }
      const r = await ctx.sb.from('maids').update(patch).eq('id', existing.id).select().single(); if (r.error) throw r.error; maid = r.data;
    } else {
      const path = `${code.toLowerCase()}.webp`; let uploaded = false;
      if (photo) { const up = await ctx.sb.storage.from(PRIVATE).upload(path, photo, { contentType: 'image/webp', upsert: true }); if (up.error) throw new Error(`Photo upload failed: ${up.error.message}`); uploaded = true; }
      const row = {
        code, nationality: base.nationality, full_name: base.full_name, first_name: base.first_name, age: base.age ?? null, religion: base.religion || '', marital_status: base.marital_status || '',
        experience_years: base.experience_years ?? null, overseas_experience: !!base.overseas_experience, skills: base.skills, languages: base.languages || [], employment_history: base.employment_history || [],
        rest_day_preference: base.rest_day_preference || '', salary_note: base.salary_note || '', internal_notes: base.internal_notes,
        status: 'to-be-confirmed', status_confirmed: false, status_set_by: ctx.who, published: false, photo_path: uploaded ? path : '',
      };
      const r = await ctx.sb.from('maids').insert(row).select().single();
      if (r.error) { if (uploaded) await ctx.sb.storage.from(PRIVATE).remove([path]); throw new Error(/duplicate key/.test(r.error.message) ? `Reference code ${code} already exists.` : r.error.message); }
      maid = r.data;
    }
    let originalKept = false;
    if (o.keepOriginal) {   // optional private copy of the original document (administrators + editors)
      const f = o.keepOriginal; const p = `${maid.id}/${globalThis.crypto.randomUUID()}-${f.name.replace(/[^A-Za-z0-9._-]+/g, '_')}`;
      const up = await ctx.sb.storage.from(DOCS).upload(p, f.body, { contentType: f.type || 'application/octet-stream' });
      if (!up.error) {
        const ins = await ctx.sb.from('documents').insert({ maid_id: maid.id, kind: 'biodata-pdf', title: `Original biodata — ${f.name}`, storage_path: p, mime_type: f.type, size_bytes: f.size, access_level: 'editor', uploaded_by_email: ctx.email || '' });
        if (ins.error) await ctx.sb.storage.from(DOCS).remove([p]); else originalKept = true;
      }
    }
    return { ok: true, code: maid.code, merged: !!existing, maid, originalKept };
  } catch (e) { return { ok: false, code, error: (e && e.message) || String(e) }; }
}
