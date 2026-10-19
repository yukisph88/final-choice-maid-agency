// Add New Maid: Import Existing Biodata (primary) · Enter Manually (secondary) · Bulk import.
import { S, esc, mount, setTitle, toast, ask, canEdit, loadMaids, pill, onClick, go, type Row } from '../portal/core';
import { readDocument, SUPPORTED, type Parsed } from './read';
import { openReview, saveImport, findExisting, type SaveResult } from './review';

interface BulkRow { id: number; p: Parsed; dup: Row | null; state: 'ready' | 'review' | 'failed' | 'saved' | 'error'; msg: string }
let rows: BulkRow[] = []; let seq = 0;

function classify(p: Parsed, dup: Row | null): { state: BulkRow['state']; msg: string } {
  if (!p.ok) return { state: 'failed', msg: p.error || 'Could not read the file.' };
  const f = p.fields; const probs: string[] = [];
  if (!f.code) probs.push('no reference code'); if (!f.full_name) probs.push('no name'); if (!f.nationality) probs.push('no nationality'); if (f.age == null) probs.push('no age');
  if (!(f.employment_history || []).length) probs.push('no work history'); if (!p.photo) probs.push('no photo'); else if (p.photoUncertain) probs.push('photo uncertain');
  for (const k of ['code', 'age', 'employment_history']) if (p.flags[k]?.level === 'check') probs.push(p.flags[k].note);
  if (p.kind !== 'pdf') probs.push(`${p.kind === 'docx' ? 'Word file' : 'picture'}: details must be checked by hand`);
  if (dup) return { state: 'review', msg: `Duplicate: ${f.code} already exists${dup.full_name ? ` (${dup.full_name})` : ''}` };
  return probs.length ? { state: 'review', msg: probs.join('; ') } : { state: 'ready', msg: `${Object.keys(p.flags).length} item(s) to check in the review (languages, skills, rest day)` };
}

export async function renderAddHub(arg?: string) {
  if (!canEdit()) { mount('<div class="card pad"><p>Your role does not allow adding maids.</p></div>'); return; }
  await loadMaids();
  setTitle('Add New Maid', 'Import an existing biodata document');
  const root = mount(`
    <div class="hubs">
      <section class="card pad hub hub--main"><span class="pill pill--blue">Recommended</span><h2>Import Existing Biodata</h2>
        <p>Upload the biodata you received from the agency. The system reads it, finds the photo, and shows you the original next to the extracted details so you can check them before saving. <b>You do not type the biodata again.</b></p>
        <div class="drop" id="drop" tabindex="0" role="button" aria-label="Choose biodata files"><b>Drop biodata files here</b><span>or click to choose · PDF, Word (.docx) or picture · one file, or several for a bulk import</span></div>
        <input type="file" id="files" accept="${SUPPORTED}" multiple hidden>
        <ul class="plain hint"><li>PDFs are read from their text; the photo is the portrait picture on page 1 (never a logo, tick box or passport page).</li><li>Scanned pictures cannot be read automatically (no text recognition): you type the details beside the original.</li>
          <li>Nothing is saved until you press <b>Confirm &amp; Save</b>. New maids are private, unpublished and <b>To Be Confirmed</b>.</li></ul></section>
      <section class="card pad hub"><h2>Enter Manually</h2><p>Use this only when there is no document to import.</p><a class="btn btn--ghost" href="#/add/manual">Open the manual form</a></section>
    </div>
    <div id="bulk"></div>`);
  const input = document.getElementById('files') as HTMLInputElement; const drop = document.getElementById('drop')!;
  drop.addEventListener('click', () => input.click()); drop.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') input.click(); });
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); const fs = [...((e as DragEvent).dataTransfer?.files || [])]; if (fs.length) start(fs); });
  input.addEventListener('change', () => { const fs = [...(input.files || [])]; input.value = ''; if (fs.length) start(fs); });
  const box = document.getElementById('bulk')!;

  async function start(files: File[]) {
    if (files.length === 1) {
      box.innerHTML = '<p class="hint">Reading the document…</p>'; const p = await readDocument(files[0]); box.innerHTML = '';
      if (!p.ok) { box.innerHTML = `<div class="err">${esc(p.file.name)}: ${esc(p.error)}</div>`; return; }
      openReview(p); return;
    }
    rows = []; draw(); let n = 0;
    for (const f of files) {
      const id = ++seq; const p = await readDocument(f); const dup = p.ok ? await findExisting(p.fields.code) : null; const c = classify(p, dup);
      rows.push({ id, p, dup, ...c }); n++; draw(`Read ${n} of ${files.length}…`);
    }
    // two files with the same code in one batch
    const seen = new Map<string, number>(); for (const r of rows) { const c = r.p.fields.code; if (!c) continue; if (seen.has(c)) { r.state = 'review'; r.msg = `Duplicate: the same code appears twice in this batch`; } else seen.set(c, r.id); }
    draw();
  }
  const pillFor = (r: BulkRow) => ({ ready: pill('Ready to Save', 'ok'), review: pill('Review required', 'warn'), failed: pill('Failed', 'red'), saved: pill('Saved', 'blue'), error: pill('Save failed', 'red') }[r.state]);
  function draw(progress = '') {
    if (!rows.length) { box.innerHTML = progress ? `<p class="hint">${esc(progress)}</p>` : ''; return; }
    const ready = rows.filter((r) => r.state === 'ready').length;
    box.innerHTML = `<div class="card pad"><div class="actions-bar"><h3 class="sec" style="margin:0">Bulk import — ${rows.length} documents</h3><span class="count">${esc(progress) || `${ready} ready · ${rows.filter((r) => r.state === 'review').length} need review · ${rows.filter((r) => r.state === 'failed' || r.state === 'error').length} failed · ${rows.filter((r) => r.state === 'saved').length} saved`}</span></div>
      <div class="tbl-wrap"><table class="tbl"><tr><th>Photo</th><th>Maid</th><th>Reference</th><th>Extraction result</th><th>Status</th><th></th></tr>${rows.map((r) => `<tr>
        <td>${r.p.photoUrl ? `<img class="thumb" src="${esc(r.p.photoUrl)}" alt="">` : '<span class="thumb thumb--none">—</span>'}</td>
        <td><div class="strong">${esc(r.p.fields.full_name || '(no name found)')}</div><div class="hint">${esc(r.p.file.name)}</div></td><td>${esc(r.p.fields.code || '—')}</td>
        <td class="${r.state === 'review' && r.dup ? 'err-text' : ''}">${esc(r.msg)}</td><td>${pillFor(r)}</td>
        <td class="nw">${r.state === 'saved' ? `<a class="btn btn--ghost btn--sm" href="#/maid/${esc(r.p.fields.code)}">Open</a>` : r.state === 'failed' ? '' : `<button class="btn btn--sm" data-act="rev" data-id="${r.id}" type="button">Review</button>`} ${r.state === 'saved' ? '' : `<button class="btn btn--ghost btn--sm" data-act="rm" data-id="${r.id}" type="button">Remove</button>`}</td></tr>`).join('')}</table></div>
      <div class="actions-bar"><button class="btn" data-act="saveall" type="button" ${ready ? '' : 'disabled'}>Save all ready (${ready})</button><span class="hint">“Ready” records are saved exactly as extracted, flagged in their notes as not individually reviewed. Open <b>Review</b> to compare any record with its document first.</span></div></div>`;
  }
  onClick(root, {
    rev: (b) => { const r = rows.find((x) => x.id === Number(b.dataset.id)); if (!r) return; openReview(r.p, { done: (res: SaveResult, fields) => { r.state = 'saved'; r.msg = `${res.merged ? 'Updated' : 'Saved'} as ${res.code}`; r.p.fields.code = res.code; r.p.fields.full_name = fields.full_name; draw(); } }); },
    rm: (b) => { rows = rows.filter((x) => x.id !== Number(b.dataset.id)); draw(); },
    saveall: async () => {
      const todo = rows.filter((r) => r.state === 'ready'); if (!todo.length) return;
      if (!(await ask(`Save ${todo.length} maid record(s) as extracted?\nThey are saved private, unpublished and To Be Confirmed. You did not review them one by one — their notes will say so.`, { ok: `Save ${todo.length}` }))) return;
      let ok = 0; for (const r of todo) {
        draw(`Saving ${ok + 1} of ${todo.length}…`);
        const res = await saveImport(r.p.fields, r.p.photo, { fileName: r.p.file.name, reviewed: false });
        if (res.ok) { r.state = 'saved'; r.msg = `Saved as ${res.code}`; ok++; } else { r.state = 'error'; r.msg = res.error || 'Not saved'; }
      }
      draw(); toast(`${ok} of ${todo.length} saved.`, ok === todo.length ? 'ok' : 'err');
    },
  });
  void arg; void go; void S;
}

// test hook for the local development server only (never present in the production build)
if (import.meta.env.DEV) (window as any).__fcRead = readDocument;
