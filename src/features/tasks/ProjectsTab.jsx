import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconMoreVertical, IconPencil } from '../../icons/Icons'
import { getProjectColor } from './taskLogic'
import { useAutoGrowTextarea } from './useAutoGrowTextarea'
import { useDragReorder } from './useDragReorder'
import TaskSection from './TaskSection'

// Mirrors TasksQuickAdd (see InboxPage.jsx/GtdBoardPage.jsx) — rendered as a
// sibling of .tasks-column__list, pinned to the column's bottom edge, rather
// than inside ProjectsTab's own scrollable list where it used to end up
// right under the last project (or the empty-state hint) instead of at a
// fixed spot.
export function ProjectsQuickAdd({ onAdd }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const newProjectRef = useAutoGrowTextarea(name)

  const submit = () => {
    if (!name.trim()) return
    // No color picker in this row (matches the TASKS/INSIGHTS quick-add
    // rows' single-line-input-and-go pattern) — addProject already falls
    // back to cycling the shared palette when none is given.
    onAdd(name)
    setName('')
  }

  return (
    <div className="tasks-column__quick-add tasks-column__quick-add--bottom">
      <textarea
        ref={newProjectRef}
        className="tasks-column__quick-add-input"
        placeholder={t('tasks.newProjectPlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
        }}
        rows={1}
        maxLength={48}
      />
      <button type="button" className="tasks-column__quick-add-btn" onClick={submit}>
        +
      </button>
    </div>
  )
}

export default function ProjectsTab({
  projects,
  tasks,
  onRenameProject,
  onDeleteProject,
  onReorderProjects,
  onReorderTasks,
  onToggleDone,
  onDelete,
  onUpdate,
  onProcess,
  onAddTask,
  onCrossDropTask,
  onCrossDropNewProjectTask,
  onCrossDropSectionTask,
  editingTaskId,
  editingTaskNode,
}) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [menuOpensUp, setMenuOpensUp] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)
  const menuRef = useRef(null)

  const projectIds = projects.map((p) => p.id)
  // Grab-anywhere-on-the-header reordering (see TaskSection's
  // onHeaderPointerDown) — always called per Rules of Hooks, just unused
  // when the caller doesn't pass onReorderProjects.
  const { displayOrder: projectOrder, draggingId: draggingProjectId, bindHandle: bindProjectHandle } =
    useDragReorder(projectIds, onReorderProjects || (() => {}))
  const orderedProjects = onReorderProjects
    ? projectOrder.map((id) => projects.find((p) => p.id === id)).filter(Boolean)
    : projects

  useEffect(() => {
    if (!menuOpenId) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpenId(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpenId])

  const startEditing = (project) => {
    setEditingId(project.id)
    setEditName(project.name)
  }

  const saveEditing = () => {
    if (editName.trim()) onRenameProject(editingId, editName)
    setEditingId(null)
  }

  return (
    <div className="tasks-projects">
      {projects.length === 0 && (
        <p className="settings-hint">{t('tasks.noProjectsHint')}</p>
      )}

      {orderedProjects.map((project) => {
        // A project's tasks stay listed here always, regardless of
        // whenDate/status — per user request they should be duplicated
        // into wherever else they naturally show up (Tasks/Upcoming once
        // scheduled), not moved out of the project. Same task record
        // either way, so toggling done anywhere (here or in Tasks/Upcoming)
        // marks the one underlying object done, struck through in both
        // places at once. Only trashed tasks actually drop out.
        const projectTasks = tasks.filter((task) => (
          task.projectId === project.id && task.status !== 'trashed'
        ))
        const isEditing = editingId === project.id
        const isConfirming = confirmingId === project.id
        const { ref: projectRef, onPointerDown: projectPointerDown } = onReorderProjects
          ? bindProjectHandle(project.id)
          : { ref: undefined, onPointerDown: undefined }

        return (
          <TaskSection
            key={project.id}
            ref={projectRef}
            onHeaderPointerDown={projectPointerDown}
            isReordering={draggingProjectId === project.id}
            sectionKey={`tasks.project.${project.id}`}
            title={
              isEditing ? (
                <span className="tasks-projects__title" onClick={(e) => e.stopPropagation()}>
                  <span className="tasks-projects__dot" style={{ '--dot-color': getProjectColor(project) }} />
                  <input
                    type="text"
                    className="focus-create__input project-row__edit-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') saveEditing()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    maxLength={48}
                    autoFocus
                  />
                </span>
              ) : (
                <span className="tasks-projects__title">
                  <span className="tasks-projects__dot" style={{ '--dot-color': getProjectColor(project) }} />
                  {project.name} <span className="task-section__count">{projectTasks.length || ''}</span>
                </span>
              )
            }
            tasks={projectTasks}
            numbered
            showDeadlineBadge
            badgeCount={0}
            projectsById={{}}
            emptyLabel={t('tasks.noTasksInProject')}
            headerActions={
              isEditing ? (
                <span className="project-row__confirm" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={saveEditing}>{t('tasks.saveButton')}</button>
                </span>
              ) : isConfirming ? (
                <span className="project-row__confirm" onClick={(e) => e.stopPropagation()}>
                  <span>{t('tasks.confirmDeleteProject')}</span>
                  <button
                    type="button"
                    onClick={() => { onDeleteProject(project.id); setConfirmingId(null) }}
                  >
                    {t('tasks.yes')}
                  </button>
                  <button type="button" onClick={() => setConfirmingId(null)}>{t('tasks.no')}</button>
                </span>
              ) : (
                <span
                  className="project-row__menu"
                  ref={menuOpenId === project.id ? menuRef : null}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="project-row__menu-btn"
                    onClick={(e) => {
                      // Opens upward when there isn't room below (last rows
                      // in a scrolled list) — otherwise the dropdown ran off
                      // the bottom of the window per user report.
                      if (menuOpenId !== project.id) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setMenuOpensUp(window.innerHeight - rect.bottom < 220)
                      }
                      setMenuOpenId(menuOpenId === project.id ? null : project.id)
                    }}
                    aria-label={t('tasks.projectActions')}
                    aria-expanded={menuOpenId === project.id}
                  >
                    <IconMoreVertical size={16} />
                  </button>
                  {menuOpenId === project.id && (
                    <div className={'project-row__menu-dropdown' + (menuOpensUp ? ' project-row__menu-dropdown--up' : '')}>
                      <button type="button" onClick={() => { startEditing(project); setMenuOpenId(null) }}>
                        <IconPencil size={14} /> {t('tasks.renameProject')}
                      </button>
                      <button
                        type="button"
                        className="project-row__menu-danger"
                        onClick={() => { setConfirmingId(project.id); setMenuOpenId(null) }}
                      >
                        × {t('tasks.deleteProject')}
                      </button>
                    </div>
                  )}
                </span>
              )
            }
            onToggleDone={onToggleDone}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onProcess={onProcess}
            onQuickAdd={onAddTask ? (title) => onAddTask(project.id, title) : undefined}
            onReorderTasks={onReorderTasks}
            onCrossDropTask={onCrossDropTask}
            onCrossDropNewProjectTask={onCrossDropNewProjectTask}
            onCrossDropSectionTask={onCrossDropSectionTask}
            editingTaskId={editingTaskId}
            editingTaskNode={editingTaskNode}
          />
        )
      })}
    </div>
  )
}
