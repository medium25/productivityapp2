import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusHistoryStore, dateKey } from '../../store/useFocusHistoryStore'
import { useFocusStore } from '../../store/useFocusStore'
import { startOfDay } from './dateRanges'
import { formatDuration } from './timeFormat'
import { computeCurrentStreak } from './streaks'
import ProjectTimeBreakdown from './ProjectTimeBreakdown'
import ProjectBreakdownRow from './ProjectBreakdownRow'

function buildYearGrid(seconds) {
  const today = startOfDay(new Date())
  const trueStart = new Date(today)
  trueStart.setDate(today.getDate() - 364)

  const dayIndex = (trueStart.getDay() + 6) % 7 // Monday = 0
  const gridStart = new Date(trueStart)
  gridStart.setDate(trueStart.getDate() - dayIndex)

  const cells = []
  let activeDays = 0
  const cursor = new Date(gridStart)
  while (cursor <= today) {
    const inRange = cursor >= trueStart
    const key = dateKey(cursor)
    const hasSession = inRange && (seconds[key] || 0) > 0
    if (hasSession) activeDays++
    cells.push({ date: new Date(cursor), key, inRange, hasSession })
    cursor.setDate(cursor.getDate() + 1)
  }

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return { weeks, activeDays, today }
}

function buildLast7Days(today) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(d)
  }
  return days
}

function computeBestStreak(cellsFlat) {
  let best = 0
  let current = 0
  cellsFlat.forEach((cell) => {
    if (!cell.inRange) return
    if (cell.hasSession) {
      current++
      best = Math.max(best, current)
    } else {
      current = 0
    }
  })
  return best
}

export default function FocusStatistics() {
  const { t, i18n } = useTranslation()
  const seconds = useFocusHistoryStore((s) => s.seconds)
  const byProject = useFocusHistoryStore((s) => s.byProject)
  const projects = useFocusStore((s) => s.projects)

  // buildYearGrid/streaks walk 365 days — expensive enough that recomputing
  // them every second (the Pomodoro tick replaces `seconds` with a new
  // reference every 1s while a session runs) would jank this tab whenever
  // it's open during an active session. Every day except today is static
  // once a session ends, and today's own grid cell only flips from "no
  // session" to "has session" once — so gate the recompute on that boolean
  // instead of the raw `seconds` reference; still uses the latest `seconds`
  // whenever it does recompute.
  const todayHasSession = (seconds[dateKey()] || 0) > 0
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { weeks, activeDays, today } = useMemo(() => buildYearGrid(seconds), [todayHasSession])
  const flat = useMemo(() => weeks.flat(), [weeks])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentStreak = useMemo(() => computeCurrentStreak(seconds, today), [todayHasSession, today])
  const bestStreak = useMemo(() => computeBestStreak(flat), [flat])
  const last7Days = useMemo(() => buildLast7Days(today), [today])

  const [selectedKey, setSelectedKey] = useState(() => dateKey())

  const selectedProjectRows = useMemo(() => {
    const dayData = byProject[selectedKey] || {}
    return Object.entries(dayData)
      .map(([projectId, secs]) => ({ projectId, secs, project: projects.find((p) => p.id === projectId) }))
      .sort((a, b) => b.secs - a.secs)
  }, [byProject, selectedKey, projects])

  const selectedTotal = seconds[selectedKey] || 0
  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedKey.split('-').map(Number)
    try {
      return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d))
    } catch {
      return selectedKey
    }
  }, [selectedKey, i18n.language])

  const dayOfWeekFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.language, { weekday: 'short' })
    } catch {
      return null
    }
  }, [i18n.language])

  return (
    <div className="focus-stats">
      <div className="focus-stats__row">
        <div className="focus-stats__stat">{t('focus.statsActiveDays', { count: activeDays })}</div>
        <div className="focus-stats__stat">{t('focus.statsCurrentStreak', { count: currentStreak })}</div>
        <div className="focus-stats__stat">{t('focus.statsBestStreak', { count: bestStreak })}</div>
      </div>

      <h2 className="focus-stats__heading">{t('focus.last7Days')}</h2>
      <div className="focus-week-strip">
        {last7Days.map((d) => {
          const key = dateKey(d)
          const hasSession = (seconds[key] || 0) > 0
          return (
            <button
              key={key}
              type="button"
              className={
                'focus-week-strip__day' +
                (hasSession ? ' active' : ' inactive') +
                (key === selectedKey ? ' selected' : '')
              }
              onClick={() => setSelectedKey(key)}
            >
              <span className="focus-week-strip__dow">{dayOfWeekFormatter ? dayOfWeekFormatter.format(d) : ''}</span>
              <span className="focus-week-strip__num">{d.getDate()}</span>
            </button>
          )
        })}
      </div>

      <div className="focus-day-detail">
        <div className="focus-day-detail__header">
          <span className="focus-day-detail__date">{selectedDateLabel}</span>
          <span className="focus-day-detail__total">{formatDuration(selectedTotal, t)}</span>
        </div>
        {selectedProjectRows.length === 0 ? (
          <p className="settings-hint">{t('focus.noSessionsThisDay')}</p>
        ) : (
          <div className="project-breakdown__list">
            {selectedProjectRows.map((row) => (
              <ProjectBreakdownRow key={row.projectId} project={row.project} seconds={row.secs} />
            ))}
          </div>
        )}
      </div>

      <h2 className="focus-stats__heading">{t('focus.yearOverview')}</h2>
      <div className="focus-calendar">
        {weeks.map((week, wi) => (
          <div className="focus-calendar__week" key={wi}>
            {week.map((cell) => (
              <div
                key={cell.key}
                className={
                  'focus-calendar__cell' +
                  (!cell.inRange ? ' empty' : cell.hasSession ? ' active' : ' inactive') +
                  (cell.inRange ? ' clickable' : '') +
                  (cell.inRange && cell.key === selectedKey ? ' selected' : '')
                }
                title={cell.inRange ? cell.key : undefined}
                onClick={cell.inRange ? () => setSelectedKey(cell.key) : undefined}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="focus-calendar__legend">
        <span className="focus-calendar__legend-item"><span className="focus-calendar__legend-dot active" />{t('focus.legendActive')}</span>
        <span className="focus-calendar__legend-item"><span className="focus-calendar__legend-dot inactive" />{t('focus.legendInactive')}</span>
      </div>

      <ProjectTimeBreakdown />
    </div>
  )
}
