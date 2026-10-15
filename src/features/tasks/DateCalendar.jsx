import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WEEKDAYS } from './taskLogic'
import { IconChevronDown } from '../../icons/Icons'

function pad(n) {
  return String(n).padStart(2, '0')
}

function isoOf(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

// Monday-first 6-week (42-cell) grid around the given month — same
// alignment convention as FocusStatistics.jsx's year heatmap and this
// file's own WEEKDAYS order, so "Monday" always lines up under the same
// column everywhere in the app.
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - startOffset)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push(d)
  }
  return cells
}

// Small custom month-grid picker rendered right inside the "due" dropdown
// popover (see TaskFormModal) — replaces the native <input type="date">,
// whose browser-native calendar popup can't be positioned or styled and
// used to render floating at the top-left of the viewport instead of
// under the Due button, per user request.
export default function DateCalendar({ value, onChange }) {
  const { t, i18n } = useTranslation()
  const today = new Date()
  const initial = value ? new Date(`${value}T00:00:00`) : today
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  const cells = buildMonthGrid(viewYear, viewMonth)
  const monthLabel = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' })
    .format(new Date(viewYear, viewMonth, 1))
  const todayIso = isoOf(today.getFullYear(), today.getMonth(), today.getDate())

  const goPrev = () => {
    const d = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }
  const goNext = () => {
    const d = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  return (
    <div className="due-calendar">
      <div className="due-calendar__header">
        <span className="due-calendar__month-label">{monthLabel}</span>
        <div className="due-calendar__nav">
          <button type="button" className="due-calendar__nav-btn" onClick={goPrev} aria-label={t('tasks.prevMonth')}>
            <IconChevronDown size={14} className="due-calendar__nav-icon due-calendar__nav-icon--prev" />
          </button>
          <button type="button" className="due-calendar__nav-btn" onClick={goNext} aria-label={t('tasks.nextMonth')}>
            <IconChevronDown size={14} className="due-calendar__nav-icon due-calendar__nav-icon--next" />
          </button>
        </div>
      </div>
      <div className="due-calendar__weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w.dow}>{t(`tasks.weekdayShort.${w.key}`)}</span>
        ))}
      </div>
      <div className="due-calendar__grid">
        {cells.map((d) => {
          const iso = isoOf(d.getFullYear(), d.getMonth(), d.getDate())
          const inMonth = d.getMonth() === viewMonth
          return (
            <button
              key={iso}
              type="button"
              className={
                'due-calendar__cell'
                + (inMonth ? '' : ' due-calendar__cell--outside')
                + (iso === todayIso ? ' due-calendar__cell--today' : '')
                + (iso === value ? ' due-calendar__cell--selected' : '')
              }
              onClick={() => onChange(iso)}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
