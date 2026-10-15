import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/useTasksStore'

// Deliberately its own small row instead of reusing TaskCard — Trash needs
// two actions TaskCard's menu doesn't have (restore-to-active, permanent
// delete) and none of TaskCard's own ones (inline edit, toggle-done,
// timer), so bolting them on there would just be dead weight on every
// other list that uses it.
function TrashRow({ task, project, onRestore, onDeleteForever }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="task-card">
      <div className="task-card__row">
        <span className="task-card__title">
          {task.title || t('tasks.untitledTask')}
          {project && <span className="task-card__title-project"> ({project.name})</span>}
        </span>
        {confirming ? (
          <span className="project-row__confirm">
            <span>{t('tasks.confirmDeleteForever')}</span>
            <button type="button" onClick={() => onDeleteForever(task.id)}>{t('tasks.yes')}</button>
            <button type="button" onClick={() => setConfirming(false)}>{t('tasks.no')}</button>
          </span>
        ) : (
          <>
            <button type="button" className="inline-timer__btn" onClick={() => onRestore(task.id)}>
              {t('tasks.restoreTask')}
            </button>
            <button
              type="button"
              className="inline-timer__btn project-row__menu-danger"
              onClick={() => setConfirming(true)}
            >
              {t('tasks.deleteForever')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// Holds everything deleteTask has soft-deleted (see useTasksStore) until the
// user either restores it or empties the trash — nothing lands here any
// other way, and nothing leaves except via the two actions on each row (or
// "Очистить корзину" below).
export default function TrashPage() {
  const { t } = useTranslation()
  const tasks = useTasksStore((s) => s.tasks)
  const projects = useTasksStore((s) => s.projects)
  const restoreTask = useTasksStore((s) => s.restoreTask)
  const permanentlyDeleteTask = useTasksStore((s) => s.permanentlyDeleteTask)
  const emptyTrash = useTasksStore((s) => s.emptyTrash)
  const [confirmingEmpty, setConfirmingEmpty] = useState(false)

  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects]
  )

  const trashedTasks = useMemo(
    () => tasks
      .filter((t2) => t2.status === 'trashed')
      .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || '')),
    [tasks]
  )

  const handleEmptyTrash = () => {
    emptyTrash()
    setConfirmingEmpty(false)
  }

  return (
    <div className="tasks-page tasks-page--edge-to-edge">
      <div className="tasks-board tasks-board--fill">
        <div className="tasks-column tasks-column--trash">
          <div className="tasks-column__header">
            <span>{t('nav.trashGroup')}</span>
            {trashedTasks.length > 0 && (
              confirmingEmpty ? (
                <span className="project-row__confirm">
                  <span>{t('tasks.confirmEmptyTrash')}</span>
                  <button type="button" onClick={handleEmptyTrash}>{t('tasks.yes')}</button>
                  <button type="button" onClick={() => setConfirmingEmpty(false)}>{t('tasks.no')}</button>
                </span>
              ) : (
                <button type="button" className="inline-timer__btn project-row__menu-danger" onClick={() => setConfirmingEmpty(true)}>
                  {t('tasks.emptyTrash')}
                </button>
              )
            )}
          </div>
          <div className="tasks-column__list">
            {trashedTasks.length === 0 ? (
              <p className="task-section__empty">{t('tasks.emptyGeneric')}</p>
            ) : (
              trashedTasks.map((task) => (
                <TrashRow
                  key={task.id}
                  task={task}
                  project={task.projectId ? projectsById[task.projectId] : null}
                  onRestore={restoreTask}
                  onDeleteForever={permanentlyDeleteTask}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
