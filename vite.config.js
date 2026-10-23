import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Web version wears the neon skin (src/styles/neon.css). Many dark-mode rules
// in index.css hard-code the desktop app's graphite greys instead of using
// tokens; rather than editing index.css (it is kept in step with the Mac app
// via patches), those exact greys are swapped for the neon palette at build
// time. The Tauri build keeps the original colours.
const NEON_PALETTE = {
  '#1c1d21': '#070a10',
  '#1f2024': '#0a0e15',
  '#25272c': '#0e131c',
  '#2a2c32': '#111826',
  '#32353c': '#141c29',
  '#33353c': '#141c29',
  '#33363d': '#16202f',
  '#3a3d45': '#1b2433',
  '#42454e': '#2c3a52',
  '#4a4d57': '#2c3a52',
  '#8b8e97': '#7b8aa3',
  '#a3a6af': '#8d9bb3',
  '#c3c5cc': '#b4c0d4',
  '#e9eaee': '#e8eef7',
  '#6fa0ff': '#3d8bff',
  '#6fe0a0': '#2bff88',
  '#ff6595': '#ff4d5e',
}
const neonPalette = () => ({
  name: 'neon-palette',
  enforce: 'pre',
  transform(code, id) {
    if (process.env.TAURI_BUILD || !/[\\/]src[\\/]styles[\\/]index\.css$/.test(id.split('?')[0])) return null
    return code.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => NEON_PALETTE[hex.toLowerCase()] || hex)
  },
})

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), neonPalette()],
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
