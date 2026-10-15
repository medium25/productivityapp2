import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusHistoryStore, dateKey } from '../../store/useFocusHistoryStore'
import { formatDuration } from './timeFormat'

const CHART_MAX_HEIGHT = 140

// All 7 days of the current calendar week (Monday-first, matching the
// Apple Screen Time reference), regardless of today — unlike
// dateRanges.js's getRangeDates('week') (which stops at today), this
// chart needs the full week's columns so future days in the week render
// as flat/empty bars instead of not existing at all.
function buildCurrentWeek() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayIndex = (today.getDay() + 6) % 7 // Monday = 0
  const monday = new Date(today)
  monday.setDate(today.getDate() - dayIndex)
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d)
  }
  return days
}

// Apple Screen-Time-styled weekly bar chart. Originally scoped to one Focus
// project (per user request — the timer used to be per-project, its own
// graph shouldn't lump every project's time into one combined total/bar) —
// now also drives MyFocusPage.jsx's project-less version: pass `project` to
// read useFocusHistoryStore.byProject for just that project's numbers, or
// omit it (pass `color` instead) to read the plain per-day `seconds` totals
// across every session regardless of source. Or pass `dailySeconds` — a
// plain `{ 'YYYY-MM-DD': seconds }` map from some other store entirely
// (MyFocusPage passes useQuranStore.listened) to chart that instead.
export default function WeeklyActivityChart({ project, color, showTotal = true, dailySeconds }) {
  const { t, i18n } = useTranslation()
  const seconds = useFocusHistoryStore((s) => s.seconds)
  const byProject = useFocusHistoryStore((s) => s.byProject)
  // Which day's bar is showing its duration label — a native `title`
  // tooltip needed a hover-and-wait that doesn't really work in a desktop
  // webview, per user report; click-to-toggle instead.
  const [activeKey, setActiveKey] = useState(null)

  const week = useMemo(() => buildCurrentWeek(), [])
  const dowFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.language, { weekday: 'short' })
    } catch {
      return null
    }
  }, [i18n.language])

  const days = useMemo(() => week.map((d) => {
    const key = dateKey(d)
    const secs = dailySeconds
      ? (dailySeconds[key] || 0)
      : project ? ((byProject[key] || {})[project.id] || 0) : (seconds[key] || 0)
    return { key, date: d, secs }
  }), [week, byProject, seconds, project, dailySeconds])

  const weekMax = Math.max(1, ...days.map((d) => d.secs))
  const todayTotal = dailySeconds
    ? (dailySeconds[dateKey()] || 0)
    : project ? ((byProject[dateKey()] || {})[project.id] || 0) : (seconds[dateKey()] || 0)
  const barColor = project ? (project.color || 'var(--text-muted)') : (color || 'var(--text-accent, var(--accent))')

  return (
    <div className="weekly-activity-chart">
      {showTotal && (
        <>
          <h2 className="focus-stats__heading">{t('focus.today')}</h2>
          <div className="weekly-activity-chart__total">{formatDuration(todayTotal, t)}</div>
        </>
      )}

      <div className="weekly-activity-chart__bars">
        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            className="weekly-activity-chart__col"
            onClick={() => setActiveKey((k) => (k === d.key ? null : d.key))}
          >
            {/* Rendered as a normal flow child above the bar (not
                absolutely positioned) so it just pushes this column taller
                from the shared bottom baseline — no per-bar-height math
                needed to keep it from overlapping neighbors. */}
            {activeKey === d.key && (
              <span className="weekly-activity-chart__bubble">{formatDuration(d.secs, t)}</span>
            )}
            <div className="weekly-activity-chart__bar">
              {d.secs > 0 && (
                <div
                  className="weekly-activity-chart__segment"
                  style={{
                    height: `${Math.max(2, (d.secs / weekMax) * CHART_MAX_HEIGHT)}px`,
                    background: barColor,
                  }}
                />
              )}
            </div>
            <span className="weekly-activity-chart__dow">{dowFormatter ? dowFormatter.format(d.date) : ''}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
