// Makes every app icon from the one source file, design/icon/icon.svg. Run it with `npm run icons`.
// To change the logo: replace design/icon/icon.svg, run this, commit public/icons/ (see docs/setup.md).
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'design', 'icon', 'icon.svg');
const out = join(root, 'public', 'icons');

// The source is a full-bleed square with its artwork inside the centre 80%, so one picture serves them all.
const ICONS = [
  { file: 'icon-192.png', size: 192 }, // manifest, "any"
  { file: 'icon-512.png', size: 512 }, // manifest, "any"
  { file: 'maskable-512.png', size: 512 }, // manifest, "maskable" (the OS crops it to its own shape)
  { file: 'apple-touch-icon.png', size: 180 }, // iPhone home screen
  { file: 'favicon-32.png', size: 32 }, // browser tab
];

await mkdir(out, { recursive: true });
const svg = await readFile(source);
for (const { file, size } of ICONS) {
  // A high render density keeps the small sizes crisp. No transparency: the OS fills nothing behind the icon.
  await sharp(svg, { density: 384 }).resize(size, size).flatten({ background: '#8A4B1F' }).png().toFile(join(out, file));
  console.log(`public/icons/${file} (${size}x${size})`);
}
