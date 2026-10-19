// Reads an uploaded biodata document in the browser (nothing leaves the staff member's computer until they press Confirm & Save).
// PDF: text layer with positions (pdf.js) → fields; the maid portrait = the portrait-shaped picture placed on page 1.
// Word: text → fields, largest portrait picture. Pictures / scanned PDFs: no automatic text reading (no OCR) — the staff member types the details.
import { extractFields, extractWork, tickCells, readTicks, extractFromLines, buildDraft, toItems, pickPortrait } from './extract-core.js';

export type Flags = Record<string, { level: 'missing' | 'check'; note: string }>;
export interface Parsed {
  file: File; kind: 'pdf' | 'docx' | 'image'; ok: boolean; error?: string;
  fields: Record<string, any>; flags: Flags; notes: string[];
  previewUrl?: string; previewHtml?: string; photo: Blob | null; photoUrl: string; photoUncertain: boolean;
}

const SCALE = 3;
const blobOf = (c: HTMLCanvasElement, type = 'image/png', q?: number) => new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('image conversion failed'))), type, q));
const bitmapUrl = (b: Blob) => URL.createObjectURL(b);

async function readImageFile(file: File): Promise<Parsed> {
  const flags: Flags = {}; const url = bitmapUrl(file);
  const d = buildDraft({ raw: { name: '', nationality: '', age: '', marital: '', ageChildren: '', religion: '', height: '', weight: '', education: '', salary: '', others: '', dayOff: '', attitude: '', communication: '', honesty: '' }, code: '', remarks: [] }, { jobs: [], note: '' }, file.name);
  Object.assign(flags, d.flags);
  return { file, kind: 'image', ok: true, fields: d.draft, flags, notes: ['This is a picture: the text cannot be read automatically (there is no text recognition in this system). Type the details from the picture on the left. The picture itself is offered as the photo — crop it to the face.'], previewUrl: url, photo: file, photoUrl: url, photoUncertain: true };
}

async function readPdf(file: File): Promise<Parsed> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker: any = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true, verbosity: 0 }).promise;
  const page = await doc.getPage(1); const vp1 = page.getViewport({ scale: 1 });
  const items = toItems((await page.getTextContent()).items, vp1.height);
  // render page 1 once: used for the preview and to cut out the portrait
  const vp = page.getViewport({ scale: SCALE }); const canvas = document.createElement('canvas'); canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
  const previewBlob = await blobOf(canvas, 'image/jpeg', 0.85); const previewUrl = bitmapUrl(previewBlob);
  // where the pictures sit on the page
  const ops = await page.getOperatorList(); const placed: { x: number; y: number; w: number; h: number }[] = []; const stack: number[][] = []; let ctm = [1, 0, 0, 1, 0, 0];
  const O = pdfjs.OPS; const U = pdfjs.Util;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]; const a = ops.argsArray[i];
    if (fn === O.save) stack.push(ctm.slice()); else if (fn === O.restore) ctm = stack.pop() || ctm; else if (fn === O.transform) ctm = U.transform(ctm, a);
    else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintJpegXObject) {
      const m = U.transform(vp1.transform, ctm); const xs = [0, 1].flatMap((u) => [0, 1].map((v) => m[0] * u + m[2] * v + m[4])); const ys = [0, 1].flatMap((u) => [0, 1].map((v) => m[1] * u + m[3] * v + m[5]));
      placed.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    }
  }
  // Tick boxes: find the square outline nearest to where the label says it is, then measure the ink INSIDE it (-1 = no box found).
  const g = canvas.getContext('2d')!;
  const ink = (x: number, y: number) => {
    const R = Math.round(15 * SCALE); const x0 = Math.round(x * SCALE) - R; const y0 = Math.round(y * SCALE) - R; const n = 2 * R;
    if (x0 < 0 || y0 < 0 || x0 + n > canvas.width || y0 + n > canvas.height) return -1;
    const data = g.getImageData(x0, y0, n, n).data; const D = new Uint8Array(n * n); const T = new Uint8Array(n * n);
    const L = new Float32Array(n * n); let bg = 0; for (let i = 0; i < n * n; i++) { L[i] = data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11; if (L[i] > bg) bg = L[i]; }
    for (let i = 0; i < n * n; i++) { D[i] = L[i] < bg - 40 ? 1 : 0; T[i] = L[i] < 140 ? 1 : 0; }   // outline = clearly darker than the paper; tick = dark ink
    const at = (A: Uint8Array, px: number, py: number) => (px >= 0 && py >= 0 && px < n && py < n ? A[py * n + px] : 0);
    let best = 0; let bx = -1; let by = -1;
    for (const hp of [4.8, 5.4, 6, 6.6]) {
      const half = Math.round(hp * SCALE);
      for (let cy = half + 2; cy < n - half - 2; cy++) for (let cx = half + 2; cx < n - half - 2; cx++) {
        let hit = 0;
        for (let k = -half + 2; k <= half - 2; k++) {   // straight parts of the outline only (corners may be rounded)
          if (at(D, cx + k, cy - half) || at(D, cx + k, cy - half + 1) || at(D, cx + k, cy - half - 1)) hit++;
          if (at(D, cx + k, cy + half) || at(D, cx + k, cy + half + 1) || at(D, cx + k, cy + half - 1)) hit++;
          if (at(D, cx - half, cy + k) || at(D, cx - half + 1, cy + k) || at(D, cx - half - 1, cy + k)) hit++;
          if (at(D, cx + half, cy + k) || at(D, cx + half + 1, cy + k) || at(D, cx + half - 1, cy + k)) hit++;
        }
        const raw = hit / (4 * (2 * half - 3)); const score = raw - Math.hypot(cx - R, cy - R) * 0.003; if (raw >= 0.85 && score > best) { best = score; bx = cx; by = cy; }
      }
    }
    if (bx < 0) return -1;
    const r = Math.round(2.4 * SCALE); let dark = 0; for (let j = by - r; j <= by + r; j++) for (let i = bx - r; i <= bx + r; i++) dark += at(T, i, j);
    return dark / ((2 * r + 1) * (2 * r + 1));
  };
  const notes: string[] = [];
  const scanned = items.length < 15;
  const fields = scanned ? buildDraft({ raw: { name: '', nationality: '', age: '', marital: '', ageChildren: '', religion: '', height: '', weight: '', education: '', salary: '', others: '', dayOff: '', attitude: '', communication: '', honesty: '' }, code: '', remarks: [] }, { jobs: [], note: '' }, file.name)
    : buildDraft(extractFields(items, vp1.width), extractWork(items), file.name, readTicks(tickCells(items), ink));
  const cellsDbg = scanned ? null : tickCells(items);
  if (scanned) notes.push('This PDF has no readable text (it is a scan). Type the details from the document on the left; there is no automatic text recognition in this system.');
  if (doc.numPages > 1) notes.push(`The PDF has ${doc.numPages} pages — only page 1 was read. Check the other pages yourself.`);
  const pick = pickPortrait(placed, vp1.width, vp1.height);
  let photo: Blob | null = null; let photoUncertain = true;
  if (pick.box) {
    const b = pick.box; const c = document.createElement('canvas'); const px = Math.max(0, Math.round(b.x * SCALE)); const py = Math.max(0, Math.round(b.y * SCALE));
    c.width = Math.min(canvas.width - px, Math.round(b.w * SCALE)); c.height = Math.min(canvas.height - py, Math.round(b.h * SCALE));
    c.getContext('2d')!.drawImage(canvas, px, py, c.width, c.height, 0, 0, c.width, c.height); photo = await blobOf(c);
    photoUncertain = !!pick.uncertain; if (pick.note) notes.push(pick.note);
  } else notes.push(pick.note);
  const out: Parsed & { debug?: unknown } = { file, kind: 'pdf', ok: true, fields: fields.draft, flags: fields.flags, notes, previewUrl, photo, photoUrl: photo ? bitmapUrl(photo) : '', photoUncertain };
  if (import.meta.env.DEV && cellsDbg) out.debug = { skills: cellsDbg.skills.map((c: any) => [c.key, c.e.map(Math.round), +ink(c.e[0], c.e[1]).toFixed(3), +ink(c.w[0], c.w[1]).toFixed(3)]), langs: cellsDbg.langs.map((c: any) => [c.name, +ink(c.at[0], c.at[1]).toFixed(3)]), day: cellsDbg.day.map((c: any) => [c.value, +ink(c.at[0], c.at[1]).toFixed(3)]) };
  return out;
}

async function readDocx(file: File): Promise<Parsed> {
  const mammoth: any = (await import('mammoth/mammoth.browser.min.js')).default;
  const buf = await file.arrayBuffer(); const imgs: { url: string; blob: Blob }[] = [];
  const html = await mammoth.convertToHtml({ arrayBuffer: buf }, { convertImage: mammoth.images.imgElement(async (img: any) => { const b64 = await img.read('base64'); const blob = await (await fetch(`data:${img.contentType};base64,${b64}`)).blob(); const url = bitmapUrl(blob); imgs.push({ url, blob }); return { src: url }; }) });
  const text = (await mammoth.extractRawText({ arrayBuffer: buf })).value as string;
  const core = extractFromLines(text); const d = buildDraft(core, { jobs: [], note: 'Work experience is not read from Word files automatically.' }, file.name);
  let photo: Blob | null = null; let best = 0;
  for (const im of imgs) { const bmp = await createImageBitmap(im.blob).catch(() => null); if (!bmp) continue; const r = bmp.height / bmp.width; const area = bmp.width * bmp.height; if (r >= 0.8 && r <= 2 && bmp.width >= 150 && area > best) { best = area; photo = im.blob; } }
  return { file, kind: 'docx', ok: true, fields: d.draft, flags: d.flags, notes: ['Word file: only the labelled lines were read; work experience, skill and language boxes must be completed from the document.'], previewHtml: html.value, photo, photoUrl: photo ? bitmapUrl(photo) : '', photoUncertain: true };
}

export const SUPPORTED = '.pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export async function readDocument(file: File): Promise<Parsed> {
  const name = file.name.toLowerCase();
  try {
    if (file.size > 25 * 1048576) throw new Error('The file is larger than 25 MB.');
    if (name.endsWith('.pdf') || file.type === 'application/pdf') return await readPdf(file);
    if (name.endsWith('.docx')) return await readDocx(file);
    if (/\.(jpe?g|png|webp)$/.test(name) || file.type.startsWith('image/')) return await readImageFile(file);
    throw new Error('Unsupported file type. Use a PDF, Word (.docx) or picture file. Old .doc files must be saved as .docx first.');
  } catch (e) {
    return { file, kind: 'pdf', ok: false, error: (e as Error).message || String(e), fields: {}, flags: {}, notes: [], photo: null, photoUrl: '', photoUncertain: true };
  }
}
