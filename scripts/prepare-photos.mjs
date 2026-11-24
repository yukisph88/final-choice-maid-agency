#!/usr/bin/env node
// Prepares REAL company photographs for the homepage from the private intake folder (photo-inbox/, never committed).
//   npm run photos:prepare
// • photo-inbox/07-office-team   → the "Our office" photographs on the homepage (public/images/office/ + src/data/office-photos.json)
// Only genuine photographs that staff put in that folder are used; nothing is generated. With the folder empty the homepage shows a neutral
// "visit us" panel instead. After running this, commit public/images/office and src/data/office-photos.json and push.
// (The training photographs are prepared the same way from photo-inbox/02-cooking-training; maid portraits come from the maid records, never from here.)
import { readdirSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import sharp from 'sharp';

const SRC = 'photo-inbox/07-office-team'; const OUT = 'public/images/office'; const MANIFEST = 'src/data/office-photos.json';
const files = existsSync(SRC) ? readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp)$/i.test(extname(f))).sort() : [];
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const photos = [];
let n = 0;
for (const f of files) {
  n++;
  const img = sharp(join(SRC, f)).rotate();   // honour the camera's orientation
  const meta = await img.metadata();
  if (!meta.width || !meta.height || meta.width < 600) { console.log(`skipped ${f}: too small for the website (${meta.width}×${meta.height})`); n--; continue; }
  const sizes = [480, 800, 1280].filter((w) => w <= meta.width);
  if (!sizes.length) sizes.push(meta.width);
  for (const w of sizes) await sharp(join(SRC, f)).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(join(OUT, `office-${n}-${w}.webp`));
  const mid = sizes.includes(800) ? 800 : sizes[sizes.length - 1];
  const h = Math.round((meta.height * (mid / (meta.width))) );
  photos.push({ id: n, sizes, mid, width: mid, height: h });
  console.log(`✓ ${f} → office-${n} (${sizes.join(', ')} px wide)`);
}
writeFileSync(MANIFEST, JSON.stringify({ photos }, null, 2) + '\n');
console.log(photos.length ? `\n${photos.length} office photograph(s) prepared.` : `\nNo office photographs found in ${SRC}. The homepage shows the neutral "visit us" panel until genuine photos are added there.`);
