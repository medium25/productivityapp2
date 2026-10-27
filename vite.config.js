import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dark theme is the neon look (src/styles/neon.css). Many dark-mode rules in
// index.css hard-code the old graphite greys instead of using tokens, so for
// every rule that has one, a copy scoped to :root[data-skin='neon'] is added
// with those greys swapped for the neon palette. Only the copies change colour:
// the original rules — and so the light theme — are left exactly as they were.
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
const HEX = /#[0-9a-fA-F]{6}\b/g
const swapColors = (value) => value.replace(HEX, (hex) => NEON_PALETTE[hex.toLowerCase()] || hex)
const neonSkin = () => ({
  postcssPlugin: 'neon-skin',
  Once(root) {
    if (!/styles[\\/]index\.css$/.test(root.source?.input?.file || '')) return
    const hits = []
    root.walkRules((rule) => {
      for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
        if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return
      }
      let hit = false
      rule.each((node) => { if (node.type === 'decl' && swapColors(node.value) !== node.value) hit = true })
      if (hit) hits.push(rule)
    })
    for (const rule of hits) {
      const copy = rule.clone()
      copy.selectors = rule.selectors.map((sel) => (sel.startsWith(':root') ? sel.replace(':root', ":root[data-skin='neon']") : `:root[data-skin='neon'] ${sel}`))
      copy.each((node) => {
        if (node.type !== 'decl') return node.remove()
        const value = swapColors(node.value)
        if (value === node.value) node.remove()
        else node.value = value
      })
      rule.after(copy)
    }
  },
})

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  css: { postcss: { plugins: [neonSkin()] } },
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
