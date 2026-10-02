import { cpSync, mkdirSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), {
    name: 'runtime-board-art',
    apply: 'build',
    closeBundle() {
      cpSync(new URL('./src/fonts/source-han-sans/OFL.txt', import.meta.url), new URL('./dist/Source-Han-Sans-OFL.txt', import.meta.url));
      // Keep original runtime files as a user-selectable and automatic fallback.
      for (const folder of ['runtime', 'runtime-ktx2', 'basis', 'dock', 'environment', 'meshy-island']) {
        const destination = new URL(`./dist/art/${folder}/`, import.meta.url);
        mkdirSync(destination, { recursive: true });
        cpSync(new URL(`./public/art/${folder}/`, import.meta.url), destination, { recursive: true });
      }
    },
  }],
  build: { copyPublicDir: false },
  // Development proxy keeps the browser on one origin with the server (default port 3000).
  server: { proxy: { '/socket.io': { target: 'http://127.0.0.1:3000', ws: true } } },
  // Playtests use the production build (no developer panel) through the same proxy.
  preview: { proxy: { '/socket.io': { target: 'http://127.0.0.1:3000', ws: true } } },
  test: { environment: 'jsdom', exclude: ['e2e/**', 'node_modules/**'] },
});
