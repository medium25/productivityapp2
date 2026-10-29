import { useEffect, useRef, useState } from 'react'
import { WEEKDAYS } from './taskLogic'

// Repeat sign + chooser shared by «Мой день» and «Задачи».
export const CYCLE_ICON = (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 6.5A5 5 0 0 0 4.2 4.6L3 6M3 2.5V6h3.5M3 9.5a5 5 0 0 0 8.8 1.9L13 10M13 13.5V10H9.5" />
  </svg>
)

// Cycle chooser under a Today row (opened from the sign at the end of the
// card): none / daily / weekly / monthly / chosen weekdays. Closes on any
// click outside, like the deadline picker.
export function CyclePicker({ task, t, onSet, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || e.target.closest?.('[data-cycle-trigger]')) return
      onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [onClose])
  const [custom, setCustom] = useState(task.recurrence === 'custom')
  const days = task.recurrenceDays || []
  const pick = (recurrence) => { onSet(recurrence, null); onClose() }
  const toggleDay = (dow) => {
    const next = days.includes(dow) ? days.filter((x) => x !== dow) : [...days, dow]
    onSet(next.length ? 'custom' : 'none', next.length ? next : null)
  }
  const cur = task.recurrence || 'none'
  const chip = (label, active, onClick) => (
    <button type="button" className={'deadline-picker__chip' + (active ? ' deadline-picker__chip--on' : '')} onClick={onClick}>{label}</button>
  )
  return (
    <div ref={ref} className="deadline-picker cycle-picker" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="deadline-picker__quick">
        {chip(t('tasksHub.cycleNone'), cur === 'none' && !custom, () => pick('none'))}
        {chip(t('tasks.recurrenceDaily'), cur === 'daily', () => pick('daily'))}
        {chip(t('tasks.recurrenceWeekly'), cur === 'weekly', () => pick('weekly'))}
        {chip(t('tasks.recurrenceMonthly'), cur === 'monthly', () => pick('monthly'))}
        {chip(t('tasks.recurrenceCustom'), cur === 'custom' || custom, () => setCustom(true))}
      </div>
      {(custom || cur === 'custom') && (
        <div className="deadline-picker__quick">
          {WEEKDAYS.map((w) => chip(t(`tasks.weekdayShort.${w.key}`), days.includes(w.dow), () => toggleDay(w.dow)))}
        </div>
      )}
    </div>
  )
}
