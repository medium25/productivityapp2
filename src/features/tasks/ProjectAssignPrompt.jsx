import { useTranslation } from 'react-i18next'
import { getProjectColor } from './taskLogic'
import ModalClose from './ModalClose'

// Shown on every "drop onto Projects" (see ActionColumnBoard.jsx's
// TaskColumn, TasksInboxPage.jsx's own drop zone) instead of always
// silently turning the dropped task into a brand new project — per user
// report there was no way to instead file it into one of the projects that
// already exist. Picking an existing one just assigns projectId (the task
// stays a task, now nested under that project); "new project" keeps the
// old behavior verbatim (the task itself becomes the project, named after
// it). Clicking outside/Cancel leaves the task exactly where it was.
export default function ProjectAssignPrompt({ task, projects, onAssignExisting, onCreateNew, onCancel }) {
  const { t } = useTranslation()
  if (!task) return null
  const activeProjects = projects.filter((p) => p.status !== 'done')

  return (
    <div className="task-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="task-modal">
        <ModalClose onClick={onCancel} />
        <div className="task-modal__header">{t('tasks.assignProjectTitle')}</div>
        <div className="task-modal__body">
          <p className="task-modal__due-required-text">{t('tasks.assignProjectBody', { title: task.title })}</p>
          <div className="task-modal__project-picker">
            {activeProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                className="task-modal__project-option"
                onClick={() => onAssignExisting(p.id)}
              >
                <span className="task-modal__project-dot" style={{ '--dot-color': getProjectColor(p) }} />
                {p.name}
              </button>
            ))}
            <button
              type="button"
              className="task-modal__project-option task-modal__project-option--create"
              onClick={onCreateNew}
            >
              + {t('tasks.assignProjectCreateNew', { title: task.title })}
            </button>
          </div>
        </div>
        <div className="task-modal__footer">
          <button type="button" onClick={onCancel}>{t('tasks.cancel')}</button>
        </div>
      </div>
    </div>
  )
}
