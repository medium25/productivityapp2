import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/useTasksStore'
import { useDragReorder } from '../features/tasks/useDragReorder'
import { IconBack } from '../icons/Icons'
import { addDays, formatDateBadge, todayISO } from '../features/tasks/taskLogic'

// Split screen (per user request): left — the project's task titles;
// right — a Miro-style dotted canvas of drop slots joined by down arrows.
// Dragging a task into a slot builds the project's "completion map"; a new
// empty slot always trails the last placed task.
//
// The drag hook re-renders its host on every pointermove, so it lives in
// FlowTaskList (left) alone and the canvas is memoized — otherwise the whole
// page re-rendered per mouse move and dragging lagged.

function FlowTaskList({ tasks, flowIds, onPlace, projectId }) {
  const { t } = useTranslation()
  const reorderTasks = useTasksStore((s) => s.reorderTasks)
  const addTask = useTasksStore((s) => s.addTask)
  const updateTask = useTasksStore((s) => s.updateTask)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const startEdit = (task) => { setEditValue(task.title); setEditingId(task.id) }
  const saveEdit = () => {
    const title = editValue.trim()
    if (title && editingId) updateTask(editingId, { title })
    setEditingId(null)
  }
  const taskById = useMemo(() => new Map(tasks.map((tk) => [tk.id, tk])), [tasks])
  const ids = useMemo(() => tasks.map((tk) => tk.id), [tasks])

  const { displayOrder, bindHandle, draggingId, dragGhost } = useDragReorder(
    ids, reorderTasks, { onCrossDrop: onPlace }
  )
  const orderedTasks = displayOrder.map((id) => taskById.get(id)).filter(Boolean)

  const submitTask = () => {
    const title = newTitle.trim()
    if (!title) return
    addTask({ title, projectId, stage: 'tasks' })
    setNewTitle('')
  }

  return (
    <>
      <div className="project-flow__tasks">
        {tasks.length === 0 && <p className="tasks-cards__empty">{t('projectsPage.noTasks')}</p>}
        {orderedTasks.map((task, i) => (
          <div
            key={task.id}
            className={'project-flow__task' + (flowIds.has(task.id) ? ' project-flow__task--placed' : '') + (draggingId === task.id ? ' task-card-reorder--dragging' : '')}
            {...bindHandle(task.id, task.title)}
            // Double-click edits the task's text in place (per user request).
            onDoubleClick={() => startEdit(task)}
          >
            <span className="project-flow__task-num">{i + 1}.</span>
            {editingId === task.id ? (
              <textarea
                className="project-flow__task-edit"
                value={editValue}
                autoFocus
                rows={1}
                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }}
                onChange={(e) => setEditValue(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
                  if (e.key === 'Escape') setEditingId(null)
                }}
              />
            ) : (
              <span className={task.status === 'done' ? 'project-flow__task-done' : undefined}>{task.title}</span>
            )}
          </div>
        ))}
      </div>
      <div className="project-flow__composer">
        <input
          type="text"
          className="project-flow__composer-input"
          placeholder={t('projectsPage.addTaskPlaceholder')}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitTask() } }}
        />
      </div>
      {dragGhost}
    </>
  )
}

// Menu that opens right after a task lands on the map without a deadline
// (per user request — the system must ask for one). Closing it leaves the
// step pending: the "нужен срок" badge stays and completion stays blocked.
function DeadlineMenu({ onPick, onClose }) {
  const { t } = useTranslation()
  const ref = useRef(null)
  const [picking, setPicking] = useState(false)
  const today = todayISO()

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])

  return (
    <div className="project-flow__deadline-menu" ref={ref}>
      <button type="button" onClick={() => onPick(today)}>{t('tasks.today')}</button>
      <button type="button" onClick={() => onPick(addDays(today, 1))}>{t('tasks.tomorrow')}</button>
      <button type="button" onClick={() => onPick(addDays(today, 7))}>{t('projectsPage.nextWeek')}</button>
      <hr />
      {picking ? (
        <input
          type="date"
          className="project-flow__deadline-date"
          min={today}
          autoFocus
          onChange={(e) => { if (e.target.value) onPick(e.target.value) }}
        />
      ) : (
        <button type="button" onClick={() => setPicking(true)}>{t('projectsPage.pickDate')}</button>
      )}
    </div>
  )
}

const FlowCanvas = memo(function FlowCanvas({ name, flow, taskById, menuTaskId, onToggle, onRemove, onOpenMenu, onCloseMenu, onSetDeadline }) {
  const { t, i18n } = useTranslation()
  return (
    <div className="project-flow__canvas" aria-label={t('projectsPage.mapTitle')}>
      <h2 className="project-flow__canvas-title">{name}</h2>
      <div className="project-flow__map">
        <div className="project-flow__rail">
          {[...flow, null].map((taskId, i) => {
            const task = taskId ? taskById.get(taskId) : null
            const done = task?.status === 'done'
            const deadline = task ? (task.deadline || task.whenDate) : null
            const pending = !!task && !deadline && !done
            return (
              <div key={taskId || 'empty'} className={'project-flow__step' + (done ? ' project-flow__step--done' : '') + (pending ? ' project-flow__step--pending' : '') + (task ? '' : ' project-flow__step--empty')}>
                <div className="project-flow__row">
                {task ? (
                  <button
                    type="button"
                    className="project-flow__dot"
                    onClick={() => (pending ? onOpenMenu(task.id) : onToggle(task.id))}
                    aria-label={t('tasks.toggleDone')}
                  >
                    {done ? '✓' : pending ? '!' : ''}
                  </button>
                ) : (
                  <span className="project-flow__dot" aria-hidden="true" />
                )}
                <div
                  className={'project-flow__slot' + (task ? ' project-flow__slot--filled' : '')}
                  data-drop-project-id={`slot-${i}`}
                >
                  {task ? (
                    <>
                      <span className="project-flow__slot-main">
                        <span className={'project-flow__slot-title' + (done ? ' project-flow__task-done' : '')}>{task.title}</span>
                        {pending && (
                          <button type="button" className="project-flow__badge" onClick={() => onOpenMenu(task.id)}>
                            ⏱ {t('projectsPage.needDeadline')}
                          </button>
                        )}
                        {deadline && <span className="project-flow__slot-date">{formatDateBadge(deadline, t, i18n.language)}</span>}
                      </span>
                      <button
                        type="button"
                        className="project-flow__slot-remove"
                        onClick={() => onRemove(task.id)}
                        aria-label={t('projectsPage.removeFromMap')}
                        title={t('projectsPage.removeFromMap')}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <span className="project-flow__slot-hint">{t('projectsPage.dropHere')}</span>
                  )}
                </div>
                </div>
                {task && menuTaskId === task.id && (
                  <DeadlineMenu onPick={(iso) => onSetDeadline(task.id, iso)} onClose={onCloseMenu} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

export default function ProjectFlowPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { projectId } = useParams()
  const project = useTasksStore((s) => s.projects.find((p) => p.id === projectId))
  const allTasks = useTasksStore((s) => s.tasks)
  const setProjectFlow = useTasksStore((s) => s.setProjectFlow)
  const toggleTaskDone = useTasksStore((s) => s.toggleTaskDone)
  const updateTask = useTasksStore((s) => s.updateTask)
  const [menuTaskId, setMenuTaskId] = useState(null)

  const tasks = useMemo(
    () => allTasks.filter((tk) => tk.projectId === projectId && tk.status !== 'trashed'),
    [allTasks, projectId]
  )
  const taskById = useMemo(() => new Map(tasks.map((tk) => [tk.id, tk])), [tasks])
  const flow = useMemo(() => (project?.flow || []).filter((id) => taskById.has(id)), [project, taskById])
  const flowIds = useMemo(() => new Set(flow), [flow])

  const placeTask = (taskId, slotId) => {
    const index = Number(String(slotId).replace('slot-', ''))
    const without = flow.filter((id) => id !== taskId)
    const at = Math.min(Number.isFinite(index) ? index : without.length, without.length)
    setProjectFlow(projectId, [...without.slice(0, at), taskId, ...without.slice(at)])
    // Dropping a task onto the map schedules it for Today automatically (per
    // user request); a task that was already on the map just moves along it and
    // keeps whatever deadline it has (the badge still opens the date menu).
    const dropped = taskById.get(taskId)
    if (dropped && dropped.status === 'active' && !flowIds.has(taskId)) {
      updateTask(taskId, { whenDate: todayISO(), deadline: null })
    }
  }
  const openMenu = useCallback((id) => setMenuTaskId(id), [])
  const closeMenu = useCallback(() => setMenuTaskId(null), [])
  const setDeadline = useCallback((id, iso) => { updateTask(id, { whenDate: iso }); setMenuTaskId(null) }, [updateTask])
  // Off the map = unscheduled again: the deadline goes with it.
  const removeFromMap = useCallback(
    (taskId) => {
      setProjectFlow(projectId, flow.filter((id) => id !== taskId))
      updateTask(taskId, { whenDate: null, deadline: null })
    },
    [setProjectFlow, updateTask, projectId, flow]
  )

  if (!project) {
    return (
      <div className="projects-page">
        <button type="button" className="project-flow__back" onClick={() => navigate('/projects')}>
          <IconBack size={16} /> {t('projectsPage.back')}
        </button>
      </div>
    )
  }

  const doneCount = tasks.filter((tk) => tk.status === 'done').length

  return (
    <div className="project-flow">
      <div className="project-flow__list">
        <div className="project-flow__head">
          <button type="button" className="project-flow__chip" onClick={() => navigate('/projects')}>
            <IconBack size={14} /> {t('projectsPage.back')}
          </button>
          <div className="project-flow__big">
            <b>{doneCount}/{tasks.length}</b>
            <span>{t('projectsPage.doneLabel')}</span>
          </div>
          <div className="project-flow__bar">
            <i style={{ width: tasks.length ? `${(doneCount / tasks.length) * 100}%` : 0 }} />
          </div>
        </div>
        <FlowTaskList tasks={tasks} flowIds={flowIds} onPlace={placeTask} projectId={projectId} />
      </div>
      <FlowCanvas
        name={project.name}
        flow={flow}
        taskById={taskById}
        menuTaskId={menuTaskId}
        onToggle={toggleTaskDone}
        onRemove={removeFromMap}
        onOpenMenu={openMenu}
        onCloseMenu={closeMenu}
        onSetDeadline={setDeadline}
      />
    </div>
  )
}
