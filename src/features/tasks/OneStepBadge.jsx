import { useEffect, useRef, useState } from 'react'

// The days a one-step task has been left undone: today minus the day it was planned for (0 when it is
// on time or already done).
export function daysLeftUndone(task, today) {
  const iso = task.deadline || task.whenDate
  if (task.status === 'done' || !iso || iso >= today) return 0
  return Math.round((new Date(`${today}T00:00:00`) - new Date(`${iso}T00:00:00`)) / 86400000)
}

const INFO = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
  </svg>
)

// The same indicator as on repeating tasks, for one-step ones: a red number of days the task has been left
// undone (grey 0 when it is on time). Pressing it explains that a one-step task has no completion map.
export default function OneStepBadge({ days, t }) {
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

  const toggle = () => {
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const width = Math.min(300, window.innerWidth - 24)
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, r.right - width + 8))
      const below = r.bottom + 170 <= window.innerHeight
      setPos(below ? { left, top: r.bottom + 10, width } : { left, bottom: window.innerHeight - r.top + 10, width })
    }
    setOpen(true)
  }

  const label = days > 0 ? t('habits.oneStepBell', { n: days }) : t('habits.oneStepBellZero')

  return (
    <span
      ref={ref}
      className="hmiss"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        className={'hmiss__bell hmiss__bell--' + (days > 0 ? 'bad' : 'none') + (open ? ' hmiss__bell--on' : '')}
        onClick={toggle}
        title={label}
        aria-label={label}
        aria-expanded={open}
      >
        {days > 99 ? '99+' : days}
      </button>
      {open && (
        <div className="hmiss__card" role="dialog" style={pos || undefined}>
          <div className="hmiss__head">
            <span className="hmiss__icon hmiss__icon--info">{INFO}</span>
            <div className="hmiss__text">
              <h3>{t('habits.oneStepTitle')}</h3>
              <p>{t('habits.oneStepNote')}</p>
              <p>{t('habits.oneStepNumber')}</p>
            </div>
            <button type="button" className="hmiss__x" onClick={() => setOpen(false)} aria-label={t('tasksHub.close')}>×</button>
          </div>
        </div>
      )}
    </span>
  )
}
