import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const here = p => fileURLToPath(new URL(p, import.meta.url))

// One page per film keeps exactly one WebGL context alive at a time, which matters on a
// TV stick with 1 to 2 GB of memory. base './' lets the same build run from a web server,
// from file:// or from the Android shell's asset loader.
export default defineConfig({
  root: here('.'),
  base: './',
  publicDir: here('public'),
  logLevel: 'warn',
  build: {
    outDir: here('../dist'),
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2500,
    rollupOptions: { input: { index: here('index.html'), tbm: here('tbm.html'), starship: here('starship.html'), tsunami: here('tsunami.html'), card: here('card.html') } },
  },
  server: {
    host: '127.0.0.1', port: 5302, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8302' },
  },
  preview: { host: '127.0.0.1', port: 5302, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8302' } },
})
