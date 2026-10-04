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
      // The jsdom screen tests are slow when many run at once; the default 5s made them fail on a busy machine.
      testTimeout: 15_000,
    },
  };
});
