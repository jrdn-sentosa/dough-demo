import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import packageJson from '../../package.json?raw';
import iconSource from '../../design/icon/icon.svg?raw';
import maskableSource from '../../design/icon/icon-maskable.svg?raw';
import generator from '../../scripts/generate-icons.mjs?raw';
import { pwa } from '../../pwa.config.ts';

// Every generated icon, as a base64 data URL (the "?inline" import), so the test needs no file access.
const pngs = import.meta.glob<string>('../../public/icons/*.png', { query: '?inline', import: 'default', eager: true });
const manifest = pwa.manifest as Exclude<typeof pwa.manifest, false | undefined>;
const workbox = pwa.workbox as NonNullable<typeof pwa.workbox>;

/** Width and height from a PNG's header. */
function pngSize(src: string): { width: number; height: number } {
  const file = src.replace('/icons/', '');
  const url = pngs[`../../public/icons/${file}`];
  expect(url, file).toBeTruthy();
  const bytes = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  expect(String.fromCharCode(...bytes.subarray(1, 4))).toBe('PNG');
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('manifest', () => {
  it('names the app and is installable as a standalone app', () => {
    expect(manifest).toMatchObject({
      name: 'Dough!',
      short_name: 'Dough!',
      description: 'Stack that bread.',
      display: 'standalone',
      start_url: '/',
      background_color: '#FFFFFF',
      theme_color: '#FFFFFF',
    });
  });

  it('has 192 and 512 icons plus a maskable one, and every file exists at its size', () => {
    const icons = manifest.icons ?? [];
    expect(icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
    for (const icon of icons) {
      const [w] = (icon.sizes ?? '').split('x').map(Number);
      expect(pngSize(icon.src), icon.src).toEqual({ width: w, height: w });
    }
  });

  it('has a 180px apple-touch-icon that index.html links to', () => {
    expect(pngSize('/icons/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
    expect(indexHtml).toContain('href="/icons/apple-touch-icon.png"');
  });

  it('keeps the two icon sources that the generator reads', () => {
    expect(iconSource).toContain('<svg');
    expect(maskableSource).toContain('<svg');
    expect(packageJson).toContain('"icons": "node scripts/generate-icons.mjs"');
  });

  it('makes only the maskable icon from the maskable source', () => {
    const line = (file: string) => generator.split('\n').find((l) => l.includes(`file: '${file}'`)) ?? '';
    expect(line('maskable-512.png')).toContain("source: 'maskable'");
    for (const file of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png']) {
      expect(line(file), file).toContain("source: 'regular'");
    }
    expect(manifest.icons?.filter((i) => i.purpose === 'maskable').map((i) => i.src)).toEqual(['/icons/maskable-512.png']);
  });
});

describe('service worker caching', () => {
  const supabaseUrls = [
    'https://abcdefgh.supabase.co/rest/v1/loaves?select=*',
    'https://abcdefgh.supabase.co/auth/v1/token?grant_type=otp',
    'https://abcdefgh.supabase.co/auth/v1/verify',
    'https://abcdefgh.supabase.co/functions/v1/anything',
    'https://accounts.google.com/o/oauth2/v2/auth',
  ];

  it('never caches Supabase or any other origin at runtime', () => {
    for (const rule of workbox.runtimeCaching ?? []) {
      const pattern = rule.urlPattern;
      expect(typeof pattern).toBe('function');
      for (const href of supabaseUrls) {
        const url = new URL(href);
        const matched = (pattern as (ctx: { url: URL; sameOrigin: boolean }) => boolean)({ url, sameOrigin: false });
        expect(matched, href).toBe(false);
      }
    }
  });

  it('only runtime-caches fonts (videos go through public/video-cache.js)', () => {
    const rules = workbox.runtimeCaching ?? [];
    expect(rules).toHaveLength(1);
    const font = rules[0].urlPattern as (ctx: { url: URL; sameOrigin: boolean }) => boolean;
    expect(font({ url: new URL('https://dough.app/assets/f.woff2'), sameOrigin: true })).toBe(true);
    expect(font({ url: new URL('https://cdn.example.com/f.woff2'), sameOrigin: false })).toBe(false);
  });

  it('answers page requests from the app shell, but never sign-in paths or files', () => {
    const deny = workbox.navigateFallbackDenylist ?? [];
    const denied = (path: string) => deny.some((re) => re.test(path));
    for (const path of ['/auth/callback', '/auth', '/videos/emergency-fund/ef-what-its-for.mp4', '/icons/nope.png', '/sw.js']) {
      expect(denied(path), path).toBe(true);
    }
    for (const path of ['/', '/placement', '/lessons/ef-how-much', '/settings']) {
      expect(denied(path), path).toBe(false);
    }
  });

  it('precaches the shell, fonts, art and icons, but never videos', () => {
    const patterns = workbox.globPatterns ?? [];
    for (const ext of ['js', 'css', 'html', 'woff2', 'svg', 'png']) {
      expect(patterns.join(' ')).toContain(ext);
    }
    expect(workbox.globIgnores).toContain('videos/**');
  });

  it('waits for the student before switching to a new version', () => {
    expect(pwa.registerType).toBe('prompt');
    expect(workbox.skipWaiting).toBe(false);
    // Without this, tapping Refresh activates the new version but the open page never reloads into it.
    expect(workbox.clientsClaim).toBe(true);
  });
});
