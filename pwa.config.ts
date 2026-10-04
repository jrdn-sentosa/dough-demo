import type { VitePWAOptions } from 'vite-plugin-pwa';

/**
 * The installable app: manifest and service worker settings. Kept apart from vite.config.ts so a test can read them.
 *
 * What the service worker keeps:
 * - Precached (the install): the app shell (HTML, JS, CSS), the self-hosted fonts, the loaf art, the icons. Lessons
 *   and quizzes are bundled into the JS, so they come with it.
 * - Videos and captions under /videos/: only after first play (see public/video-cache.js), so the install stays small.
 * - Never cached: anything from Supabase (the API, sign-in, the database), or any other address on another origin.
 *   There is no runtime caching rule for other origins, and a page request to /auth/ is never answered from the cache.
 */
export const pwa: Partial<VitePWAOptions> = {
  // The student chooses when to update: a calm "New version available" message with a Refresh button (src/app/UpdatePrompt.tsx).
  registerType: 'prompt',
  injectRegister: false,
  includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
  manifest: {
    name: 'Dough!',
    short_name: 'Dough!',
    description: 'Stack that bread.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
    // The video handler is loaded by the service worker itself; videos and captions are never part of the install.
    globIgnores: ['video-cache.js', 'videos/**'],
    importScripts: ['video-cache.js'],
    navigateFallback: '/index.html',
    // Pages only: sign-in paths, and anything that is a file (a missing video or icon must stay a real 404).
    navigateFallbackDenylist: [/^\/auth(\/|$)/, /^\/videos\//, /^\/icons\//, /^\/assets\//, /\.[A-Za-z0-9]+$/],
    // Fonts beyond the precached files, if any. Same origin only. Nothing else is cached at runtime.
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.woff2'),
        handler: 'CacheFirst',
        options: { cacheName: 'dough-fonts', cacheableResponse: { statuses: [200] } },
      },
    ],
    cleanupOutdatedCaches: true,
    // A new version waits (skipWaiting off) until the student taps Refresh, so it never swaps in under them mid-lesson.
    // Once it activates it takes over the open page (clientsClaim), which is what makes Refresh reload into it.
    skipWaiting: false,
    clientsClaim: true,
  },
  devOptions: { enabled: false },
};
