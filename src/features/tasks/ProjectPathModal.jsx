import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ModalClose from './ModalClose'
import { isoFromDate, todayISO } from './taskLogic'

const pad = (n) => String(n).padStart(2, '0')
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const taskIso = (task) => task.deadline || task.whenDate || null

// Window opened from a task's project dot: the project's path, step by step —
// finished steps with the date and time they were completed, the current step,
// and what is still ahead with its planned date (and time, when one was set).
export default function ProjectPathModal({ open, project, color, tasks, onClose, onChangeProject }) {
  const { t, i18n } = useTranslation()

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const today = todayISO()
  const steps = useMemo(() => {
    if (!project) return []
    const own = tasks.filter((x) => x.projectId === project.id && (x.status === 'done' || x.status === 'active'))
    const done = own.filter((x) => x.status === 'done').sort((a, b) => String(a.completedAt || '').localeCompare(String(b.completedAt || '')))
    const open = own.filter((x) => x.status === 'active').sort((a, b) => {
      const ia = taskIso(a)
      const ib = taskIso(b)
      if (ia && ib) return ia === ib ? (a.startMinute ?? 0) - (b.startMinute ?? 0) : ia.localeCompare(ib)
      if (ia) return -1
      if (ib) return 1
      return 0
    })
    return [...done, ...open]
  }, [project, tasks])

  if (!open || !project) return null

  const locale = i18n.language || 'ru'
  const fmtDate = (d) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d).replace('.', '')
  const tomorrow = isoFromDate(new Date(Date.now() + 86400000))
  const meta = (task) => {
    if (task.status === 'done') {
      if (!task.completedAt) return [t('tasksList.pathDone')]
      const d = new Date(task.completedAt)
      return ['✓ ' + fmtDate(d), hhmm(d)]
    }
    const iso = taskIso(task)
    if (!iso) return [t('tasksList.pathNoDate')]
    const [y, m, day] = iso.split('-').map(Number)
    const label = iso === today ? t('tasksList.pathToday') : iso === tomorrow ? t('tasksList.pathTomorrow') : fmtDate(new Date(y, m - 1, day))
    const time = task.startMinute != null ? `${pad(Math.floor(task.startMinute / 60))}:${pad(task.startMinute % 60)}` : null
    return time ? [label, time] : [label]
  }

  const doneCount = steps.filter((x) => x.status === 'done').length
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0

  return (
    <div className="task-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="task-modal ppath" role="dialog" aria-modal="true" style={{ '--ppath-c': color.deep, '--ppath-bright': color.bright }}>
        <ModalClose onClick={onClose} />
        <div className="ppath__head">
          <span className="ppath__dot" />
          <h3 className="ppath__title">{project.name}</h3>
        </div>
        {steps.length > 0 && (
          <div className="ppath__sub">
            <b>{t('tasksList.pathProgress', { done: doneCount, total: steps.length })}</b> · {pct}%
          </div>
        )}
        <div className="ppath__body">
          {steps.length === 0 ? (
            <p className="ppath__empty">{t('tasksList.pathEmpty')}</p>
          ) : (
            <ol className="ppath__tl">
              {steps.map((task) => {
                const done = task.status === 'done'
                const iso = taskIso(task)
                const cur = !done && !!iso && iso <= today
                const parts = meta(task)
                return (
                  <li key={task.id} className={'ppath__st' + (done ? ' ppath__st--done' : '') + (cur ? ' ppath__st--cur' : '')}>
                    <span className="ppath__node" aria-hidden="true">
                      {done && (
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      )}
                    </span>
                    <div className="ppath__name">{task.title}</div>
                    <div className="ppath__meta">
                      {parts.map((p, i) => (
                        <span key={i}>{i > 0 && <i>•</i>}{p}</span>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
        <div className="ppath__foot">
          <button type="button" className="ppath__change" onClick={onChangeProject}>{t('tasksList.changeProject')}</button>
        </div>
      </div>
    </div>
  )
}
