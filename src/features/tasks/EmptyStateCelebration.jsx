import { useMemo } from 'react'
import { IconAllDone } from '../../icons/Icons'

// A one-shot confetti burst behind the "All done" message (per user
// request — "пусть будет салют с поздравлением об окончании") instead of
// just plain muted text once a list empties out. Pieces are randomized
// once per mount (useMemo, not re-rolled every render) so the burst plays
// once and settles rather than looping forever.
const CONFETTI_COLORS = ['#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6']
const PIECE_COUNT = 20

// `compact` (per user request to reuse this on Insights/Habits too, which
// unlike Inbox/Tasks/Wishes don't replace their whole list with the empty
// state — the celebration sits as a banner above still-visible content, so
// it needs a smaller footprint than the full-page version).
export default function EmptyStateCelebration({ message, compact = false }) {
  const pieces = useMemo(() => Array.from({ length: PIECE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 1 + Math.random() * 0.7,
    dx: `${Math.round(Math.random() * 70 - 35)}px`,
    rot: `${Math.floor(Math.random() * 360)}deg`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  })), [])

  return (
    <div className={'empty-celebration' + (compact ? ' empty-celebration--compact' : '')}>
      <div className="empty-celebration__confetti" aria-hidden="true">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="empty-celebration__piece"
            style={{
              left: `${p.left}%`,
              '--dur': `${p.duration}s`,
              '--delay': `${p.delay}s`,
              '--dx': p.dx,
              '--rot': p.rot,
              background: p.color,
            }}
          />
        ))}
      </div>
      <IconAllDone className="empty-celebration__icon" size={compact ? 28 : 40} />
      <p className="empty-celebration__message">{message}</p>
    </div>
  )
}
