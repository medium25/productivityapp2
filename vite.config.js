import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Project page on GitHub Pages is served under /productivityapp2/, not
  // the domain root — asset URLs need this prefix or they 404. Local dev
  // keeps the root path so the preview server is unaffected. The Tauri
  // desktop build (`npm run build:tauri`) also needs root-relative paths —
  // it loads dist/ straight off disk via the tauri:// protocol, not GitHub
  // Pages — so it sets TAURI_BUILD to opt out of the GH Pages prefix.
  base: command === 'build' ? (process.env.TAURI_BUILD ? '/' : '/productivityapp2/') : '/',
  server: {
    // Own dedicated port, not the Vite default 5173 — that port keeps
    // colliding with an unrelated CRM project also running on this
    // machine, which made the Tauri desktop shell (devUrl below) load the
    // wrong app entirely whenever this one silently fell back to 5174+.
    port: process.env.PORT ? Number(process.env.PORT) : 5183,
    strictPort: true,
  },
  build: {
    // No assets/ subfolder — GitHub's web uploader keeps flattening nested
    // folders when dragged in, so keep every build output file at the
    // root to make manual uploads foolproof.
    assetsDir: '.',
    rollupOptions: {
      output: {
        // No content hash in filenames — every rebuild must produce the
        // exact same names, otherwise each manual GitHub upload adds new
        // hashed files instead of overwriting the old ones (that's how the
        // repo accumulated dozens of stale html2canvas-*.js/index-*.js
        // files). Trade-off: browsers may briefly cache a stale bundle
        // after a deploy until a hard refresh — acceptable for this
        // manual-upload workflow, not worth the alternative.
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
}))
