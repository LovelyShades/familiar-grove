import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { open: true },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        legacy: 'legacy.html',
      },
    },
  },
});
