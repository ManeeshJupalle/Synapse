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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        manualChunks(id) {
          // Heavy ML stack — only background worker imports this
          if (
            id.includes('@xenova/transformers') ||
            id.includes('onnxruntime-web') ||
            id.includes('onnxruntime-common')
          ) {
            return 'ml-engine';
          }
          // Force graph + D3
          if (id.includes('react-force-graph') || id.includes('d3') || id.includes('three')) {
            return 'graph-viz';
          }
          // React core
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          // Dexie
          if (id.includes('dexie')) {
            return 'dexie';
          }
        },
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
