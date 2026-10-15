// Friendlier, simpler pictograms — one per tier, each with its own
// recognizable silhouette. `filled` switches between solid (achieved)
// and outline-only (not yet reached) rendering.

export function IconRankBronze({ size = 28, filled, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...props}>
      <path
        d="M12 2.4l7 2.9v5.4c0 4.9-3 8.9-7 10.9-4-2-7-6-7-10.9V5.3z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconRankIron({ size = 28, filled, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M5 15.5l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={filled ? 1 : 0.9} />
      <path d="M5 20l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={filled ? 0.55 : 0.5} />
    </svg>
  )
}

export function IconRankSilver({ size = 28, filled, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...props}>
      <path
        d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96l-6.13 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconRankGold({ size = 28, filled, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...props}>
      <path
        d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.13 5.11c.08.2.26.34.47.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 0 0-.19.56l1.29 5.39a.56.56 0 0 1-.84.6l-4.73-2.88a.56.56 0 0 0-.58 0l-4.73 2.88a.56.56 0 0 1-.84-.6l1.29-5.39a.56.56 0 0 0-.19-.56l-4.2-3.6a.56.56 0 0 1 .32-.99l5.52-.44c.21-.01.4-.15.47-.35z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconRankPlatinum({ size = 28, filled, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...props}>
      <path
        d="M12 2.5 13.61 8.12 18.72 5.28 15.88 10.39 21.5 12 15.88 13.61 18.72 18.72 13.61 15.88 12 21.5 10.39 15.88 5.28 18.72 8.12 13.61 2.5 12 8.12 10.39 5.28 5.28 10.39 8.12Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconRankDiamond({ size = 28, filled, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...props}>
      <path
        d="M12 2.8c2.2 3.6 4.8 6.6 4.8 10a4.8 4.8 0 1 1-9.6 0c0-3.4 2.6-6.4 4.8-10z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8.4 9.2h7.2M12 2.8v3.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

export function IconRankSapphire({ size = 28, filled, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...props}>
      <path
        d="M12 4c2.5 4 5.5 7 5.5 10.5a5.5 5.5 0 1 1-11 0C6.5 11 9.5 8 12 4z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconRankCrown({ size = 28, filled, ...props }) {
  const dotFill = filled ? 'currentColor' : 'none'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...props}>
      <path
        d="M4 18.4h16l-1.3-7.6-4 3.1L12 8.2l-2.7 5.7-4-3.1z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="4.3" cy="9.3" r="1.05" fill={dotFill} stroke="currentColor" strokeWidth="1.1" />
      <circle cx="12" cy="6.8" r="1.05" fill={dotFill} stroke="currentColor" strokeWidth="1.1" />
      <circle cx="19.7" cy="9.3" r="1.05" fill={dotFill} stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}

export function IconRankConqueror({ size = 28, filled, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...props}>
      <path
        d="M12 2.6l1.9 4.8 5.1.4-3.9 3.4 1.3 5-4.4-2.7-4.4 2.7 1.3-5-3.9-3.4 5.1-.4z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9.3 16.2L7 21.3l2.9-1.1M14.7 16.2l2.3 5.1-2.9-1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const RANK_ICONS = {
  bronze: IconRankBronze,
  iron: IconRankIron,
  silver: IconRankSilver,
  gold: IconRankGold,
  platinum: IconRankPlatinum,
  diamond: IconRankDiamond,
  sapphire: IconRankSapphire,
  crown: IconRankCrown,
  conqueror: IconRankConqueror,
}
