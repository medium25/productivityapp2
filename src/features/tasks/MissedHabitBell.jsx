import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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

const WEEKDAYS_MON = [1, 2, 3, 4, 5, 6, 0]

// The streak circle on a habit's card (green = days done in a row, red = days missed, grey 0 = neither).
// Pressing it opens the habit's activity map as its own page over the main column: one filter — the
// month — as tiles with «done / days», the chosen month as a calendar below.
export default function MissedHabitBell({ habit, missedIso, unseen, today, applies, t, locale, color, onMark, onDismiss }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(today.slice(0, 7))

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // The last twelve calendar months up to now, from the month the habit was created; each with «done / days».
  const months = useMemo(() => {
    const created = habit.createdAt.slice(0, 10)
    const yesterday = addDays(today, -1)
    const list = []
    for (let k = 11; k >= 0; k -= 1) {
      const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - k, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (key < created.slice(0, 7) && key !== today.slice(0, 7)) continue
      const n = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      const cells = []
      let due = 0
      let done = 0
      for (let day = 1; day <= n; day += 1) {
        const iso = `${key}-${String(day).padStart(2, '0')}`
        const isDone = !!habit.completions[iso]
        const isDue = iso >= created && iso <= yesterday && applies(habit, iso)
        cells.push({ iso, day, kind: isDone ? 'done' : isDue ? 'miss' : 'none' })
        // «done of days»: the month's days up to today that the habit was due on (or done anyway).
        if (iso >= created && iso <= today && (isDone || applies(habit, iso))) { due += 1; if (isDone) done += 1 }
      }
      const name = new Intl.DateTimeFormat(locale, { month: 'long' }).format(d)
      list.push({ key, name: name.charAt(0).toUpperCase() + name.slice(1), year: d.getFullYear(), lead: (d.getDay() + 6) % 7, cells, done, due })
    }
    return list
  }, [habit, today, applies, locale])
  const current = months.find((m) => m.key === month) || months[months.length - 1]
  // Plain totals: days done this calendar year, and in the last 365 days.
  const totals = useMemo(() => {
    const yearStart = `${today.slice(0, 4)}-01-01`
    const yearAgo = addDays(today, -364)
    let year = 0
    let last = 0
    Object.keys(habit.completions).forEach((d) => {
      if (!habit.completions[d] || d > today) return
      if (d >= yearStart) year += 1
      if (d >= yearAgo) last += 1
    })
    return { year, last }
  }, [habit, today])

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

  const openPage = () => { setMonth(missedIso && alert ? missedIso.slice(0, 7) : today.slice(0, 7)); setOpen(true) }
  const host = open ? document.querySelector('.main-column') : null
  const weekday = (i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i))

  return (
    <span
      className="hmiss"
      style={color ? { '--hm-color': color } : undefined}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={'hmiss__bell hmiss__bell--' + run.kind + (open ? ' hmiss__bell--on' : '')}
        onClick={openPage}
        title={runLabel}
        aria-label={runLabel}
        aria-expanded={open}
      >
        {run.n > 99 ? '99+' : run.n}
      </button>
      {open && host && current && createPortal(
        <div className="hmpage" role="dialog" aria-label={t('habits.mapTitle', { name: habit.title })} onClick={(e) => e.stopPropagation()}>
          <div className="hmpage__inner">
            <div className="hmpage__bar">
              <button type="button" className="hmpage__back" onClick={() => setOpen(false)} aria-label={t('tasksHub.close')}>‹</button>
              <h2>{alert ? t('habits.missedTitle', { name: habit.title }) : t('habits.mapTitle', { name: habit.title })}</h2>
            </div>
            <div className="hmpage__stats">
              <div className="hmpage__stat"><b>{totals.year}</b><span>{t('habits.doneThisYear')}</span></div>
              <div className="hmpage__stat"><b>{totals.last}</b><span>{t('habits.doneLast365')}</span></div>
            </div>
            <div className="hmpage__months" role="tablist">
              {months.map((m) => {
                const pct = m.due ? Math.round((m.done / m.due) * 100) : 0
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={m.key === current.key}
                    title={`${m.done} / ${m.due}`}
                    className={'hmpage__month' + (m.key === current.key ? ' hmpage__month--on' : '') + (m.due && pct < 60 ? ' hmpage__month--low' : '')}
                    onClick={() => setMonth(m.key)}
                  >
                    <span className="hmpage__ring" style={{ '--p': pct }}><b>{m.done}</b></span>
                    <small>{m.name}{m.key.slice(0, 4) !== today.slice(0, 4) ? ` ${m.year}` : ''}</small>
                  </button>
                )
              })}
            </div>
            <div className="hmpage__cal">
              {WEEKDAYS_MON.map((d, i) => <div key={d} className="hmpage__wd">{weekday(i)}</div>)}
              {Array.from({ length: current.lead }, (_, i) => <div key={`p${i}`} />)}
              {current.cells.map((c) => (
                <div key={c.iso} className={'hmpage__day hmpage__day--' + c.kind + (c.iso === missedIso ? ' hmpage__day--now' : '') + (c.iso === today ? ' hmpage__day--today' : '')}>{c.day}</div>
              ))}
            </div>
            {alert && (
              <div className="hmiss__actions">
                <button type="button" className="hmiss__btn hmiss__btn--primary" onClick={() => { onMark(missedIso); setOpen(false) }}>{t('habits.markNow')}</button>
                <button type="button" className="hmiss__btn" onClick={() => { onDismiss(); setOpen(false) }}>{t('habits.gotIt')}</button>
              </div>
            )}
          </div>
        </div>,
        host,
      )}
    </span>
  )
}
