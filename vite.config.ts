import { defineConfig } from 'vite';

export default defineConfig({
  // Served by GitHub Pages at https://jeanroderickclaude.github.io/Mobile-game/.
  // Change this if the repository is renamed.
  base: '/Mobile-game/',
  server: { host: true, port: 5173 },
  build: { chunkSizeWarningLimit: 2000 },
});
