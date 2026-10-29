import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getProjectColor } from './taskLogic'
import ModalClose from './ModalClose'

// Pop-up menu for choosing a task's project: shown when a task is added, and
// again whenever its project pill is tapped to change it. Pick an existing
// project, "no project", or create a new one on the spot. Closing it without
// picking (backdrop, ×, Esc) leaves everything as it was.
export default function ProjectPickerModal({ open, taskTitle, projects, currentProjectId, onPick, onCreate, onCancel }) {
  const { t } = useTranslation()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { if (open) { setCreating(false); setName('') } }, [open])
  useEffect(() => { if (creating) inputRef.current?.focus() }, [creating])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  const active = projects.filter((p) => p.status !== 'done')
  const submitCreate = () => {
    const trimmed = name.trim()
    if (trimmed) onCreate(trimmed)
  }

  return (
    <div className="task-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="task-modal" role="dialog" aria-modal="true">
        <ModalClose onClick={onCancel} />
        <div className="task-modal__header">{t('tasksList.pickProjectTitle')}</div>
        <div className="task-modal__body">
          {taskTitle && <p className="task-modal__due-required-text project-picker__task">{taskTitle}</p>}
          <div className="task-modal__project-picker">
            {active.map((p) => (
              <button
                key={p.id}
                type="button"
                className={'task-modal__project-option' + (currentProjectId === p.id ? ' active' : '')}
                onClick={() => onPick(p.id)}
              >
                <span className="task-modal__project-dot" style={{ '--dot-color': getProjectColor(p) }} />
                {p.name}
              </button>
            ))}
            <button
              type="button"
              className={'task-modal__project-option' + (!currentProjectId ? ' active' : '')}
              onClick={() => onPick(null)}
            >
              <span className="task-modal__project-dot task-modal__project-dot--none" />
              {t('tasksList.noProject')}
            </button>
            {creating ? (
              <div className="project-picker__create">
                <input
                  ref={inputRef}
                  type="text"
                  className="focus-create__input"
                  placeholder={t('tasksList.newProjectPlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitCreate() } }}
                />
                <button type="button" className="project-picker__create-btn" disabled={!name.trim()} onClick={submitCreate}>
                  {t('tasksList.create')}
                </button>
              </div>
            ) : (
              <button type="button" className="task-modal__project-option task-modal__project-option--create" onClick={() => setCreating(true)}>
                + {t('tasksList.newProject')}
              </button>
            )}
          </div>
        </div>
        <div className="task-modal__footer">
          <button type="button" onClick={onCancel}>{t('tasks.cancel')}</button>
        </div>
      </div>
    </div>
  )
}
