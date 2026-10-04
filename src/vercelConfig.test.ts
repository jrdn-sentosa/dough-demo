import { describe, expect, it } from 'vitest';
import vercelJson from '../vercel.json?raw';

const config = JSON.parse(vercelJson) as { rewrites: { source: string; destination: string }[] };

// Vercel serves files that exist first, then applies rewrites. The source is a path pattern
// whose parentheses hold a plain regular expression, so match the path the same way here.
function rewritten(path: string): boolean {
  const [{ source }] = config.rewrites;
  const inner = /^\/\((.*)\)$/.exec(source);
  if (!inner) throw new Error('unexpected rewrite source shape');
  return new RegExp(`^${inner[1]}$`).test(path.slice(1));
}

describe('vercel.json', () => {
  it('rewrites every page route to the app', () => {
    for (const path of ['/', '/login', '/placement', '/placement/result', '/lessons', '/lessons/ef-how-much', '/quiz', '/saving-setup']) {
      expect(rewritten(path), path).toBe(true);
    }
    expect(config.rewrites[0].destination).toBe('/index.html');
  });

  it('lets missing videos, images, icons, and assets return a real 404', () => {
    for (const path of [
      '/videos/emergency-fund/ef-what-its-for.mp4',
      '/videos/emergency-fund/nope.vtt',
      '/icons/icon-192.png',
      '/assets/index-abc123.js',
      '/favicon.ico',
      '/manifest.webmanifest',
      '/sw.js',
      '/design/loaves/emergency-fund/mix.svg',
    ]) {
      expect(rewritten(path), path).toBe(false);
    }
  });
});
