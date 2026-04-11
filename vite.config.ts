import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import manifest from './public/manifest.json' with { type: 'json' };

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
});
