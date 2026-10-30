import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays } from './taskLogic'

const DAYS = 112 // 16 weeks

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

const BELL = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0" />
  </svg>
)

// Small bell on a habit's card (shown once a due day was missed). Pressing it opens the habit's
// activity map — a calendar-like grid of the last 16 weeks, like a contribution graph — with the
// missed day marked, the streak numbers and two actions.
export default function MissedHabitBell({ habit, missedIso, unseen, today, applies, t, locale, color, onMark, onDismiss }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
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
  const toggle = () => {
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const width = Math.min(340, window.innerWidth - 24)
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, r.right - width + 8))
      const below = r.bottom + 330 <= window.innerHeight
      setPos(below ? { left, top: r.bottom + 10, width } : { left, bottom: window.innerHeight - r.top + 10, width })
    }
    setOpen(true)
  }

  const stats = useMemo(() => {
    const created = habit.createdAt.slice(0, 10)
    const yesterday = addDays(today, -1)
    const cells = []
    let due = 0
    let done = 0
    for (let k = DAYS - 1; k >= 0; k -= 1) {
      const iso = addDays(yesterday, -k)
      const isDone = !!habit.completions[iso]
      const isDue = iso >= created && applies(habit, iso)
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
    return { cells, streak, best, pct: due ? Math.round((done / due) * 100) : 0, misses: cells.filter((c) => c.kind === 'miss').length }
  }, [habit, today, applies])

  // Nothing to show: no fresh miss and no misses in the last 16 weeks.
  if (!unseen && stats.misses === 0) return null
  const alert = unseen && !!missedIso
  const dateLabel = missedIso ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date(`${missedIso}T00:00:00`)) : ''

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
        className={'hmiss__bell' + (open ? ' hmiss__bell--on' : '') + (alert ? '' : ' hmiss__bell--quiet')}
        onClick={toggle}
        title={t('habits.missedBell')}
        aria-label={t('habits.missedBell')}
        aria-expanded={open}
      >
        {BELL}
      </button>
      {open && (
        <div className="hmiss__card" role="dialog" style={pos || undefined}>
          <div className="hmiss__head">
            <span className="hmiss__icon">{BELL}</span>
            <div className="hmiss__text">
              <h3>{alert ? t('habits.missedTitle', { name: habit.title }) : t('habits.mapTitle', { name: habit.title })}</h3>
              <p>{alert ? t('habits.missedText', { date: dateLabel }) : t('habits.mapText', { n: stats.misses })}</p>
            </div>
            <button type="button" className="hmiss__x" onClick={() => setOpen(false)} aria-label={t('tasksHub.close')}>×</button>
          </div>
          <div className="hmiss__map">
            {stats.cells.map((c) => (
              <i key={c.iso} className={'hmiss__cell hmiss__cell--' + c.kind + (c.iso === missedIso ? ' hmiss__cell--now' : '')} title={c.iso} />
            ))}
          </div>
          <div className="hmiss__stats">
            <span><b>{stats.streak}</b> {t('habits.statStreak')}</span>
            <span><b>{stats.best}</b> {t('habits.statBest')}</span>
            <span><b>{stats.pct}%</b> {t('habits.statPercent')}</span>
          </div>
          <div className="hmiss__actions">
            {alert && <button type="button" className="hmiss__btn hmiss__btn--primary" onClick={() => { onMark(missedIso); setOpen(false) }}>{t('habits.markNow')}</button>}
            <button type="button" className="hmiss__btn" onClick={() => { if (alert) onDismiss(); setOpen(false) }}>{t('habits.gotIt')}</button>
          </div>
        </div>
      )}
    </span>
  )
}
