import { useTranslation } from 'react-i18next'
import { formatDuration } from './timeFormat'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// "Time by project" as a donut instead of just the color-dot list below it
// (see ProjectTimeBreakdown.jsx) — per user request, seeing each project's
// *share* of the total needs a shape, not just a sorted list of numbers.
// Same stacked stroke-dasharray-segments-on-one-circle recipe as
// TodayProgress/RankCard's single-value rings, just one <circle> per row
// instead of one — each segment's strokeDashoffset picks up where the
// previous one's arc ended, so the whole thing reads as one continuous ring.
export default function ProjectPieChart({ rows, total, metric }) {
  const { t } = useTranslation()
  let cumulative = 0

  return (
    <div className="project-pie">
      <svg className="project-pie__ring" viewBox="0 0 120 120" width="150" height="150" aria-hidden="true">
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--control-bg)" strokeWidth="16" />
        {rows.map((row) => {
          const fraction = total > 0 ? row.value / total : 0
          const dash = fraction * CIRCUMFERENCE
          const offset = -cumulative
          cumulative += dash
          return (
            <circle
              key={row.projectId}
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={row.project?.color || 'var(--text-muted)'}
              strokeWidth="16"
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={offset}
              transform="rotate(-90 60 60)"
            />
          )
        })}
      </svg>
      <div className="project-pie__center">
        <span className="project-pie__total">
          {metric === 'sessions' ? t('focus.cyclesCount', { count: total }) : formatDuration(total, t)}
        </span>
        <span className="project-pie__total-label">{t('focus.pieTotalLabel')}</span>
      </div>
    </div>
  )
}
