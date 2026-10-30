import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../../store/useTasksStore'
import ModalClose from './ModalClose'

// Mounted once in App (next to ProjectCompletionPrompt). Right after a task is turned into a
// project the system requires the project's first task — the window has no close button and
// ignores the backdrop and Esc until one is added.
export default function ProjectFirstTaskModal() {
  const { t } = useTranslation()
  const pendingId = useTasksStore((s) => s.pendingFirstTask)
  const projects = useTasksStore((s) => s.projects)
  const addFirstProjectTask = useTasksStore((s) => s.addFirstProjectTask)
  const dismissFirstTask = useTasksStore((s) => s.dismissFirstTask)
  const tasks = useTasksStore((s) => s.tasks)
  const [value, setValue] = useState('')
  const inputRef = useRef(null)
  const project = pendingId ? projects.find((p) => p.id === pendingId) : null

  useEffect(() => { if (project) { setValue(''); setTimeout(() => inputRef.current?.focus(), 30) } }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const hasKids = project ? tasks.some((x) => x.projectId === project.id && x.status !== 'trashed') : false
  // The required first task can't be skipped; a later «add a task to this project» can be closed.
  useEffect(() => {
    if (!project || !hasKids) return undefined
    const onKey = (e) => { if (e.key === 'Escape') dismissFirstTask() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [project, hasKids, dismissFirstTask])
  if (!project) return null

  const submit = () => { if (value.trim()) addFirstProjectTask(project.id, value) }

  return (
    <div className="task-modal-overlay" onClick={(e) => { if (hasKids && e.target === e.currentTarget) dismissFirstTask() }}>
      <div className="task-modal pfirst" role="alertdialog" aria-modal="true">
        {hasKids && <ModalClose onClick={dismissFirstTask} />}
        <div className="pfirst__body">
          <h3 className="pfirst__title">{hasKids ? t('tasksList.addToProjectTitle', { name: project.name }) : t('tasksList.firstTaskTitle', { name: project.name })}</h3>
          <p className="pfirst__text">{hasKids ? t('tasksList.addToProjectBody') : t('tasksList.firstTaskBody', { name: project.name })}</p>
          <input
            ref={inputRef}
            type="text"
            className="pfirst__input"
            value={value}
            placeholder={t('tasksList.firstTaskPlaceholder')}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
          />
          <button type="button" className="pfirst__go" disabled={!value.trim()} onClick={submit}>{t('tasksList.firstTaskAdd')}</button>
        </div>
      </div>
    </div>
  )
}
