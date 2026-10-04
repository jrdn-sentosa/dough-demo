import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

// Every generated icon as a base64 data URL, like pwa.test.ts, so this needs no file access.
const pngs = import.meta.glob<string>('../../public/icons/*.png', { query: '?inline', import: 'default', eager: true });
const BACKGROUND = [0x8a, 0x4b, 0x1f];

/** How much of an icon the artwork covers, measured from its pixels (anything that isn't the background). */
async function measure(file: string) {
  const url = pngs[`../../public/icons/${file}`];
  expect(url, file).toBeTruthy();
  const png = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const { width, channels } = info;
  let minX = width;
  let maxX = -1;
  let farthest = 0;
  let outsideRounded = 0;
  const corner = 0.2237 * width; // an iPhone-style rounded square
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const diff = Math.abs(data[i] - BACKGROUND[0]) + Math.abs(data[i + 1] - BACKGROUND[1]) + Math.abs(data[i + 2] - BACKGROUND[2]);
      if (diff <= 24) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      farthest = Math.max(farthest, Math.hypot(x + 0.5 - width / 2, y + 0.5 - width / 2));
      const dx = Math.max(0, Math.abs(x + 0.5 - width / 2) - (width / 2 - corner));
      const dy = Math.max(0, Math.abs(y + 0.5 - width / 2) - (width / 2 - corner));
      if (Math.hypot(dx, dy) > corner) outsideRounded++;
    }
  }
  return { widthShare: (maxX - minX + 1) / width, farthestShare: farthest / width, outsideRounded };
}

describe('app icon artwork', () => {
  it('fills about 85% of the width in the regular icon, and is not cut by a rounded square', async () => {
    const m = await measure('icon-512.png');
    expect(m.widthShare).toBeGreaterThan(0.83);
    expect(m.widthShare).toBeLessThan(0.87);
    expect(m.outsideRounded).toBe(0);
  });

  it('keeps the apple-touch icon the same size of artwork as the regular icon', async () => {
    const regular = await measure('icon-512.png');
    const touch = await measure('apple-touch-icon.png');
    expect(Math.abs(touch.widthShare - regular.widthShare)).toBeLessThan(0.02);
  });

  it('keeps the maskable icon artwork within 36% of its size from the centre', async () => {
    const m = await measure('maskable-512.png');
    expect(m.farthestShare).toBeLessThanOrEqual(0.36);
  });
});
