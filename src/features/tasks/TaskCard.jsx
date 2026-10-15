import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconMoreVertical, IconPencil } from '../../icons/Icons'
import { useFocusTimerStore } from '../../store/useFocusTimerStore'
import { formatCountdown } from '../focus/timeFormat'
import { suppressSelectionForPointer } from './suppressSelection'
import {
  formatDateBadge,
  formatEstimateLabel,
  getProjectColor,
  getTagColor,
  isOverdue,
  WEEKDAYS,
} from './taskLogic'

// "каждый день" / "по Пн, Ср" etc. — mirrors the task-manager prototype's
// recurLabel(), just driven by t() instead of hardcoded Russian strings.
function recurrenceBadgeLabel(task, t) {
  if (!task.recurrence || task.recurrence === 'none') return null
  if (task.recurrence === 'custom') {
    const days = (task.recurrenceDays || []).slice().sort()
    const labels = WEEKDAYS.filter((w) => days.includes(w.dow)).map((w) => t(`tasks.weekdayShort.${w.key}`))
    return labels.length ? t('tasks.recurBadgeCustom', { days: labels.join(', ') }) : null
  }
  const key = { daily: 'recurBadgeDaily', weekly: 'recurBadgeWeekly', monthly: 'recurBadgeMonthly' }[task.recurrence]
  return key ? t(`tasks.${key}`) : null
}

export default function TaskCard({
  task,
  // 1-based position in the current list — dropped from every top-level
  // list per earlier user request (read as one more noisy element crowding
  // the row), but back per later user request specifically for a project's
  // own nested task list (see `showNumber`/ActionColumnBoard.jsx's
  // ProjectCard) — "как полноценные задачи", numbered like a real list.
  number,
  // Project's own nested task list only (see ActionColumnBoard.jsx's
  // ProjectCard/renderTaskRow) — everywhere else stays number-free.
  showNumber,
  project,
  onToggleDone,
  onDelete,
  // Plain updateTask(id, patch)-shaped call — still used for non-editing
  // patches (toggling done from the menu, etc). Full editing goes through
  // onProcess below now, not a local textarea.
  onUpdate,
  onCardPointerDown,
  isDragging,
  // Opens the full detailed edit form (see TaskFormModal, rendered inline
  // by the parent list right under this card) — clicking the title, or the
  // "⋮" menu's Edit item, both trigger this now. The old dedicated
  // "Process" button and the lightweight title-only inline editor are both
  // gone per user request; this is the one edit entry point.
  onProcess,
  // Upcoming column only (see ActionColumnBoard.jsx) — shows which day the
  // task is scheduled for right on the row instead of only inside the
  // collapsible details, since the assigned date is the whole point there.
  showDateBadge,
  // Projects column only (see ProjectsTab.jsx, per user request) — shows
  // the deadline (due-by day) inline at the end of the row instead of only
  // inside the collapsible details. Distinct from showDateBadge above,
  // which is whenDate (the scheduled day), not deadline.
  showDeadlineBadge,
  // My day column only (see ActionColumnBoard.jsx) — the time estimate and
  // a Start button sit inline at the end of the same row (per user request,
  // no second line) instead of only inside the collapsible details.
  // Starting puts this task's Focus session running at the top of the
  // column (see isTimerActive below / MyDayTimer).
  showFocusFooter,
  // My day column only — clicking the card loads its estimate into the
  // always-open timer panel above the list (see MyDayTimer/ActionColumnBoard)
  // instead of opening inline text editing, since a bare tap there is meant
  // to preview/queue a task's time rather than rename it (renaming still
  // works via the "⋮" menu).
  onSelectForTimer,
  // Mirrors the running-timer highlight (isTimerActive below) for whichever
  // task is currently loaded into the panel but not necessarily started yet.
  isSelectedForTimer,
  // Upcoming only — this row is a recurring task previewed onto a day that
  // isn't its actual live record's date (see recursOnDate in
  // ActionColumnBoard.jsx). There's only one real completable record behind
  // every preview of the same task, so previews render read-only (dimmed,
  // no checkbox/menu/click) rather than acting as independent instances.
  preview,
  // Upcoming's own "Today" date group only (see ActionColumnBoard.jsx's
  // dateGroups) — per user request, a task actually due today reads as a
  // warm gold-tinted card instead of just living under the "Today" header.
  isToday,
}) {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuOpensUp, setMenuOpensUp] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const menuRef = useRef(null)
  const runningTaskId = useFocusTimerStore((s) => s.projectId)
  const runningSourceType = useFocusTimerStore((s) => s.sourceType)
  const runningRemaining = useFocusTimerStore((s) => s.remaining)
  const runningPhase = useFocusTimerStore((s) => s.phase)
  const done = task.status === 'done'
  const overdue = isOverdue(task)
  const estimateLabel = formatEstimateLabel(task.estimateMinutes)
  const titleLines = task.title.split('\n')
  const hasMoreTitleLines = titleLines.length > 1
  const recurLabel = recurrenceBadgeLabel(task, t)
  const hasDetails = !!(task.description || project || estimateLabel || task.deadline || task.tags?.length > 0 || hasMoreTitleLines || recurLabel)
  const isTimerActive = showFocusFooter && runningSourceType === 'task' && runningTaskId === task.id
  const isHighlighted = isTimerActive || isSelectedForTimer

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const openEditForm = () => {
    setMenuOpen(false)
    onProcess(task)
  }

  const handleToggleDetailsFromMenu = () => {
    setMenuOpen(false)
    setExpanded((v) => !v)
  }

  const handleDeleteFromMenu = () => {
    setMenuOpen(false)
    setConfirmingDelete(true)
  }

  const handleToggleDoneFromMenu = () => {
    setMenuOpen(false)
    onToggleDone(task.id)
  }

  // Drag can start from anywhere on the card (per user request) except the
  // controls that are already a click action in their own right — starting
  // a drag from those would fight with tapping them. onCardPointerDown
  // itself is threshold-based (see GtdBoardPage) so a plain tap/click
  // anywhere else still works normally; only an actual drag beyond the
  // threshold moves the task.
  const handlePointerDown = (e) => {
    if (!onCardPointerDown || done) return
    if (e.target.closest('.project-row__menu, .project-row__confirm, .task-card__checkbox')) return
    suppressSelectionForPointer(e)
    onCardPointerDown(task.id, e)
  }

  return (
    <div
      className={
        'task-card'
        + (done ? ' task-card--done' : '')
        + (isDragging ? ' task-card--dragging' : '')
        + (preview ? ' task-card--preview' : '')
        + (isToday ? ' task-card--today' : '')
      }
      onPointerDown={preview ? undefined : handlePointerDown}
    >
      <div className="task-card__row">
        {showNumber && number != null && <span className="task-card__number">{number}</span>}
        <button
          type="button"
          className={'task-card__checkbox' + (done ? ' task-card__checkbox--checked' : '')}
          onClick={preview ? undefined : () => onToggleDone(task.id)}
          disabled={preview}
          aria-label={done ? t('tasks.markUndone') : t('tasks.toggleDone')}
          title={done ? t('tasks.markUndone') : t('tasks.toggleDone')}
        >
          {done ? '✓' : ''}
        </button>

        {isHighlighted && <span className="task-card__active-dot" aria-hidden="true" />}

        <button
          type="button"
          className="task-card__title"
          disabled={preview}
          onClick={preview ? undefined : (onSelectForTimer ? () => onSelectForTimer(task) : () => onProcess(task))}
        >
          {titleLines[0]}
          {/* Project tasks show up outside their project's own column too
              (My day/Upcoming/Sometime/Inbox) once scheduled — this is the
              only hint left of which project they belong to there, so it's
              worth the extra text even though it's redundant inside the
              Projects column itself (project is always null there, see
              ProjectsTab's empty projectsById). */}
          {project && <span className="task-card__title-project"> ({project.name})</span>}
        </button>

        {recurLabel && (
          <span className="task-card__recur-icon" title={recurLabel} aria-label={recurLabel}>↻</span>
        )}

        {showDateBadge && task.whenDate && (
          <span className={'task-card__badge task-card__badge--date' + (overdue ? ' task-card__badge--deadline-overdue' : '')}>
            {formatDateBadge(task.whenDate, t, i18n.language)}
          </span>
        )}

        {showDeadlineBadge && task.deadline && (
          <span className={'task-card__badge task-card__badge--date' + (overdue ? ' task-card__badge--deadline-overdue' : '')}>
            {overdue ? '⚠ ' : ''}
            {formatDateBadge(task.deadline, t, i18n.language)}
          </span>
        )}

        {showFocusFooter && !done && isTimerActive && runningPhase !== 'idle' && (
          // Live countdown while this task's session is actually running
          // (per user request for the timer to live inside the card itself
          // instead of a shared panel above the list) — the static estimate
          // that used to show here otherwise is gone per user report, one
          // more "25м" on every single row was just noise.
          <span className="task-card__focus-time task-card__focus-time--active">
            {formatCountdown(runningRemaining)}
          </span>
        )}

        {preview ? null : confirmingDelete ? (
          <span className="project-row__confirm">
            <span>{t('tasks.confirmDeleteTask')}</span>
            <button type="button" onClick={() => onDelete(task.id)}>{t('tasks.yes')}</button>
            <button type="button" onClick={() => setConfirmingDelete(false)}>{t('tasks.no')}</button>
          </span>
        ) : (
          <div className="project-row__menu" ref={menuRef}>
            <button
              type="button"
              className="project-row__menu-btn"
              onClick={() => {
                // Opens upward when there isn't room below (last rows in a
                // scrolled list) — otherwise the dropdown ran off the
                // bottom of the window per user report.
                if (!menuOpen && menuRef.current) {
                  const rect = menuRef.current.getBoundingClientRect()
                  setMenuOpensUp(window.innerHeight - rect.bottom < 220)
                }
                setMenuOpen((v) => !v)
              }}
              aria-label={t('tasks.taskActions')}
              aria-expanded={menuOpen}
            >
              <IconMoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className={'project-row__menu-dropdown' + (menuOpensUp ? ' project-row__menu-dropdown--up' : '')}>
                <button type="button" onClick={handleToggleDoneFromMenu}>
                  {done ? t('tasks.markUndone') : t('tasks.toggleDone')}
                </button>
                <button type="button" onClick={openEditForm}>
                  <IconPencil size={14} /> {t('tasks.editTaskTitle')}
                </button>
                {hasDetails && (
                  <button type="button" onClick={handleToggleDetailsFromMenu}>
                    {expanded ? t('tasks.hideDetails') : t('tasks.showDetails')}
                  </button>
                )}
                <button type="button" className="project-row__menu-danger" onClick={handleDeleteFromMenu}>
                  × {t('tasks.deleteTask')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="task-card__details">
          {hasMoreTitleLines && <div className="task-card__full-title">{task.title}</div>}
          {task.description && <div className="task-card__description">{task.description}</div>}
          <div className="task-card__badges">
            {project && (
              <span className="task-card__badge task-card__badge--project">
                <span className="task-card__badge-dot" style={{ '--dot-color': getProjectColor(project) }} />
                {project.name}
              </span>
            )}
            {estimateLabel && !showFocusFooter && <span className="task-card__badge">{estimateLabel}</span>}
            {task.deadline && (
              <span className={'task-card__badge' + (overdue ? ' task-card__badge--deadline-overdue' : '')}>
                {overdue ? '⚠ ' : ''}
                {t('tasks.deadlineBadge', { date: formatDateBadge(task.deadline, t, i18n.language) })}
              </span>
            )}
            {(task.tags || []).map((tag) => (
              <span key={tag} className="task-card__badge task-card__badge--tag" style={{ '--dot-color': getTagColor(tag) }}>
                <span className="task-card__badge-dot" />
                #{tag}
              </span>
            ))}
            {recurLabel && <span className="task-card__badge">↻ {recurLabel}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
