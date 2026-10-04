/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };
import { pwa } from './pwa.config.ts';

export default defineConfig(({ mode }) => {
  // The version shown in Settings and sent with feedback: package.json's version, plus the short commit on Vercel.
  const sha = loadEnv(mode, '.', '').VERCEL_GIT_COMMIT_SHA;
  const version = sha ? `${pkg.version}+${sha.slice(0, 7)}` : pkg.version;
  return {
    plugins: [react(), VitePWA(pwa)],
    define: { __APP_VERSION__: JSON.stringify(version) },
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      setupFiles: ['src/testSetup.ts'],
      // The default is one worker per logical processor minus one. Each worker is a jsdom environment, and on a
      // machine with many (and uneven) cores that many at once starve each other: a worker can stall for seconds and
      // take whatever test it is in with it. A smaller share finishes sooner and never hit the timeout in 30 runs
      // (the default failed 1 run in 20, in a placement test that takes about half a second on its own).
      maxWorkers: '40%',
    },
  };
});
