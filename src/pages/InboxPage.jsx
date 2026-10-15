import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/useTasksStore'
import TaskCard from '../features/tasks/TaskCard'
import TaskFormModal from '../features/tasks/TaskFormModal'
import { getTaskStage } from '../features/tasks/taskLogic'
import { useDragReorder } from '../features/tasks/useDragReorder'
import { useSectionDropDateGate } from '../features/tasks/useSectionDropDateGate'
import { useAutoGrowTextarea } from '../features/tasks/useAutoGrowTextarea'
import DueRequiredPrompt from '../features/tasks/DueRequiredPrompt'
import EmptyStateCelebration from '../features/tasks/EmptyStateCelebration'

// Same bottom quick-add pattern as Projects/Insights (per user request —
// "одна логика во всех отделах" instead of Inbox's own top "+ Add" button
// opening the full detailed form). Title-only: Inbox is a capture bucket,
// everything else (project/date/recurrence) still gets refined later via a
// card's own edit form.
function InboxQuickAdd({ onAdd }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const textareaRef = useAutoGrowTextarea(title)

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setTitle('')
  }

  return (
    <div className="tasks-column__quick-add tasks-column__quick-add--bottom">
      <textarea
        ref={textareaRef}
        className="tasks-column__quick-add-input"
        placeholder={t('tasks.gtd.inboxQuickAddPlaceholder')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        rows={1}
      />
      <button type="button" className="tasks-column__quick-add-btn" onClick={submit}>
        +
      </button>
    </div>
  )
}

// Projects and Insights used to share this page as extra columns — both
// moved out into their own top-level sections (ProjectsPage.jsx/
// InsightsPage.jsx) per user request, so Inbox is just the flat Tasks list
// now, full width like the other single-column pages.
export default function InboxPage() {
  const { t } = useTranslation()
  const tasks = useTasksStore((s) => s.tasks)
  const projects = useTasksStore((s) => s.projects)
  const addTask = useTasksStore((s) => s.addTask)
  const updateTask = useTasksStore((s) => s.updateTask)
  const deleteTask = useTasksStore((s) => s.deleteTask)
  const toggleTaskDone = useTasksStore((s) => s.toggleTaskDone)
  const addProject = useTasksStore((s) => s.addProject)
  const permanentlyDeleteTask = useTasksStore((s) => s.permanentlyDeleteTask)
  const reorderTasks = useTasksStore((s) => s.reorderTasks)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)

  // Dropped on the "Projects" section link itself (not one specific
  // project) — per user request the task turns into a brand new project,
  // named after it, rather than becoming a task inside an existing one.
  // The task record itself is gone afterward (not trashed — it isn't being
  // discarded, it now exists as a project instead).
  const convertTaskToProject = (taskId) => {
    const task = tasks.find((t2) => t2.id === taskId)
    if (!task) return
    addProject(task.title)
    permanentlyDeleteTask(taskId)
  }

  // TASKS is a flat one-step-task list, no date sub-grouping — per user
  // request this column isn't a scheduling view (that's what Tasks/Wishes
  // are for), just a place to capture and triage freshly captured items
  // before they're moved somewhere. Only undated stage:'inbox' tasks show
  // here (the default for a plain Inbox add — see taskLogic.js's
  // STATE_OPTIONS). The moment a task is explicitly filed into Tasks/
  // Wishes/Projects (stage:'tasks', or a projectId) it's gone from here —
  // per user request a task can only physically live in one section at a
  // time, so it must not linger in Inbox too just because it once passed
  // through it. Recurring tasks are excluded for the same reason — a
  // habit's home is whichever of Tasks/Wishes its date puts it in.
  //
  // (Project tasks duplicating into a second list turned out to mean the
  // Upcoming/"Tasks" page, not here — see ProjectsTab.jsx's projectTasks
  // filter instead.)
  const activeTasks = useMemo(
    () => tasks.filter((t2) => {
      if (t2.status !== 'active' || t2.projectId || (t2.recurrence && t2.recurrence !== 'none')) return false
      return getTaskStage(t2) === 'inbox'
    }),
    [tasks]
  )
  const activeTaskIds = activeTasks.map((t2) => t2.id)
  // Dropping a task onto a project row in the sidebar (see Sidebar.jsx,
  // useDragReorder.js's onCrossDrop) assigns it to that project — same as
  // picking one in TaskFormModal, just by dragging instead. Dropping on
  // "Projects" itself instead turns the task into a new project (see
  // convertTaskToProject above). Dropping on Inbox/Next/Upcoming/Sometime's
  // own sidebar link moves the task into that section (per user request,
  // any task should be draggable into any section from anywhere).
  // Dropping an undated task onto Tasks no longer silently defaults its
  // date to tomorrow (per user request) — see useSectionDropDateGate.js.
  const { handleDropSection, handleDropProject, pendingTask, confirmPendingDate, cancelPending } =
    useSectionDropDateGate(tasks, updateTask)
  const { displayOrder: taskOrder, draggingId: draggingTaskId, bindHandle: bindTaskHandle, dragGhost } =
    useDragReorder(activeTaskIds, reorderTasks, {
      onCrossDrop: handleDropProject,
      onCrossDropNewProject: convertTaskToProject,
      onCrossDropSection: handleDropSection,
    })
  const orderedActiveTasks = taskOrder.map((id) => activeTasks.find((t2) => t2.id === id)).filter(Boolean)

  // Opens the full edit form for a task — clicking its title, or the "⋮"
  // menu's Edit item. Clicking the same task again while its form is
  // already open closes it instead of just re-opening the same form (per
  // user request — a second tap is a toggle, not a no-op).
  const openWizard = (task) => {
    if (modalOpen && editingTask?.id === task.id) { setModalOpen(false); return }
    setEditingTask(task)
    setModalOpen(true)
  }
  const closeModal = () => setModalOpen(false)

  const handleSave = (fields) => {
    updateTask(editingTask.id, fields)
    setModalOpen(false)
  }

  const cardHandlers = {
    onToggleDone: toggleTaskDone,
    onDelete: deleteTask,
    onUpdate: updateTask,
  }

  return (
    <div className="tasks-page tasks-page--edge-to-edge">
      <div className="tasks-board tasks-board--fill">
        <div className="tasks-column tasks-column--tasks">
          <div className="tasks-column__list">
            {activeTasks.length === 0 ? (
              <EmptyStateCelebration message={t('tasks.emptyGeneric')} />
            ) : (
              orderedActiveTasks.map((task) => (
                <div
                  key={task.id}
                  {...bindTaskHandle(task.id, task.title)}
                  className={draggingTaskId === task.id ? 'task-card-reorder--dragging' : undefined}
                >
                  <TaskCard
                    task={task}
                    project={null}
                    onProcess={openWizard}
                    {...cardHandlers}
                  />
                  {modalOpen && editingTask?.id === task.id && (
                    <TaskFormModal
                      inline
                      task={editingTask}
                      projects={projects}
                      onSave={handleSave}
                      onClose={closeModal}
                      onCreateProject={addProject}
                    />
                  )}
                </div>
              ))
            )}
          </div>
          {/* Bottom quick-add — same position/logic as Projects/Insights
              (per user request, "одна логика во всех отделах") instead of
              the old top "+ Add" button opening the full form. */}
          <InboxQuickAdd onAdd={(title) => addTask({ title })} />
        </div>
      </div>
      <DueRequiredPrompt task={pendingTask} onConfirm={confirmPendingDate} onCancel={cancelPending} />
      {dragGhost}
    </div>
  )
}
