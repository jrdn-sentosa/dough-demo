// Makes every app icon from two source files in design/icon/. Run it with `npm run icons`.
//   icon.svg           the regular icons and the apple-touch icon: artwork about 85% of the width
//   icon-maskable.svg  the maskable icon only: artwork's farthest point at most 36% of the size from the centre
// To change the logo: replace both files, run this, commit public/icons/ (see docs/setup.md).
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = {
  regular: join(root, 'design', 'icon', 'icon.svg'),
  maskable: join(root, 'design', 'icon', 'icon-maskable.svg'),
};
const out = join(root, 'public', 'icons');

const ICONS = [
  { file: 'icon-192.png', size: 192, source: 'regular' }, // manifest, "any"
  { file: 'icon-512.png', size: 512, source: 'regular' }, // manifest, "any"
  { file: 'maskable-512.png', size: 512, source: 'maskable' }, // manifest, "maskable" (the OS crops it to its own shape)
  { file: 'apple-touch-icon.png', size: 180, source: 'regular' }, // iPhone home screen (rounded corners)
  { file: 'favicon-32.png', size: 32, source: 'regular' }, // browser tab
];

await mkdir(out, { recursive: true });
const svgs = { regular: await readFile(sources.regular), maskable: await readFile(sources.maskable) };
for (const { file, size, source } of ICONS) {
  // A high render density keeps the small sizes crisp. No transparency: the OS fills nothing behind the icon.
  await sharp(svgs[source], { density: 384 }).resize(size, size).flatten({ background: '#8A4B1F' }).png().toFile(join(out, file));
  console.log(`public/icons/${file} (${size}x${size}) from ${source}`);
}
