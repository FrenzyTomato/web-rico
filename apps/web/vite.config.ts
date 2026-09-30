import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Development proxy keeps the browser on one origin with the server (default port 3000).
  server: { proxy: { '/socket.io': { target: 'http://127.0.0.1:3000', ws: true } } },
  // Playtests use the production build (no developer panel) through the same proxy (docs/PLAYTEST.md).
  preview: { proxy: { '/socket.io': { target: 'http://127.0.0.1:3000', ws: true } } },
  test: { environment: 'jsdom', exclude: ['e2e/**', 'node_modules/**'] },
});
