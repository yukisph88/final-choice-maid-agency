#!/usr/bin/env node
// Runs after "astro build". The staff dashboard's script bundle is emitted into dist/_astro even when the dashboard page
// itself is not built (it is only built when a database is configured). An unused bundle must not be published, so it is
// removed here unless the dashboard page exists. Usage: node scripts/prune-dist.mjs   (DIST_DIR=… for another folder)
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DIST = process.env.DIST_DIR ?? 'dist';
const dir = join(DIST, '_astro');
if (!existsSync(dir)) process.exit(0);
if (existsSync(join(DIST, 'staff'))) { console.log('prune-dist: staff page present — nothing removed'); process.exit(0); }
const unused = readdirSync(dir).filter((f) => /slug_\.astro_astro_type_script.*\.js$/.test(f));
for (const f of unused) rmSync(join(dir, f));
console.log(`prune-dist: removed ${unused.length} unused staff-dashboard file(s)`);
