import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/useTasksStore'
import TaskSection from '../features/tasks/TaskSection'
import TaskCard from '../features/tasks/TaskCard'
import TaskFormModal from '../features/tasks/TaskFormModal'
import GtdWizardModal from '../features/tasks/GtdWizardModal'
import ProjectsTab, { ProjectsQuickAdd } from '../features/tasks/ProjectsTab'
import { classifyTask, getTaskStage, whenDateForSection } from '../features/tasks/taskLogic'
import { useSectionDropDateGate } from '../features/tasks/useSectionDropDateGate'
import DueRequiredPrompt from '../features/tasks/DueRequiredPrompt'

// External cross-drop targets (see Sidebar.jsx, useDragReorder.js) — this
// page's own drag system predates and works differently from
// useDragReorder's (rects captured once at drag-start vs. a live
// elementFromPoint check), but per user request a task should be
// draggable into any section from anywhere, this custom board included, so
// it falls back to the same three sidebar drop kinds this page's own 5
// columns don't match.
const EXTERNAL_DROP_SELECTOR = '[data-drop-project-id], [data-drop-new-project], [data-drop-section]'
const EXTERNAL_DROP_HOVER_CLASS = 'sidebar__link--drop-hover'

// The original 4-column GTD board (Inbox/Later/Tasks/Projects + wizard) —
// kept alive here for "+ Add section" duplicates (see Sidebar.jsx) after
// the built-in "Action" section was split into its own My day/Upcoming/
// Sometime sections (see ActionColumnBoard.jsx), For Anki dropped entirely.
// Untriaged Inbox/Later tasks are only manageable through a page like this
// one now.

// Pixels of pointer movement before a card pointerdown counts as a drag
// rather than a tap — below this it's still a normal click (checkbox,
// title, etc.), same threshold idea as a native OS drag.
const DRAG_THRESHOLD_PX = 8

// Fast single-line capture for the Inbox column — no project/priority/date,
// those all come later via the GTD wizard. Kept local since nothing else
// needs a bare title-only add form.
function InboxQuickAdd({ onAdd }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  const submit = () => {
    const title = value.trim()
    if (!title) return
    onAdd(title)
    setValue('')
  }

  return (
    <div className="tasks-column__quick-add">
      <input
        type="text"
        className="tasks-column__quick-add-input"
        placeholder={t('tasks.gtd.inboxQuickAddPlaceholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
      />
      <button type="button" className="tasks-column__quick-add-btn" onClick={submit}>
        +
      </button>
    </div>
  )
}

export default function GtdBoardPage() {
  const { t } = useTranslation()
  const tasks = useTasksStore((s) => s.tasks)
  const projects = useTasksStore((s) => s.projects)
  const addTask = useTasksStore((s) => s.addTask)
  const updateTask = useTasksStore((s) => s.updateTask)
  const deleteTask = useTasksStore((s) => s.deleteTask)
  const toggleTaskDone = useTasksStore((s) => s.toggleTaskDone)
  const addProject = useTasksStore((s) => s.addProject)
  const renameProject = useTasksStore((s) => s.renameProject)
  const deleteProject = useTasksStore((s) => s.deleteProject)
  const permanentlyDeleteTask = useTasksStore((s) => s.permanentlyDeleteTask)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [precreateProjectId, setPrecreateProjectId] = useState(null)
  // The task currently being triaged through the GTD wizard — set either by
  // a card's "Разобрать" button, or by dragging an Inbox card onto any
  // other column (see handlePointerUp: the drop target is discarded, the
  // wizard's answers decide the real destination instead).
  const [wizardTask, setWizardTask] = useState(null)

  // Drag-and-drop across the 4 board columns (and the Tasks column's 3 date
  // sub-sections) — grabbing anywhere on a card, not just a handle, per
  // user request. Columns/sections are siblings rendered by this page, so
  // the coordination (which drop zone is currently under the pointer,
  // committing the move/wizard on drop) lives here.
  const [draggingTaskId, setDraggingTaskId] = useState(null)
  const [dropTargetSection, setDropTargetSection] = useState(null)
  // Dropping an undated task onto Tasks no longer silently defaults its
  // date to tomorrow (per user request) — see useSectionDropDateGate.js.
  const { handleDropSection, handleDropProject, pendingTask, confirmPendingDate, cancelPending } =
    useSectionDropDateGate(tasks, updateTask)
  const dragInfoRef = useRef(null) // { taskId, startX, startY, dragging, lastX, lastY }
  const sectionRefs = useRef({}) // sectionKey -> DOM node ('inbox'|'later'|'today'|'tomorrow'|'week')
  // Drop-zone rects, captured once when a drag actually starts rather than
  // re-read via getBoundingClientRect() on every raw pointermove — that was
  // a layout read × 5 refs on every mouse-move event during a drag.
  const dropRectsRef = useRef(null)
  const dragRafId = useRef(null)
  // Whichever sidebar element (project row / "Projects" link / Inbox-Next-
  // Upcoming-Sometime link) is currently under the pointer during a drag —
  // only relevant once the pointer's left this page's own 5 columns (see
  // EXTERNAL_DROP_SELECTOR above).
  const externalTargetRef = useRef(null)

  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects]
  )

  // A completed project moves to Завершённые (see CompletedPage.jsx/
  // useTasksStore's completeProject) — this column only ever shows the
  // still-active ones.
  const activeProjects = useMemo(() => projects.filter((p) => p.status !== 'done'), [projects])

  const activeTasks = useMemo(() => tasks.filter((t2) => t2.status === 'active'), [tasks])
  const doneToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return tasks.filter((t2) => (
      t2.status === 'done' && t2.completedAt && t2.completedAt.slice(0, 10) === today && !t2.projectId
    ))
  }, [tasks])

  const grouped = useMemo(() => {
    const buckets = { inbox: [], later: [], today: [], tomorrow: [], week: [] }
    activeTasks.forEach((task) => {
      const stage = getTaskStage(task)
      if (stage === 'inbox') buckets.inbox.push(task)
      else if (stage === 'later') buckets.later.push(task)
      // Project-assigned tasks are excluded from the Tasks column's date
      // buckets — they already live under their project in the Projects
      // column, so showing them here too would just be the same task
      // twice on one page.
      else if (!task.projectId) {
        const key = classifyTask(task)
        if (buckets[key]) buckets[key].push(task)
      }
    })
    return buckets
  }, [activeTasks])

  // Reads from the rects captured at drag-start (see captureDropRects), not
  // a live getBoundingClientRect() — those don't change during a drag since
  // the board layout itself doesn't shift while dragging.
  const sectionKeyAtPoint = (x, y) => {
    const rects = dropRectsRef.current
    if (!rects) return null
    for (const [key, rect] of Object.entries(rects)) {
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return key
    }
    return null
  }

  const clearExternalTarget = () => {
    if (externalTargetRef.current) {
      externalTargetRef.current.classList.remove(EXTERNAL_DROP_HOVER_CLASS)
      externalTargetRef.current = null
    }
  }

  const captureDropRects = () => {
    const rects = {}
    for (const [key, el] of Object.entries(sectionRefs.current)) {
      if (el) rects[key] = el.getBoundingClientRect()
    }
    dropRectsRef.current = rects
  }

  const handlePointerMove = (e) => {
    const info = dragInfoRef.current
    if (!info) return
    if (!info.dragging) {
      const dx = e.clientX - info.startX
      const dy = e.clientY - info.startY
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      info.dragging = true
      setDraggingTaskId(info.taskId)
      // Dragging across text/cards shouldn't also select their contents.
      document.body.style.userSelect = 'none'
      captureDropRects()
    }
    // Coalesce to one drop-target lookup per animation frame instead of one
    // per raw pointermove event (mirrors FocusTimerHero.jsx's chip-reorder
    // drag) — mousemove can fire far more often than the screen repaints.
    info.lastX = e.clientX
    info.lastY = e.clientY
    if (dragRafId.current == null) {
      dragRafId.current = requestAnimationFrame(() => {
        dragRafId.current = null
        const latest = dragInfoRef.current
        if (!latest) return
        const internalKey = sectionKeyAtPoint(latest.lastX, latest.lastY)
        setDropTargetSection(internalKey)
        if (internalKey) {
          clearExternalTarget()
        } else {
          const el = document.elementFromPoint(latest.lastX, latest.lastY)?.closest(EXTERNAL_DROP_SELECTOR) || null
          if (el !== externalTargetRef.current) {
            clearExternalTarget()
            if (el) {
              el.classList.add(EXTERNAL_DROP_HOVER_CLASS)
              externalTargetRef.current = el
            }
          }
        }
      })
    }
  }

  const handlePointerUp = (e) => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    document.body.style.userSelect = ''
    if (dragRafId.current != null) {
      cancelAnimationFrame(dragRafId.current)
      dragRafId.current = null
    }
    const info = dragInfoRef.current
    dragInfoRef.current = null
    setDraggingTaskId(null)
    setDropTargetSection(null)
    const externalEl = externalTargetRef.current
    clearExternalTarget()
    if (!info || !info.dragging) { dropRectsRef.current = null; return }

    // A real drag just happened — the browser will still fire a click on
    // whatever's under the pointer right after this (e.g. the title button
    // that would otherwise open the edit panel). Swallow exactly that one.
    window.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault() }, { capture: true, once: true })

    const targetKey = sectionKeyAtPoint(e.clientX, e.clientY)
    dropRectsRef.current = null
    const task = tasks.find((t2) => t2.id === info.taskId)
    if (!task) return

    // Dropped outside this page's own 5 columns — check the sidebar (see
    // Sidebar.jsx/useDragReorder.js's onCrossDrop family; per user request
    // a task should be draggable into any section from anywhere).
    if (!targetKey) {
      if (!externalEl) return
      if (externalEl.hasAttribute('data-drop-new-project')) {
        addProject(task.title)
        permanentlyDeleteTask(task.id)
      } else if (externalEl.hasAttribute('data-drop-section')) {
        handleDropSection(task.id, externalEl.getAttribute('data-drop-section'))
      } else {
        handleDropProject(task.id, externalEl.getAttribute('data-drop-project-id'))
      }
      return
    }

    const sourceStage = getTaskStage(task)
    const sourceBucket = sourceStage === 'tasks' ? classifyTask(task) : sourceStage
    if (sourceBucket === targetKey) return

    // Dragging an Inbox card out — the drop target is only a hint, the GTD
    // wizard's answers decide where it actually lands.
    if (sourceStage === 'inbox' && targetKey !== 'inbox') {
      setWizardTask(task)
      return
    }

    if (targetKey === 'inbox') { updateTask(task.id, { stage: 'inbox' }); return }
    if (targetKey === 'later') { updateTask(task.id, { stage: 'later' }); return }
    const whenDate = whenDateForSection(targetKey)
    updateTask(task.id, { stage: 'tasks', whenDate, deadline: whenDate })
  }

  const handleCardPointerDown = (taskId, e) => {
    dragInfoRef.current = { taskId, startX: e.clientX, startY: e.clientY, dragging: false }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const closeModal = () => { setModalOpen(false); setPrecreateProjectId(null) }

  const handleSave = (fields) => {
    if (editingTask) {
      updateTask(editingTask.id, fields)
      setModalOpen(false)
      setPrecreateProjectId(null)
    } else {
      // TaskFormModal clears/refocuses itself for the next task, so the
      // form stays open — per user request, Enter shouldn't force
      // reopening it for every single task.
      addTask(fields)
    }
  }

  const handleQuickAddToInbox = (title) => addTask({ title })
  const handleAddTaskToProject = (projectId, title) => addTask({ title, projectId, stage: 'tasks' })

  const handleWizardConvertToProject = (taskId, name) => {
    const project = addProject(name)
    if (!project) return
    deleteTask(taskId)
    setEditingTask(null)
    setPrecreateProjectId(project.id)
    setModalOpen(true)
  }

  const cardHandlers = {
    onToggleDone: toggleTaskDone,
    onDelete: deleteTask,
    // Plain editing (rename/deadline/recurrence/estimate) happens inline
    // right on the card now (see TaskCard) — updateTask directly, no modal.
    onUpdate: updateTask,
  }

  const dragHandlers = {
    onCardPointerDown: handleCardPointerDown,
    draggingTaskId,
  }

  return (
    <div className="tasks-page">
      <div className="tasks-board">
        <div
          ref={(el) => { sectionRefs.current.inbox = el }}
          className={'tasks-column tasks-column--inbox' + (dropTargetSection === 'inbox' ? ' tasks-column--drop-target' : '')}
        >
          <div className="tasks-column__header">
            <span>{t('tasks.gtd.columnInbox')}</span>
            {grouped.inbox.length > 0 && <span className="tasks-column__count">{grouped.inbox.length}</span>}
          </div>
          <InboxQuickAdd onAdd={handleQuickAddToInbox} />
          <div className="tasks-column__list">
            {grouped.inbox.length === 0 ? (
              <p className="task-section__empty">{t('tasks.emptyGeneric')}</p>
            ) : (
              grouped.inbox.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  project={task.projectId ? projectsById[task.projectId] : null}
                  onProcess={setWizardTask}
                  {...cardHandlers}
                  {...dragHandlers}
                  isDragging={draggingTaskId === task.id}
                />
              ))
            )}
          </div>
        </div>

        <div
          ref={(el) => { sectionRefs.current.later = el }}
          className={'tasks-column tasks-column--later' + (dropTargetSection === 'later' ? ' tasks-column--drop-target' : '')}
        >
          <div className="tasks-column__header">
            <span>{t('tasks.gtd.columnLater')}</span>
            {grouped.later.length > 0 && <span className="tasks-column__count">{grouped.later.length}</span>}
          </div>
          <div className="tasks-column__list">
            {grouped.later.length === 0 ? (
              <p className="task-section__empty">{t('tasks.emptyGeneric')}</p>
            ) : (
              grouped.later.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  project={task.projectId ? projectsById[task.projectId] : null}
                  onProcess={setWizardTask}
                  {...cardHandlers}
                  {...dragHandlers}
                  isDragging={draggingTaskId === task.id}
                />
              ))
            )}
          </div>
        </div>

        <div className="tasks-column tasks-column--tasks">
          <div className="tasks-column__header">
            <span>{t('tasks.tabTasks')}</span>
          </div>
          <div className="tasks-column__list">
            <TaskSection
              ref={(el) => { sectionRefs.current.today = el }}
              sectionKey="tasks.today"
              title={t('tasks.sectionToday')}
              tasks={[...grouped.today, ...doneToday]}
              badgeCount={grouped.today.length}
              badgeTone="urgent"
              variant="today"
              projectsById={projectsById}
              emptyLabel={t('tasks.emptyToday')}
              isDropTarget={dropTargetSection === 'today'}
              {...cardHandlers}
              {...dragHandlers}
            />
            <TaskSection
              ref={(el) => { sectionRefs.current.tomorrow = el }}
              sectionKey="tasks.tomorrow"
              title={t('tasks.sectionTomorrow')}
              tasks={grouped.tomorrow}
              badgeTone="info"
              projectsById={projectsById}
              emptyLabel={t('tasks.emptyGeneric')}
              defaultCollapsed
              isDropTarget={dropTargetSection === 'tomorrow'}
              {...cardHandlers}
              {...dragHandlers}
            />
            <TaskSection
              ref={(el) => { sectionRefs.current.week = el }}
              sectionKey="tasks.week"
              title={t('tasks.sectionWeek')}
              tasks={grouped.week}
              badgeTone="info"
              projectsById={projectsById}
              emptyLabel={t('tasks.emptyGeneric')}
              defaultCollapsed
              isDropTarget={dropTargetSection === 'week'}
              {...cardHandlers}
              {...dragHandlers}
            />
          </div>
        </div>

        <div className="tasks-column tasks-column--projects">
          <div className="tasks-column__header">
            <span>{t('tasks.tabProjects')}</span>
          </div>
          <div className="tasks-column__list">
            <ProjectsTab
              projects={activeProjects}
              tasks={tasks}
              onRenameProject={renameProject}
              onDeleteProject={deleteProject}
              onAddTask={handleAddTaskToProject}
              onProcess={setWizardTask}
              {...cardHandlers}
            />
          </div>
          <ProjectsQuickAdd onAdd={addProject} />
        </div>
      </div>

      {modalOpen && (
        <TaskFormModal
          task={editingTask}
          projects={projects}
          initialProjectId={precreateProjectId}
          onSave={handleSave}
          onClose={closeModal}
          onCreateProject={addProject}
        />
      )}

      {wizardTask && (
        <GtdWizardModal
          task={wizardTask}
          onClose={() => setWizardTask(null)}
          onMarkDone={toggleTaskDone}
          onMoveToLater={(id) => updateTask(id, { stage: 'later' })}
          onScheduleTask={(id, whenDate, estimateMinutes) => updateTask(id, { stage: 'tasks', whenDate, deadline: whenDate, estimateMinutes })}
          onConvertToProject={handleWizardConvertToProject}
        />
      )}

      <DueRequiredPrompt task={pendingTask} onConfirm={confirmPendingDate} onCancel={cancelPending} />
    </div>
  )
}
