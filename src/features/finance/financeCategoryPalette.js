// src/features/finance/financeCategoryPalette.js
//
// Fixed per-category identity colors for the Budget table (cycled by row
// index) — matches the pastel-but-distinct palette from the Projects
// cards reference the user pointed at. Row tint and category name text
// use separate shades of the same hue on purpose: the row background
// stays the original light pastel (per user request — darkening the
// text shouldn't drag the background darker too), while the name text
// uses a darker shade for contrast/legibility.
const FINANCE_CATEGORY_BG_HEX = [
  '#3860d6', // blue
  '#2e7d4f', // green
  '#b8860a', // gold
  '#6b6b8c', // slate
  '#6a4fd6', // purple
  '#1f9e82', // teal
  '#c0392b', // red
  '#70707a', // gray
]

const FINANCE_CATEGORY_TEXT_HEX = [
  '#24409f', // blue
  '#1f5c3a', // green
  '#8a6508', // gold
  '#44445c', // slate
  '#4f36ad', // purple
  '#146c59', // teal
  '#962c20', // red
  '#4a4a52', // gray
]

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function categoryColorFor(index) {
  const i = index % FINANCE_CATEGORY_BG_HEX.length
  const { r, g, b } = hexToRgb(FINANCE_CATEGORY_BG_HEX[i])
  return {
    text: FINANCE_CATEGORY_TEXT_HEX[i],
    hex: FINANCE_CATEGORY_BG_HEX[i],
    rowBg: `rgba(${r}, ${g}, ${b}, 0.08)`,
  }
}
