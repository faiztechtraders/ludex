/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@skills': path.resolve(import.meta.dirname, 'skills'),
      '@creative': path.resolve(import.meta.dirname, 'creative'),
    },
  },
  server: {
    // Preferred port. strictPort:false lets Vite walk upward (3001, 3002, ...)
    // automatically when 3000 is already taken, so `npm run dev` never fails
    // on a port conflict.
    port: 3000,
    strictPort: false,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rolldownOptions: {
      output: {
        // Keep dependencies in their own chunk. The 205-game dataset (with its
        // cached art URLs) changes often; React, the router and motion do not.
        // Splitting them means a dataset edit doesn't invalidate ~150 kB of
        // library code in returning visitors' caches.
        advancedChunks: {
          groups: [{ name: 'vendor', test: /[\\/]node_modules[\\/]/ }],
        },
      },
    },
    // The app chunk is dataset-dominated and loads on every route, so
    // code-splitting it would trade a spinner for no real gain. ~210 kB gzipped
    // total is the honest cost of shipping the library offline-capable.
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
    include: ['skills/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
