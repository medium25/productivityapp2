import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Project page on GitHub Pages is served under /productivityapp2/, not
  // the domain root — asset URLs need this prefix or they 404. Local dev
  // keeps the root path so the preview server is unaffected.
  base: command === 'build' ? '/productivityapp2/' : '/',
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
