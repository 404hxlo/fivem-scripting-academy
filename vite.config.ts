import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  // The Lua worker is loaded on demand. Discover its runtime before the first
  // exercise so initial dependency optimization never reloads an active lesson.
  optimizeDeps: { include: ['wasmoon'] },
  server: {
    watch: { ignored: ['**/.test-data/**', '**/artifacts/**', '**/release/**'] },
  },
  build: { chunkSizeWarningLimit: 1800 },
  worker: { format: 'es' },
});
