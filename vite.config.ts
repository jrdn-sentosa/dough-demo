/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { pwa } from './pwa.config.ts';

export default defineConfig({
  plugins: [react(), VitePWA(pwa)],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
