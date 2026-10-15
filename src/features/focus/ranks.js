// Rank ladder: 8 tiers x 3 sublevels (III lowest -> I highest within a tier),
// plus a single top rank with no sublevels. Point cost to advance depends on
// which tier you're currently in.
export const TIER_ORDER = ['bronze', 'iron', 'silver', 'gold', 'platinum', 'diamond', 'sapphire', 'crown']

const TIER_COST = {
  bronze: 600,
  iron: 600,
  silver: 600,
  gold: 600,
  platinum: 600,
  diamond: 1000,
  sapphire: 1000,
  crown: 2000,
}

export const TIER_COLORS = {
  bronze: '#E8935B',
  iron: '#9CA3AD',
  silver: '#D8DEE6',
  gold: '#F2C94C',
  platinum: '#F5A623',
  diamond: '#9B7FE8',
  sapphire: '#5AC8FA',
  crown: '#C77DFF',
  conqueror: '#F0455C',
}

function hexToRgb(hex) {
  const num = parseInt(hex.slice(1), 16)
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff }
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

// Shifts saturation and lightness (hue stays put) so each sublevel within a
// tier reads as a distinct step from duller (III) to richer, juicier (I) —
// rather than fading toward gray/white, which looks washed out.
function subColor(tier, sub) {
  const base = TIER_COLORS[tier]
  if (sub === null) return base
  const { h, s, l } = rgbToHsl(hexToRgb(base))
  let s2 = s
  let l2 = l
  if (sub === 3) {
    s2 = Math.max(15, s - 22)
    l2 = Math.max(0, l - 12)
  } else if (sub === 1) {
    s2 = Math.min(100, s + 14)
    l2 = Math.min(88, l + 7)
  }
  const { r, g, b } = hslToRgb(h, s2, l2)
  return rgbToHex(r, g, b)
}

export function romanNumeral(sub) {
  return sub === 3 ? 'III' : sub === 2 ? 'II' : 'I'
}

export function buildRanks() {
  const ranks = []
  let cumulative = 0
  TIER_ORDER.forEach((tier) => {
    for (let sub = 3; sub >= 1; sub--) {
      ranks.push({ id: `${tier}-${sub}`, tier, sub, threshold: cumulative, color: subColor(tier, sub), index: ranks.length })
      cumulative += TIER_COST[tier]
    }
  })
  ranks.push({ id: 'conqueror', tier: 'conqueror', sub: null, threshold: cumulative, color: TIER_COLORS.conqueror, index: ranks.length })
  return ranks
}

export function getRankIndexForPoints(ranks, points) {
  let idx = 0
  for (let i = 0; i < ranks.length; i++) {
    if (points >= ranks[i].threshold) idx = i
    else break
  }
  return idx
}
