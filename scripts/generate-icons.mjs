// Generates PNG icons from an inline SVG using sharp.
// Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../public/icons');
mkdirSync(outDir, { recursive: true });

// Synapse icon: dark background, purple gradient brain-node motif
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1c1c2e"/>
      <stop offset="100%" stop-color="#0a0a0f"/>
    </radialGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c5cff"/>
      <stop offset="100%" stop-color="#2dd4bf"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background circle -->
  <circle cx="64" cy="64" r="62" fill="url(#bg)" stroke="#2a2a36" stroke-width="2"/>

  <!-- Nodes -->
  <circle cx="64" cy="36" r="10" fill="url(#accent)" filter="url(#glow)"/>
  <circle cx="34" cy="80" r="8"  fill="url(#accent)" filter="url(#glow)" opacity="0.9"/>
  <circle cx="94" cy="80" r="8"  fill="url(#accent)" filter="url(#glow)" opacity="0.9"/>
  <circle cx="64" cy="96" r="6"  fill="#2dd4bf"       filter="url(#glow)" opacity="0.8"/>
  <circle cx="40" cy="50" r="5"  fill="#7c5cff"       opacity="0.7"/>
  <circle cx="88" cy="50" r="5"  fill="#7c5cff"       opacity="0.7"/>

  <!-- Edges -->
  <g stroke="url(#accent)" stroke-width="2.5" stroke-linecap="round" opacity="0.6">
    <line x1="64" y1="46" x2="40" y2="73"/>
    <line x1="64" y1="46" x2="88" y2="73"/>
    <line x1="40" y1="73" x2="94" y2="73"/>
    <line x1="40" y1="73" x2="64" y2="91"/>
    <line x1="88" y1="73" x2="64" y2="91"/>
    <line x1="64" y1="46" x2="40" y2="50"/>
    <line x1="64" y1="46" x2="88" y2="50"/>
  </g>
</svg>
`.trim();

const buf = Buffer.from(SVG);

for (const size of [16, 32, 48, 128]) {
  const out = resolve(outDir, `icon${size}.png`);
  await sharp(buf).resize(size, size).png().toFile(out);
  console.log(`  wrote ${out}`);
}

console.log('Icons generated.');
