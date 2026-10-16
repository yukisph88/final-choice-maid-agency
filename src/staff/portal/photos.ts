// Photo Management: upload / replace / crop / preview the PRIVATE working photos. A photo reaches the public website
// only when an administrator publishes the maid with photo consent (Publication Approvals).
import { S, esc, mount, setTitle, toast, ask, canEdit, isAdmin, loadMaids, ensureThumbs, thumbUrl, thumbHtml, pill, pager, natLabel, onClick, nameOf, maidById, pickFile, cropper, savePrivatePhoto, PRIVATE, dialog, replaceMaid, type Row } from './core';
import { syncPublicPhoto } from './publication';

const F = { q: '', nat: '', show: '', page: 1 };
const SIZE = 24;

export async function uploadFor(m: Row): Promise<Row | null> {
  const file = await pickFile('image/jpeg,image/png,image/webp'); if (!file) return null;
  if (file.size > 15 * 1048576) { toast('That picture is larger than 15 MB.', 'err'); return null; }
  const blob = await cropper(file); if (!blob) return null;
  try {
    let saved = await savePrivatePhoto(m, blob);
    if (isAdmin() && saved.public_photo_path) saved = await syncPublicPhoto(saved);
    replaceMaid(saved); toast(`Photo saved for ${nameOf(saved)} (private${saved.public_photo_path ? '; website copy updated' : ''}).`); return saved;
  } catch (e) { toast(`Photo not saved: ${(e as Error).message}`, 'err'); return null; }
}

export async function renderPhotos() {
  await loadMaids(); await ensureThumbs();
  setTitle('Photo Management', 'Working photos are private');
  const ed = canEdit(); const withPhoto = S.maids.filter((m) => m.photo_path).length;
  const root = mount(`
    <div class="kpis kpis--sm"><div class="kpi"><b>${withPhoto}</b><span>With photo</span></div><div class="kpi"><b>${S.maids.length - withPhoto}</b><span>Missing photo</span></div><div class="kpi"><b>${S.maids.filter((m) => m.public_photo_path).length}</b><span>On website</span></div></div>
    <div class="note">Photos are stored in a <b>private</b> store and shown to signed-in staff only. Upload a clear portrait; you can drag and zoom to crop (4:5). A photo is copied to the website only for maids that are published <b>with photo consent</b>.</div>
    <div class="toolbar2"><div class="fld grow"><label>Search</label><input id="q" type="search" placeholder="Name or reference code" value="${esc(F.q)}"></div>
      <div class="fld"><label>Nationality</label><select id="nat"><option value="">All</option><option value="indonesian">Indonesian</option><option value="filipino">Filipino</option></select></div>
      <div class="fld"><label>Show</label><select id="show"><option value="">All</option><option value="missing">Missing photo</option><option value="has">Has photo</option><option value="web">On website</option></select></div></div>
    <span class="count" id="count"></span><div class="pgrid" id="grid"></div><div id="pg"></div>`);
  (document.getElementById('nat') as HTMLSelectElement).value = F.nat; (document.getElementById('show') as HTMLSelectElement).value = F.show;
  const draw = () => {
    const q = F.q.trim().toLowerCase();
    const hits = S.maids.filter((m) => (!q || m.code.toLowerCase().includes(q) || (m.full_name || '').toLowerCase().includes(q)) && (!F.nat || m.nationality === F.nat)
      && (!F.show || (F.show === 'missing' ? !m.photo_path : F.show === 'has' ? !!m.photo_path : !!m.public_photo_path)));
    const pages = Math.max(1, Math.ceil(hits.length / SIZE)); F.page = Math.min(F.page, pages);
    document.getElementById('count')!.textContent = `${hits.length} maids`;
    document.getElementById('grid')!.innerHTML = hits.slice((F.page - 1) * SIZE, (F.page - 1) * SIZE + SIZE).map((m) => `<div class="pcard">
      <div class="pimg">${thumbUrl(m) ? `<img src="${esc(thumbUrl(m))}" alt="${esc(nameOf(m))}" loading="lazy" data-act="view" data-id="${esc(m.id)}">` : '<div class="photo-empty">No photo</div>'}</div>
      <div class="pmeta"><div class="strong">${esc(nameOf(m))}</div><div class="hint">${esc(m.code)} · ${esc(natLabel(m.nationality))}</div>
      ${m.public_photo_path ? pill('On website', 'ok') : m.photo_path ? pill('Private', 'grey') : pill('Missing', 'warn')}
      ${ed ? `<div class="row-actions"><button class="btn btn--sm" data-act="up" data-id="${esc(m.id)}" type="button">${m.photo_path ? 'Replace' : 'Upload'}</button>${m.photo_path ? `<button class="btn btn--ghost btn--sm" data-act="crop" data-id="${esc(m.id)}" type="button">Re-crop</button>` : ''}</div>` : ''}</div></div>`).join('') || '<p class="empty">No maids match.</p>';
    document.getElementById('pg')!.innerHTML = pager(hits.length, F.page, SIZE);
  };
  draw();
  for (const [id, k] of [['q', 'q'], ['nat', 'nat'], ['show', 'show']] as const) document.getElementById(id)!.addEventListener('input', (e) => { (F as any)[k] = (e.target as HTMLInputElement).value; F.page = 1; draw(); });
  root.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-page]'); if (b && !(b as HTMLButtonElement).disabled) { F.page = Number(b.dataset.page); draw(); } });
  onClick(root, {
    up: async (b) => { if (await uploadFor(maidById(b.dataset.id!)!)) renderPhotos(); },
    crop: async (b) => {
      const m = maidById(b.dataset.id!)!; const { data: blob, error } = await S.sb.storage.from(PRIVATE).download(m.photo_path); if (error || !blob) return toast('Could not open the current photo.', 'err');
      const out = await cropper(blob); if (!out) return;
      try { let saved = await savePrivatePhoto(m, out); if (isAdmin() && saved.public_photo_path) saved = await syncPublicPhoto(saved); replaceMaid(saved); toast('Photo re-cropped.'); renderPhotos(); } catch (e) { toast((e as Error).message, 'err'); }
    },
    view: (b) => { const m = maidById(b.dataset.id!)!; const d = dialog({ title: nameOf(m), body: `<div style="text-align:center"><img src="${esc(thumbUrl(m))}" alt="" style="max-width:100%;max-height:70vh;border-radius:12px"></div><p class="hint">Ref ${esc(m.code)} · ${m.public_photo_path ? 'a copy is on the public website' : 'private — not on the website'}</p>`, foot: `<a class="btn btn--ghost" href="#/maid/${esc(m.code)}">Open profile</a>` }); d.q('a')?.addEventListener('click', () => d.close()); },
  });
}
