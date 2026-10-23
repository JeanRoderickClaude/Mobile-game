import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works from any folder on a static host.
  base: './',
  server: { host: true, port: 5173 },
  build: { chunkSizeWarningLimit: 2000 },
});
