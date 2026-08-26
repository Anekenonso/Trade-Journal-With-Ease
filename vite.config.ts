/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // The default threads pool crashes on Windows with Vite 8 (worker init fails
  // with "Cannot read properties of undefined (reading 'config')"). The forks
  // pool runs the suite reliably and in parallel.
  test: {
    pool: 'forks',
  },
});
