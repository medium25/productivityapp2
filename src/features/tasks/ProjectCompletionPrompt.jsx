import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../../store/useTasksStore'
import ModalClose from './ModalClose'

// Mounted once in Layout (see App.jsx), same pattern as FloatingTimerWidget
// — pops up over whichever page the user is on the instant the last task
// in a project gets checked off (see toggleTaskDone in useTasksStore),
// since that can happen from My day, Upcoming, Sometime, Inbox's Projects
// column, or Completed, not just one place. Per user request a project
// never silently counts as "done" just because every task happens to be
// checked — the user has to actually say so here; declining just leaves
// the project as-is; there's no case within reach where they'd want to
// undo that later without unchecking a task.
export default function ProjectCompletionPrompt() {
  const { t } = useTranslation()
  const pendingProjectId = useTasksStore((s) => s.pendingProjectPrompt)
  const projects = useTasksStore((s) => s.projects)
  const completeProject = useTasksStore((s) => s.completeProject)
  const dismissProjectPrompt = useTasksStore((s) => s.dismissProjectPrompt)

  const project = pendingProjectId ? projects.find((p) => p.id === pendingProjectId) : null
  if (!project) return null

  return (
    <div className="task-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) dismissProjectPrompt() }}>
      <div className="task-modal">
        <ModalClose onClick={dismissProjectPrompt} />
        <div className="task-modal__header">{t('tasks.projectCompletePromptTitle', { name: project.name })}</div>
        <div className="task-modal__body">
          <p>{t('tasks.projectCompletePromptBody')}</p>
        </div>
        <div className="task-modal__footer">
          <button type="button" onClick={dismissProjectPrompt}>{t('tasks.projectCompletePromptAddTask')}</button>
          <button type="button" className="primary" onClick={() => completeProject(project.id)}>
            {t('tasks.projectCompletePromptDone')}
          </button>
        </div>
      </div>
    </div>
  )
}
