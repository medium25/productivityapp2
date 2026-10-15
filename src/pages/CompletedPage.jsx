import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/useTasksStore'
import TaskCard from '../features/tasks/TaskCard'
import TaskSection from '../features/tasks/TaskSection'
import { getProjectColor } from '../features/tasks/taskLogic'

// All-time archive of what's actually finished — per user request that's
// either a standalone task (no project) marked done, or a whole project
// once every one of its tasks is checked off (see useTasksStore's
// toggleTaskDone/pendingProjectPrompt/completeProject) — not individual
// tasks that merely happen to belong to a project, done or not. Those stay
// visible (struck through) inside the project itself, in the regular
// Projects column, until the project as a whole gets marked complete.
export default function CompletedPage() {
  const { t } = useTranslation()
  const tasks = useTasksStore((s) => s.tasks)
  const projects = useTasksStore((s) => s.projects)
  const toggleTaskDone = useTasksStore((s) => s.toggleTaskDone)
  const deleteTask = useTasksStore((s) => s.deleteTask)
  const updateTask = useTasksStore((s) => s.updateTask)
  const reopenProject = useTasksStore((s) => s.reopenProject)
  const deleteProject = useTasksStore((s) => s.deleteProject)

  const [confirmingProjectId, setConfirmingProjectId] = useState(null)

  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects]
  )

  const doneStandaloneTasks = useMemo(
    () => tasks
      .filter((t2) => t2.status === 'done' && !t2.projectId)
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
    [tasks]
  )

  const completedProjects = useMemo(
    () => projects
      .filter((p) => p.status === 'done')
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
    [projects]
  )

  const isEmpty = doneStandaloneTasks.length === 0 && completedProjects.length === 0

  return (
    <div className="tasks-page tasks-page--edge-to-edge">
      <div className="tasks-board tasks-board--fill">
        <div className="tasks-column tasks-column--completed">
          <div className="tasks-column__list">
            {isEmpty ? (
              <p className="task-section__empty">{t('tasks.emptyGeneric')}</p>
            ) : (
              <>
                {completedProjects.map((project) => {
                  const projectTasks = tasks.filter((t2) => t2.projectId === project.id && t2.status !== 'trashed')
                  const isConfirming = confirmingProjectId === project.id
                  return (
                    <TaskSection
                      key={project.id}
                      sectionKey={`completed-project.${project.id}`}
                      title={
                        <span className="tasks-projects__title">
                          <span className="tasks-projects__dot" style={{ '--dot-color': getProjectColor(project) }} />
                          {project.name}
                        </span>
                      }
                      tasks={projectTasks}
                      projectsById={{}}
                      badgeCount={0}
                      emptyLabel={t('tasks.noTasksInProject')}
                      headerActions={
                        isConfirming ? (
                          <span className="project-row__confirm" onClick={(e) => e.stopPropagation()}>
                            <span>{t('tasks.confirmDeleteProject')}</span>
                            <button
                              type="button"
                              onClick={() => { deleteProject(project.id); setConfirmingProjectId(null) }}
                            >
                              {t('tasks.yes')}
                            </button>
                            <button type="button" onClick={() => setConfirmingProjectId(null)}>{t('tasks.no')}</button>
                          </span>
                        ) : (
                          <span className="project-row__confirm" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => reopenProject(project.id)}>
                              {t('tasks.restoreTask')}
                            </button>
                            <button
                              type="button"
                              className="project-row__menu-danger"
                              onClick={() => setConfirmingProjectId(project.id)}
                            >
                              {t('tasks.deleteForever')}
                            </button>
                          </span>
                        )
                      }
                      onToggleDone={toggleTaskDone}
                      onDelete={deleteTask}
                      onUpdate={updateTask}
                    />
                  )
                })}
                {doneStandaloneTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    project={task.projectId ? projectsById[task.projectId] : null}
                    onToggleDone={toggleTaskDone}
                    onDelete={deleteTask}
                    onUpdate={updateTask}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
