import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed as a GitHub Pages project site at /FareYield/ (the GitHub repo is named
// "FareYield", not this local folder), with the production build output copied to
// the repo root (see ../). In dev the app is served from '/' so the in-app browser
// preview works without a path prefix.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/FareYield/' : '/',
  server: { port: 8190 },
  build: {
    outDir: '../dist-site',
    emptyOutDir: true
  }
}))
