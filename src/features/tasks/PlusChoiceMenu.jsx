import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getProjectColor } from './taskLogic'
import { brightTagColor } from './projectParent'

const FOLDER_PLUS = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM12 11v5M9.5 13.5h5" /></svg>
)
const FOLDER = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>
)
const BACK = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
)

// Menu opened by the «+» on a task without a project: make the task a project right away
// («Создать подзадачу»), or add it to one of the existing projects.
export default function PlusChoiceMenu({ rect, projects, tasks, parentProject, taskProject, onCreateProject, onPickProject, onAddOwn, onShowPath, onManage, onClose }) {
  const { t } = useTranslation()
  const [step, setStep] = useState('choice')
  const ref = useRef(null)

  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const width = Math.min(300, window.innerWidth - 24)
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width + 6))
  const below = rect.bottom + 330 <= window.innerHeight
  const pos = below ? { left, top: rect.bottom + 10, width } : { left, bottom: window.innerHeight - rect.top + 10, width }
  const active = projects.filter((p) => p.status !== 'done')
  const openCount = (id) => tasks.filter((x) => x.projectId === id && x.status === 'active').length

  return (
    <div ref={ref} className="plusmenu" style={pos} role="menu">
      {step === 'choice' ? (
        parentProject ? (
          <button type="button" className="plusmenu__opt plusmenu__opt--first" onClick={onAddOwn}>
            <span className="plusmenu__ico plusmenu__ico--a">{FOLDER_PLUS}</span>
            <span><b>{t('tasksList.plusAddOwn')}</b><small>{t('tasksList.plusAddOwnHint')}</small></span>
          </button>
        ) : (
          <>
            <button type="button" className="plusmenu__opt plusmenu__opt--first" onClick={onCreateProject}>
              <span className="plusmenu__ico plusmenu__ico--a">{FOLDER_PLUS}</span>
              <span><b>{t('tasksList.plusSubtask')}</b><small>{t('tasksList.plusSubtaskHint')}</small></span>
            </button>
            <button type="button" className="plusmenu__opt" onClick={() => setStep('list')}>
              <span className="plusmenu__ico plusmenu__ico--b">{FOLDER}</span>
              <span><b>{t('tasksList.plusAddToProject')}</b><small>{t('tasksList.plusAddHint')}</small></span>
            </button>
            {taskProject && onShowPath && (
              <button type="button" className="plusmenu__opt" onClick={onShowPath}>
                <span className="plusmenu__ico plusmenu__ico--b">{FOLDER}</span>
                <span><b>{t('tasksList.plusPath', { name: taskProject.name })}</b><small>{t('tasksList.plusPathHint')}</small></span>
              </button>
            )}
          </>
        )
      ) : (
        <>
          <div className="plusmenu__head">
            <button type="button" className="plusmenu__back" onClick={() => setStep('choice')} aria-label={t('tasksList.plusBack')}>{BACK}</button>
            <b>{t('tasksList.plusPickProject')}</b>
          </div>
          <div className="plusmenu__list">
            {active.length === 0 && <p className="plusmenu__empty">{t('tasksList.plusNoProjects')}</p>}
            {active.map((p) => (
              <button
                key={p.id}
                type="button"
                className="plusmenu__proj"
                style={{ '--pc': getProjectColor(p), '--pc-bright': brightTagColor(getProjectColor(p)) }}
                onClick={() => onPickProject(p.id)}
              >
                <i />
                <span className="plusmenu__name">{p.name}</span>
                <small>{openCount(p.id)}</small>
              </button>
            ))}
          </div>
          {onManage && <button type="button" className="plusmenu__manage" onClick={onManage}>{t('tasksList.plusManage')}</button>}
        </>
      )}
    </div>
  )
}
