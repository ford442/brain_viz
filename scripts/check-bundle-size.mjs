// scripts/check-bundle-size.mjs
// [Neuro-Weaver] Bundle-size budget for the production build. Compares every
// dist/assets/*.js chunk (content hash stripped from the name) and their total
// against scripts/bundle-budget.json, and fails if any grew more than
// BUNDLE_TOLERANCE (default 10%) or a new chunk over 20 kB appeared.
//
//   npm run build && npm run check:bundle
//   node scripts/check-bundle-size.mjs --update   # accept the current sizes
//
// Only JS is budgeted: the ORT .wasm is a vendor binary whose size the app
// does not control.
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'dist', 'assets');
const BUDGET = join(ROOT, 'scripts', 'bundle-budget.json');
const TOLERANCE = Number(process.env.BUNDLE_TOLERANCE || 0.10);
const NEW_CHUNK_LIMIT = 20 * 1024;

if (!existsSync(ASSETS)) {
    console.error('[check-bundle-size] dist/assets/ not found — run `npm run build` first.');
    process.exit(1);
}

/** `index-CH-j6ifi.js` → `index.js`: Vite appends `-<8-char hash>`. */
const stableName = (file) => file.replace(/-[A-Za-z0-9_-]{8}(?=\.js$)/, '');

/** @type {Record<string, number>} */
const chunks = {};
for (const file of readdirSync(ASSETS).filter((f) => f.endsWith('.js')).sort()) {
    const name = stableName(file);
    chunks[name] = (chunks[name] || 0) + statSync(join(ASSETS, file)).size;
}
const total = Object.values(chunks).reduce((a, b) => a + b, 0);
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

if (process.argv.includes('--update') || !existsSync(BUDGET)) {
    writeFileSync(BUDGET, JSON.stringify({ total, chunks }, null, 2) + '\n');
    console.log(`[check-bundle-size] wrote ${BUDGET}: ${Object.keys(chunks).length} chunks, ${kb(total)} total.`);
    process.exit(0);
}

const budget = JSON.parse(readFileSync(BUDGET, 'utf8'));
const problems = [];
const check = (label, now, was) => {
    const growth = (now - was) / was;
    const line = `${label}: ${kb(was)} → ${kb(now)} (${growth >= 0 ? '+' : ''}${(growth * 100).toFixed(1)}%)`;
    if (growth > TOLERANCE) problems.push(line);
    else if (Math.abs(growth) > 0.005) console.log(`[check-bundle-size]   ${line}`);
};
for (const [name, size] of Object.entries(chunks)) {
    if (name in budget.chunks) check(name, size, budget.chunks[name]);
    else if (size > NEW_CHUNK_LIMIT) problems.push(`${name}: new chunk, ${kb(size)} (> ${kb(NEW_CHUNK_LIMIT)} unbudgeted)`);
}
check('total', total, budget.total);

if (problems.length) {
    console.error(`[check-bundle-size] FAIL — over the ${(TOLERANCE * 100).toFixed(0)}% budget:\n  ${problems.join('\n  ')}`);
    console.error('[check-bundle-size] Intended? `node scripts/check-bundle-size.mjs --update` and commit scripts/bundle-budget.json.');
    process.exit(1);
}
console.log(`[check-bundle-size] OK — ${Object.keys(chunks).length} chunks, ${kb(total)} total, within ${(TOLERANCE * 100).toFixed(0)}% of budget.`);
