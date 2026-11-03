import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays } from './taskLogic'

// The latest day before today the habit was due on, if it was not done that day (looking back a week).
export function lastMissedDay(habit, today, applies) {
  const created = habit.createdAt.slice(0, 10)
  for (let k = 1; k <= 7; k += 1) {
    const iso = addDays(today, -k)
    if (iso < created) return null
    if (applies(habit, iso)) return habit.completions[iso] ? null : iso
  }
  return null
}

// How many due days in a row were missed, counting back from yesterday (days the habit was not due
// on are skipped); stops at a day it was done or before it was created.
export function missedStreak(habit, today, applies) {
  const created = habit.createdAt.slice(0, 10)
  let n = 0
  for (let k = 1; k <= 120; k += 1) {
    const iso = addDays(today, -k)
    if (iso < created) break
    if (!applies(habit, iso)) continue
    if (habit.completions[iso]) break
    n += 1
  }
  return n
}

// How many due days in a row the habit was done, up to now: today counts when done (when not done yet it
// is simply still open), then back from yesterday over due days; stops at the first miss.
export function doneStreak(habit, today, applies) {
  const created = habit.createdAt.slice(0, 10)
  let n = habit.completions[today] ? 1 : 0
  for (let k = 1; k <= 400; k += 1) {
    const iso = addDays(today, -k)
    if (habit.completions[iso]) { n += 1; continue }
    if (iso < created || applies(habit, iso)) break
  }
  return n
}

const BELL = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0" />
  </svg>
)

// Small bell on a habit's card (shown once a due day was missed). Pressing it opens the habit's
// activity map — a calendar-like grid of the last 16 weeks, like a contribution graph — with the
// missed day marked, the streak numbers and two actions.
export default function MissedHabitBell({ habit, missedIso, unseen, today, applies, t, color, onMark, onDismiss }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)
  const [range, setRange] = useState('month')
  const ref = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  // The card is positioned against the window (lists clip their overflow), under the bell or above it near the bottom.
  // Year ranges need a wider card than the month.
  const toggle = () => {
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setAnchor({ right: r.right, top: r.top, bottom: r.bottom })
    setOpen(true)
  }
  const pos = (() => {
    if (!anchor) return null
    const width = Math.min(range === 'month' ? 340 : 560, window.innerWidth - 24)
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, anchor.right - width + 8))
    return anchor.bottom + (range === 'month' ? 330 : 380) <= window.innerHeight
      ? { left, top: anchor.bottom + 10, width }
      : { left, bottom: window.innerHeight - anchor.top + 10, width }
  })()

  const stats = useMemo(() => {
    const created = habit.createdAt.slice(0, 10)
    const yesterday = addDays(today, -1)
    // The days the map covers: the current month, the current year, or the last 365 days.
    const year = today.slice(0, 4)
    const monthEnd = new Date(Number(year), Number(today.slice(5, 7)), 0).getDate()
    const [from, to] = range === 'month'
      ? [`${today.slice(0, 7)}-01`, `${today.slice(0, 7)}-${String(monthEnd).padStart(2, '0')}`]
      : range === 'year' ? [`${year}-01-01`, `${year}-12-31`] : [addDays(today, -364), today]
    const cells = []
    // Weeks run Monday to Sunday down the columns, so pad the first column up to the weekday of `from`.
    for (let k = (new Date(`${from}T00:00:00`).getDay() + 6) % 7; k > 0; k -= 1) cells.push({ iso: `pad${k}`, kind: 'pad' })
    let due = 0
    let done = 0
    for (let iso = from; iso <= to; iso = addDays(iso, 1)) {
      const isDone = !!habit.completions[iso]
      const isDue = iso >= created && iso <= yesterday && applies(habit, iso)
      if (isDone) { cells.push({ iso, kind: 'done' }); done += 1; due += 1 }
      else if (isDue) { cells.push({ iso, kind: 'miss' }); due += 1 }
      else cells.push({ iso, kind: 'none' })
    }
    // current streak up to today, and the best run ever
    let streak = 0
    let cursor = habit.completions[today] ? today : yesterday
    while (habit.completions[cursor]) { streak += 1; cursor = addDays(cursor, -1) }
    const dates = Object.keys(habit.completions).filter((d) => habit.completions[d]).sort()
    let best = 0
    let run = 0
    dates.forEach((d, i) => { run = i > 0 && addDays(dates[i - 1], 1) === d ? run + 1 : 1; best = Math.max(best, run) })
    return { cells, cols: Math.ceil(cells.length / 7), streak, best, pct: due ? Math.round((done / due) * 100) : 0 }
  }, [habit, today, applies, range])

  // Always available: red when there is a fresh miss, calm otherwise — the map is how you see the whole history.
  const alert = unseen && !!missedIso
  // The indicator: green with the run of days done, or red with the run of days missed (grey zero when neither).
  const run = useMemo(() => {
    const good = doneStreak(habit, today, applies)
    if (good > 0) return { kind: 'good', n: good }
    const bad = missedStreak(habit, today, applies)
    return bad > 0 ? { kind: 'bad', n: bad } : { kind: 'none', n: 0 }
  }, [habit, today, applies])
  const runLabel = run.kind === 'good' ? t('habits.doneRun', { n: run.n }) : run.kind === 'bad' ? t('habits.missedStreak', { n: run.n }) : t('habits.missedBell')

  return (
    <span
      ref={ref}
      className="hmiss"
      style={color ? { '--hm-color': color } : undefined}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        className={'hmiss__bell hmiss__bell--' + run.kind + (open ? ' hmiss__bell--on' : '')}
        onClick={toggle}
        title={runLabel}
        aria-label={runLabel}
        aria-expanded={open}
      >
        {run.n > 99 ? '99+' : run.n}
      </button>
      {open && (
        <div className={'hmiss__card' + (range === 'month' ? '' : ' hmiss__card--wide')} role="dialog" style={pos || undefined}>
          <div className="hmiss__head">
            <span className="hmiss__icon">{BELL}</span>
            <div className="hmiss__text">
              <h3>{alert ? t('habits.missedTitle', { name: habit.title }) : t('habits.mapTitle', { name: habit.title })}</h3>
            </div>
            <button type="button" className="hmiss__x" onClick={() => setOpen(false)} aria-label={t('tasksHub.close')}>×</button>
          </div>
          <div className="hmiss__filters">
            {[['last', 'habits.rangeLast'], ['year', 'habits.rangeYear'], ['month', 'habits.rangeMonth']].map(([key, label]) => (
              <button key={key} type="button" className={'hmiss__chip' + (range === key ? ' hmiss__chip--on' : '')} onClick={() => setRange(key)}>{t(label)}</button>
            ))}
          </div>
          <div className={'hmiss__map' + (range === 'month' ? ' hmiss__map--month' : ' hmiss__map--year')} style={range === 'month' ? undefined : { gridTemplateColumns: `repeat(${stats.cols}, 1fr)` }}>
            {stats.cells.map((c) => (
              <i key={c.iso} className={'hmiss__cell hmiss__cell--' + c.kind + (c.iso === missedIso ? ' hmiss__cell--now' : '')} title={c.kind === 'pad' ? undefined : c.iso} />
            ))}
          </div>
          <div className="hmiss__stats">
            <span><b>{stats.streak}</b> {t('habits.statStreak')}</span>
            <span><b>{stats.best}</b> {t('habits.statBest')}</span>
            <span><b>{stats.pct}%</b> {t('habits.statPercent')}</span>
          </div>
          {alert && (
            <div className="hmiss__actions">
              <button type="button" className="hmiss__btn hmiss__btn--primary" onClick={() => { onMark(missedIso); setOpen(false) }}>{t('habits.markNow')}</button>
              <button type="button" className="hmiss__btn" onClick={() => { onDismiss(); setOpen(false) }}>{t('habits.gotIt')}</button>
            </div>
          )}
        </div>
      )}
    </span>
  )
}
