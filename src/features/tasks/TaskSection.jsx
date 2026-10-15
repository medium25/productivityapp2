import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconChevronDown } from '../../icons/Icons'
import { useUiPreferencesStore } from '../../store/useUiPreferencesStore'
import TaskCard from './TaskCard'
import { useDragReorder } from './useDragReorder'

// Title-only quick-add rendered at the bottom of a section's task list when
// the caller passes `onQuickAdd` (currently just ProjectsTab, one per
// project) — same shape as the other per-column quick-adds in the app, just
// scoped to a single section instead of a whole board column.
function SectionQuickAdd({ onAdd }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  const submit = () => {
    const title = value.trim()
    if (!title) return
    onAdd(title)
    setValue('')
  }

  return (
    <div className="tasks-column__quick-add tasks-column__quick-add--section" onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        className="tasks-column__quick-add-input"
        placeholder={t('tasks.gtd.inboxQuickAddPlaceholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') submit() }}
        onClick={(e) => e.stopPropagation()}
      />
      <button type="button" className="tasks-column__quick-add-btn" onClick={submit}>
        +
      </button>
    </div>
  )
}

const TaskSection = forwardRef(function TaskSection({
  sectionKey,
  title,
  tasks,
  projectsById,
  emptyLabel,
  collapsible = true,
  defaultCollapsed = false,
  variant,
  // 'urgent' (red outline) for sections that need attention now (Сегодня,
  // Неразобранные), 'info' (green outline) for the rest — per user request,
  // shown as a notification-style badge in the section's top-right corner,
  // only while it actually has cards in it.
  badgeTone = 'info',
  // Defaults to tasks.length, but Сегодня renders already-completed tasks
  // alongside active ones (crossed out) — the badge should only count what
  // still needs doing, so that section passes this explicitly.
  badgeCount,
  // Optional extra controls (e.g. a project's rename/delete "⋮" menu)
  // rendered next to the chevron. The header can't be a native <button>
  // once it needs to host another interactive element inside it (invalid
  // HTML, and the inner click would also toggle collapse) — it's a div
  // with button semantics instead; headerActions' own click handlers must
  // call stopPropagation() so they don't also toggle the section.
  headerActions,
  // Drag-and-drop between sections (see GtdBoardPage, the coordinator) —
  // all optional so ProjectsTab's reuse of this component is unaffected.
  onCardPointerDown,
  draggingTaskId,
  isDropTarget,
  onToggleDone,
  onDelete,
  onUpdate,
  onProcess,
  // Renders a title-only quick-add row at the bottom of this section's task
  // list when provided (see ProjectsTab, one per project).
  onQuickAdd,
  // Drag-to-reorder within this section's own task list (see ProjectsTab,
  // useDragReorder.js) — grab anywhere on the card. Separate from
  // onCardPointerDown's cross-column drag (GtdBoardPage); a given caller
  // only ever passes one of the two.
  onReorderTasks,
  // Dropping a task from this section onto a project row in the sidebar
  // reassigns it to that project; dropping on "Projects" itself turns it
  // into a new one (see useDragReorder.js's onCrossDrop/
  // onCrossDropNewProject) — lets a project's own page
  // (ProjectDetailPage.jsx, via ProjectsTab) move a task to a *different*
  // project, or spin it out into one, the same way any other list can.
  onCrossDropTask,
  onCrossDropNewProjectTask,
  onCrossDropSectionTask,
  // Whole-project drag-to-reorder (see ProjectsTab) — attached to just the
  // header, not the whole section, so it doesn't fight with the task-card
  // reordering happening inside the section's own body.
  onHeaderPointerDown,
  isReordering,
  // The task currently being edited (see ProjectsTab/ProjectDetailPage) and
  // its inline <TaskFormModal inline .../> node — rendered right under that
  // task's own card instead of a centered overlay, per user request.
  editingTaskId,
  editingTaskNode,
  // Numbers each row 1, 2, 3... in this section's own order (see
  // ProjectsTab, per user request for numbered project tasks) — separate
  // from ActionColumnBoard's own per-date-group numbering, since a
  // project's task list isn't grouped by date at all.
  numbered = false,
  // End-of-row deadline badge (see ProjectsTab, per user request) —
  // distinct from showDateBadge above, which is whenDate (the scheduled
  // day), not deadline (the due-by day); a project task can have either,
  // both, or neither.
  showDeadlineBadge = false,
}, ref) {
  const count = badgeCount === undefined ? tasks.length : badgeCount
  const taskIds = tasks.map((t) => t.id)
  // Always called (Rules of Hooks) — its bindHandle just goes unused below
  // when the caller doesn't opt in.
  const { displayOrder, draggingId: reorderingId, bindHandle, dragGhost } =
    useDragReorder(taskIds, onReorderTasks || (() => {}), {
      onCrossDrop: onCrossDropTask,
      onCrossDropNewProject: onCrossDropNewProjectTask,
      onCrossDropSection: onCrossDropSectionTask,
    })
  const orderedTasks = onReorderTasks
    ? displayOrder.map((id) => tasks.find((t) => t.id === id)).filter(Boolean)
    : tasks
  // Remembered across reloads (see useUiPreferencesStore.js) — keyed so each
  // section (Неразобранные/Завтра/На этой неделе/В будущем) keeps its own
  // open/collapsed state independently.
  const collapsed = useUiPreferencesStore((s) => collapsible && s.isCollapsed(sectionKey, defaultCollapsed))
  const toggleCollapsed = useUiPreferencesStore((s) => s.toggleCollapsed)

  return (
    <section
      ref={ref}
      className={
        'task-section'
        + (variant ? ` task-section--${variant}` : '')
        + (isDropTarget ? ' task-section--drop-target' : '')
        + (isReordering ? ' task-section--reordering' : '')
      }
    >
      {count > 0 && (
        <span className={`task-section__badge task-section__badge--${badgeTone}`}>{count}</span>
      )}
      <div
        className={'task-section__header' + (collapsible ? '' : ' task-section__header--static')}
        onClick={collapsible ? () => toggleCollapsed(sectionKey, defaultCollapsed) : undefined}
        onPointerDown={onHeaderPointerDown}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={collapsible ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapsed(sectionKey, defaultCollapsed) } } : undefined}
      >
        <span>{title}</span>
        <span className="task-section__header-right">
          {headerActions}
          {collapsible && (
            <IconChevronDown size={16} className={'task-section__chevron' + (collapsed ? '' : ' open')} />
          )}
        </span>
      </div>

      {!collapsed && (
        <div className="task-section__body">
          {tasks.length === 0 ? (
            <p className="task-section__empty">{emptyLabel}</p>
          ) : (
            orderedTasks.map((task, index) => (
              <div
                key={task.id}
                {...(onReorderTasks ? bindHandle(task.id, task.title) : null)}
                className={onReorderTasks && reorderingId === task.id ? 'task-card-reorder--dragging' : undefined}
              >
                <TaskCard
                  task={task}
                  number={numbered ? index + 1 : undefined}
                  project={task.projectId ? projectsById[task.projectId] : null}
                  onToggleDone={onToggleDone}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  onCardPointerDown={onCardPointerDown}
                  isDragging={draggingTaskId === task.id}
                  onProcess={onProcess}
                  showDeadlineBadge={showDeadlineBadge}
                />
                {editingTaskId === task.id && editingTaskNode}
              </div>
            ))
          )}
          {onQuickAdd && <SectionQuickAdd onAdd={onQuickAdd} />}
        </div>
      )}
      {dragGhost}
    </section>
  )
})

export default TaskSection
