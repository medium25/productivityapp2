import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/useTasksStore'
import { useHabitsStore } from '../store/useHabitsStore'
import { Navigate, useParams } from 'react-router-dom'
import { useUiPreferencesStore } from '../store/useUiPreferencesStore'
import TaskFormModal from '../features/tasks/TaskFormModal'
import DueRequiredPrompt from '../features/tasks/DueRequiredPrompt'
import { useDragReorder } from '../features/tasks/useDragReorder'
import MyDayTimer from '../features/focus/MyDayTimer'
import { isoFromDate, todayISO, WEEKDAYS } from '../features/tasks/taskLogic'
import { ROUTINE_TASKS } from '../features/tasks/dailyRoutineTasks'
import { syncHabitForTask, spawnHabitForTask } from '../features/tasks/habitTaskSync'
import { IconFocus, IconClock } from '../icons/Icons'

// Replaced the old Projects/one-step-tasks 2-column board (per user
// request — "старое содержимое нужно убрать из раздела задач") with the
// 3 date-bucket board from the user's own reference export
// (tasks-section-export.md, section 6/8: Overdue/Today/Tomorrow). Project
// management (create/rename/pin/delete, nested tasks) still lives in full
// on the Data page's Vazifalar panel (see ReferenceInfoPage.jsx) — this
// page is now purely a due-date view across every active task regardless
// of project, plus the activity stats section below it.
const PSEUDO_TIMER_TASK_ID = '__pomodoro__'

// Each task takes its estimate (default 30 min); times flow one after
// another from the day's start with no gap between tasks (per user request —
// the automatic compensation gap was removed).
const DEFAULT_MINUTES = 30
const fmtTime = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// Today's own calendar-day palette (per user request — "каждая задача
// разного цвета") — cycles by row index, a fill+border+text triple per
// task so each block reads distinctly against the hour ruler.
const CALENDAR_PALETTE = [
  { bg: '#e6ebfd', border: '#4c5fd6', text: '#3547b8' },
  { bg: '#e9f7ee', border: '#178a3f', text: '#12692f' },
  { bg: '#fdeee0', border: '#c96a12', text: '#a0560e' },
  { bg: '#fde8ea', border: '#c92a2a', text: '#a12121' },
  { bg: '#f1e8fd', border: '#7c4dff', text: '#5e35c9' },
  { bg: '#fde8f3', border: '#d4537e', text: '#ab3f63' },
  { bg: '#e3f6f6', border: '#0f6e7a', text: '#0b535c' },
  { bg: '#fdf6e0', border: '#c9a812', text: '#9e850e' },
]
// Same hues for the web version's neon skin (styles/neon.css): dark tinted
// fills with bright text instead of pastel fills with dark text.
const NEON_CALENDAR_PALETTE = [
  { bg: '#0f1b33', border: '#3d8bff', text: '#8dbaff' },
  { bg: '#0b2018', border: '#2bff88', text: '#6dffb0' },
  { bg: '#2a1b0b', border: '#ffb84a', text: '#ffcf87' },
  { bg: '#2a0f14', border: '#ff4d5e', text: '#ff8e99' },
  { bg: '#1c1233', border: '#9d7bff', text: '#c4b0ff' },
  { bg: '#2a0f20', border: '#ff5fa8', text: '#ff9ccb' },
  { bg: '#0b2226', border: '#2be0d8', text: '#7cf0ea' },
  { bg: '#262109', border: '#ffe14a', text: '#ffec8f' },
]
const calendarPalette = () =>
  (typeof document !== 'undefined' && document.documentElement.dataset.skin === 'neon' ? NEON_CALENDAR_PALETTE : CALENDAR_PALETTE)
const PX_PER_MIN = 1.4

// Sequential schedule: each task starts right when the previous one ends,
// unless it has its own start time — a later start leaves free time, an
// earlier one is clamped so nothing overlaps. Everything below shifts along.
function computeSlots(rows, dayStart) {
  const slots = []
  let cursor = dayStart
  rows.forEach((task, i) => {
    const duration = task.estimateMinutes || DEFAULT_MINUTES
    const start = i === 0 ? (task.startMinute ?? dayStart) : Math.max(cursor, task.startMinute ?? cursor)
    slots.push({ start, end: start + duration, duration })
    cursor = start + duration
  })
  return slots
}

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

// Tiny inline field used by double-click editing (Enter/blur saves, Esc cancels).
function InlineField({ initial, onCommit, onCancel, type = 'text', className, ...rest }) {
  const [value, setValue] = useState(initial)
  const doneRef = useRef(false)
  const finish = (commit) => {
    if (doneRef.current) return
    doneRef.current = true
    if (commit) onCommit(value)
    else onCancel()
  }
  return (
    <input
      type={type}
      className={'timed-inline ' + (className || '')}
      value={value}
      autoFocus
      onFocus={(e) => e.target.select?.()}
      onChange={(e) => setValue(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true) }
        if (e.key === 'Escape') finish(false)
      }}
      {...rest}
    />
  )
}

// Drag-to-resize (per user pick, variant 1 + "в обоих временах нужно") —
// a small red handle appears on hover next to the start or end time; drag
// it up/down to move that edge. `onDrag(deltaMinutes)` fires live as the
// pointer moves, `onCommit(deltaMinutes)` once on release.
function useTimeDrag(onDrag, onCommit) {
  return (e) => {
    e.stopPropagation()
    e.preventDefault()
    const startY = e.clientY
    const onMove = (ev) => {
      const deltaMin = Math.round((ev.clientY - startY) / PX_PER_MIN / 5) * 5
      onDrag(deltaMin)
    }
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const deltaMin = Math.round((ev.clientY - startY) / PX_PER_MIN / 5) * 5
      onCommit(deltaMin)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
}

// Big figure + small unit for a task's minutes (per user pick, variant D):
// "30" over "МИН", "1:15" over "Ч".
function minutesFigure(min) {
  if (min < 60) return { n: String(min), u: 'мин' }
  const h = Math.floor(min / 60)
  const m = min % 60
  return { n: m ? `${h}:${String(m).padStart(2, '0')}` : String(h), u: 'ч' }
}

// New task titles: once the first word is finished (a space is typed) its
// first letter becomes a capital automatically (per user request).
const capitalizeAfterSpace = (v) => (/\s/.test(v) && v ? v.charAt(0).toUpperCase() + v.slice(1) : v)

const isRecurring = (task) => !!task.recurrence && task.recurrence !== 'none'

// Seven dots = how the last 7 occurrences of a recurring task went (per user
// request): filled = done, ring = missed, faint = no history yet. The live
// record carries the log (see cycleLog in useTasksStore); a task finished
// today counts its own result as the newest dot.
function cycleResults(task) {
  const log = [...(task.cycleLog || [])]
  if (task.status === 'done') log.push('done')
  const last = log.slice(-7)
  return [...Array(7 - last.length).fill('none'), ...last]
}

const CYCLE_ICON = (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 6.5A5 5 0 0 0 4.2 4.6L3 6M3 2.5V6h3.5M3 9.5a5 5 0 0 0 8.8 1.9L13 10M13 13.5V10H9.5" />
  </svg>
)

// Cycle chooser under a Today row (opened from the sign at the end of the
// card): none / daily / weekly / monthly / chosen weekdays. Closes on any
// click outside, like the deadline picker.
function CyclePicker({ task, t, onSet, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || e.target.closest?.('[data-cycle-trigger]')) return
      onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [onClose])
  const [custom, setCustom] = useState(task.recurrence === 'custom')
  const days = task.recurrenceDays || []
  const pick = (recurrence) => { onSet(recurrence, null); onClose() }
  const toggleDay = (dow) => {
    const next = days.includes(dow) ? days.filter((x) => x !== dow) : [...days, dow]
    onSet(next.length ? 'custom' : 'none', next.length ? next : null)
  }
  const cur = task.recurrence || 'none'
  const chip = (label, active, onClick) => (
    <button type="button" className={'deadline-picker__chip' + (active ? ' deadline-picker__chip--on' : '')} onClick={onClick}>{label}</button>
  )
  return (
    <div ref={ref} className="deadline-picker cycle-picker" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="deadline-picker__quick">
        {chip(t('tasksHub.cycleNone'), cur === 'none' && !custom, () => pick('none'))}
        {chip(t('tasks.recurrenceDaily'), cur === 'daily', () => pick('daily'))}
        {chip(t('tasks.recurrenceWeekly'), cur === 'weekly', () => pick('weekly'))}
        {chip(t('tasks.recurrenceMonthly'), cur === 'monthly', () => pick('monthly'))}
        {chip(t('tasks.recurrenceCustom'), cur === 'custom' || custom, () => setCustom(true))}
      </div>
      {(custom || cur === 'custom') && (
        <div className="deadline-picker__quick">
          {WEEKDAYS.map((w) => chip(t(`tasks.weekdayShort.${w.key}`), days.includes(w.dow), () => toggleDay(w.dow)))}
        </div>
      )}
    </div>
  )
}

// Six-dot grip (per user pick, variant B): marks a card as draggable.
const DragGrip = () => (
  <span className="drag-grip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
)

function TimedRow({ task, number, slot, linkPrev, linkNext, onToggleDone, onEdit, onSetCycle, onSetEnd, onSetStart, onSetTitle, onSetMinutes, dragHandleProps, dragging }) {
  const [editing, setEditing] = useState(null)
  const [dragPreview, setDragPreview] = useState(null)
  const [cycleOpen, setCycleOpen] = useState(false)
  const closeCycle = useCallback(() => setCycleOpen(false), [])
  const done = task.status === 'done'
  const stop = () => setEditing(null)
  const startEdit = (what) => (e) => { e.stopPropagation(); setEditing(what) }

  // No auto-assigned clock times (per user request): a task shows start/end
  // only when its start was set by hand; otherwise just its minutes — or a
  // button to add them.
  const pinned = task.startMinute != null
  const hasMinutes = !!task.estimateMinutes
  const start = dragPreview?.edge === 'start' ? dragPreview.value : slot.start
  const end = dragPreview?.edge === 'end' ? dragPreview.value : slot.end
  const palette = calendarPalette()
  const color = palette[(number - 1) % palette.length]

  const startHandle = useTimeDrag(
    (delta) => setDragPreview({ edge: 'start', value: Math.max(0, Math.min(slot.end - 5, slot.start + delta)) }),
    (delta) => { setDragPreview(null); const m = Math.max(0, Math.min(slot.end - 5, slot.start + delta)); if (m !== slot.start) onSetStart(task, m) }
  )
  const endHandle = useTimeDrag(
    (delta) => setDragPreview({ edge: 'end', value: Math.max(slot.start + 5, slot.end + delta) }),
    (delta) => { setDragPreview(null); const m = Math.max(slot.start + 5, slot.end + delta); if (m !== slot.end) onSetEnd(task, slot.start, m) }
  )

  const results = isRecurring(task) ? cycleResults(task) : null
  const { t } = useTranslation()

  return (
    <>
    <div
      className={'timed-row' + (done ? ' timed-row--done' : '') + (linkPrev ? ' timed-row--link-prev' : '') + (linkNext ? ' timed-row--link-next' : '') + (dragging ? ' timed-row--dragging' : '')}
      style={{ minHeight: pinned ? Math.max(34, (end - start) * PX_PER_MIN) : 34 }}
      onDoubleClick={(e) => { if (!e.target.closest('button, input')) onEdit(task) }}
      {...dragHandleProps}
    >
      {!pinned ? (
        <span className="timed-row__time timed-row__time--mins">
          {editing === 'mins' ? (
            <InlineField type="number" min={5} max={480} step={5} initial={String(slot.duration)} className="timed-inline--num" onCancel={stop} onCommit={(v) => { const m = Math.round(Number(v)); if (Number.isFinite(m) && m > 0) onSetMinutes(task, m); stop() }} />
          ) : hasMinutes ? (
            <span className="timed-row__mins-label" onDoubleClick={startEdit('mins')} title="Двойной клик — изменить">
              <b>{minutesFigure(slot.duration).n}</b>
              <small>{minutesFigure(slot.duration).u}</small>
            </span>
          ) : (
            <button type="button" className="timed-row__addtime" onPointerDown={(e) => e.stopPropagation()} onClick={() => setEditing('mins')}>+ время</button>
          )}
        </span>
      ) : (
      <span className="timed-row__time">
        <span className="timed-row__time-pair">
          {editing === 'start' ? (
            <InlineField type="time" initial={fmtTime(start)} onCancel={stop} onCommit={(v) => { const m = toMinutes(v); if (m != null) onSetStart(task, m); stop() }} />
          ) : (
            <span className="timed-row__start" onDoubleClick={startEdit('start')} onPointerDown={startHandle}>
              {fmtTime(start)}
              <i className="timed-row__handle" />
            </span>
          )}
        </span>
        <span className="timed-row__time-line" />
        <span className="timed-row__time-pair">
          {editing === 'end' ? (
            <InlineField type="time" initial={fmtTime(end)} onCancel={stop} onCommit={(v) => { const m = toMinutes(v); if (m != null) onSetEnd(task, slot.start, m); stop() }} />
          ) : (
            <small className="timed-row__end" onDoubleClick={startEdit('end')} onPointerDown={endHandle}>
              {fmtTime(end)}
              <i className="timed-row__handle" />
            </small>
          )}
        </span>
      </span>
      )}
      <span className="timed-row__body" style={{ background: color.bg, color: color.text }}>
        <DragGrip />
        <span className="timed-row__title">
          <span className="timed-row__num">{number}.</span>
          {editing === 'title' ? (
            <InlineField initial={task.title} className="timed-inline--title" onCancel={stop} onCommit={(v) => { const tt = v.trim(); if (tt && tt !== task.title) onSetTitle(task, tt); stop() }} />
          ) : (
            <span className="timed-row__title-text" onDoubleClick={startEdit('title')}>{task.title}</span>
          )}
        </span>
        {results && (
          <span className="cycle-dots" aria-hidden="true">
            {results.map((r, i) => <i key={i} className={'cycle-dots__dot cycle-dots__dot--' + r} />)}
          </span>
        )}
        <button
          type="button"
          className={'cycle-sign' + (isRecurring(task) ? ' cycle-sign--on' : '')}
          data-cycle-trigger
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setCycleOpen((v) => !v)}
          title={t('tasksHub.cycleTitle')}
          aria-label={t('tasksHub.cycleTitle')}
        >
          {CYCLE_ICON}
        </button>
      </span>
      <span className="timed-row__actions">
        <button
          type="button"
          className={'timed-row__done-btn' + (done ? ' timed-row__done-btn--done' : '')}
          onClick={() => onToggleDone(task.id)}
          aria-label={done ? 'Выполнено' : 'Выполнить'}
        >
          {done ? '✓' : ''}
        </button>
      </span>
    </div>
    {cycleOpen && <CyclePicker task={task} t={t} onSet={(rec, d) => onSetCycle(task, rec, d)} onClose={closeCycle} />}
    </>
  )
}
// One date lane — Overdue / Today / Tomorrow: a dotted, Miro-style field
// holding a timed list of the day's tasks. `onAddTask` is omitted for
// Overdue (adding an already-overdue task makes no sense).
function BucketColumn({ icon: Icon, title, tone, rows: baseRows, language, taskProps, taskDrag, onAddTask, onAddClick, onInsertAfter, onMoveToToday, onRequestStart, ghost, onGhostSubmit, onGhostCancel, conflict, onConflictPush, onConflictAfter, onConflictCancel }) {
  const { t } = useTranslation()
  const dayStart = useUiPreferencesStore((s) => s.dayStartMinutes)
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])
  const submitAdd = () => {
    const trimmed = value.trim()
    if (trimmed) onAddTask(trimmed)
    setValue('')
    setAdding(false)
  }

  // Rows follow the live order while one is being dragged.
  const rows = taskDrag.displayOrder.length === baseRows.length
    ? taskDrag.displayOrder.map((id) => baseRows.find((r) => r.id === id)).filter(Boolean)
    : baseRows
  const slots = computeSlots(rows, dayStart)
  // Remaining time (per user request): finishing a task takes its minutes off
  // the header total; it stays visible, at 0, once everything is done.
  const plannedMinutes = rows.reduce((sum, r) => sum + (r.estimateMinutes || 0), 0)
  const totalMinutes = rows.reduce((sum, r) => sum + (r.status === 'done' ? 0 : (r.estimateMinutes || 0)), 0)

  return (
    <div className="tasks-column tasks-column--bucket">
      <div className={'tasks-column__header tasks-column__header--' + tone}>
        {/* The day's total minutes sit above the times column (per user pick,
            variant A — same look as the row times), the title is centred. */}
        <span className="tasks-column__total">
          {plannedMinutes > 0 && (
            <span className="timed-row__mins-label">
              <b>{minutesFigure(totalMinutes).n}</b>
              <small>{minutesFigure(totalMinutes).u}</small>
            </span>
          )}
        </span>
        <span className="tasks-column__header-title tasks-column__header-title--center"><Icon size={15} />{title}</span>
      </div>
      {adding && (
        <div className="tasks-cards__addtask tasks-cards__addtask--lane">
          <input
            ref={inputRef}
            type="text"
            className="tasks-cards__addtask-input"
            placeholder={t('tasksTable.addTaskPlaceholder')}
            value={value}
            onChange={(e) => setValue(capitalizeAfterSpace(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submitAdd() }
              if (e.key === 'Escape') { setValue(''); setAdding(false) }
            }}
            onBlur={() => { if (!value.trim()) setAdding(false) }}
          />
          <button type="button" className="tasks-cards__addtask-btn" onClick={submitAdd}>+</button>
        </div>
      )}
      {rows.length === 0 && !ghost && !(conflict && conflict.tone === tone) ? (
        onAddClick ? (
          <button type="button" className="timed-add-slot" data-drop-section="today-add" onClick={onAddClick}>
            {t('tasksActivity.addSlotHint')}
          </button>
        ) : (
          <p className="tasks-cards__empty">{t('tasksActivity.bucketEmpty')}</p>
        )
      ) : (
        <div className="timed-list">
          {rows.map((task, i) => (
            <div key={task.id}>
              <TimedRow
                task={task}
                number={i + 1}
                slot={slots[i]}
                linkPrev={task.status === 'done' && i > 0 && rows[i - 1].status === 'done'}
                linkNext={task.status === 'done' && i < rows.length - 1 && rows[i + 1].status === 'done'}
                mode={tone}
                onMoveToToday={onMoveToToday}
                language={language}
                dragHandleProps={taskDrag.bindHandle(task.id, task.title)}
                dragging={taskDrag.draggingId === task.id}
                {...taskProps}
                onSetStart={(tk, m) => onRequestStart(tk, m, rows, tone)}
              />
              {ghost && ghost.insertAfterId === task.id && !(conflict && conflict.tone === tone) ? (
                <GhostRow key="mid" ghost={ghost} onSubmit={onGhostSubmit} onCancel={onGhostCancel} />
              ) : (
                onInsertAfter && i < rows.length - 1 && (
                  <button
                    type="button"
                    className="timed-insert"
                    onClick={() => onInsertAfter(task)}
                    aria-label={t('tasksActivity.insertHere')}
                    title={t('tasksActivity.insertHere')}
                  >
                    +
                  </button>
                )
              )}
            </div>
          ))}
          {ghost && !ghost.insertAfterId && !(conflict && conflict.tone === tone) ? (
            <GhostRow key={ghost.taskId || 'new'} ghost={ghost} onSubmit={onGhostSubmit} onCancel={onGhostCancel} />
          ) : (
            !conflict && onAddClick && (
              <button type="button" className="timed-add-slot" data-drop-section="today-add" onClick={onAddClick}>
                {t('tasksActivity.addSlotHint')}
              </button>
            )
          )}
          {conflict && conflict.tone === tone && (
            <ConflictRow conflict={conflict} onPush={onConflictPush} onAfter={onConflictAfter} onCancel={onConflictCancel} />
          )}
        </div>
      )}
    </div>
  )
}

// Inline add row (user pick, "ghost row"): a dashed row at the end of Today —
// just a title and "Добавить" (no start time / minutes any more, per user
// request; minutes are set later from the row's own "+ время").
function GhostRow({ ghost, onSubmit, onCancel }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(ghost.title || '')
  const valid = title.trim().length > 0
  const submit = () => { if (valid) onSubmit({ title: title.trim(), minutes: null, startMinute: null }) }
  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    if (e.key === 'Escape') onCancel()
  }
  return (
    <div className="timed-row timed-ghost timed-ghost--simple">
      <span className="timed-row__title">
        {ghost.isNew ? (
          <input
            type="text"
            className="timed-ghost__title"
            value={title}
            autoFocus
            placeholder={t('tasks.gtd.inboxQuickAddPlaceholder')}
            onChange={(e) => setTitle(capitalizeAfterSpace(e.target.value))}
            onKeyDown={onKey}
          />
        ) : (
          <b>{ghost.title}</b>
        )}
      </span>
      <button type="button" className="timed-ghost__add timed-ghost__add--inline" disabled={!valid} onClick={submit}>{t('tasksActivity.addBtn')}</button>
      <button type="button" className="timed-ghost__cancel" onClick={onCancel} aria-label={t('tasks.cancel')} title={t('tasks.cancel')}>×</button>
    </div>
  )
}

// Time already taken — named right in the list, with the way out.
function ConflictRow({ conflict, onPush, onAfter, onCancel }) {
  const { t } = useTranslation()
  return (
    <div className="timed-row timed-ghost timed-ghost--conflict">
      <span className="timed-ghost__msg">
        {t('tasksActivity.conflictBody', { start: fmtTime(conflict.blockerSlot.start), end: fmtTime(conflict.blockerSlot.end), title: conflict.blocker.title })}
      </span>
      <div className="timed-ghost__line">
        {!conflict.blockerIsRoutine && <button type="button" className="timed-ghost__queue" onClick={onPush}>{t('tasksActivity.conflictPush')}</button>}
        <button type="button" className={conflict.blockerIsRoutine ? 'timed-ghost__queue' : 'timed-ghost__set'} onClick={onAfter}>{t('tasksActivity.conflictAfter')}</button>
        <button type="button" className="timed-ghost__set" onClick={onCancel}>{t('tasks.cancel')}</button>
      </div>
    </div>
  )
}

export default function UpcomingPage() {
  const { t, i18n } = useTranslation()
  const tasks = useTasksStore((s) => s.tasks)
  const projects = useTasksStore((s) => s.projects)
  const addTask = useTasksStore((s) => s.addTask)
  const updateTask = useTasksStore((s) => s.updateTask)
  const deleteTask = useTasksStore((s) => s.deleteTask)
  const toggleTaskDone = useTasksStore((s) => s.toggleTaskDone)
  const addProject = useTasksStore((s) => s.addProject)
  const habits = useHabitsStore((s) => s.habits)
  const addHabit = useHabitsStore((s) => s.addHabit)
  const setHabitCompletion = useHabitsStore((s) => s.setCompletion)
  const permanentlyDeleteTask = useTasksStore((s) => s.permanentlyDeleteTask)
  const reorderTasks = useTasksStore((s) => s.reorderTasks)
  // Re-read at local midnight / on refocus so an unfinished Today task falls
  // into "Надо сделать" even when the page was left open overnight.
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    let timer
    const sync = () => setToday(todayISO())
    const schedule = () => {
      const now = new Date()
      timer = setTimeout(() => { sync(); schedule() }, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 3) - now)
    }
    schedule()
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => { clearTimeout(timer); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync) }
  }, [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const openEdit = (task) => {
    setEditingTask(task)
    setModalOpen(true)
  }
  const handleSave = (fields) => {
    if (editingTask) updateTask(editingTask.id, fields)
    setModalOpen(false)
  }

  const [timerOpen, setTimerOpen] = useState(false)

  // "⋮" → convert to project — the task itself becomes a new project
  // (managed from here on via the Data page's Vazifalar panel); the task
  // record is gone afterward (not trashed — it now exists as a project).
  const convertToProject = (task) => {
    addProject(task.title)
    permanentlyDeleteTask(task.id)
  }

  const [pendingDateTask, setPendingDateTask] = useState(null)
  const [schedulePrompt, setSchedulePrompt] = useState(null)
  const [conflict, setConflict] = useState(null)
  const dayStart = useUiPreferencesStore((s) => s.dayStartMinutes)
  const taskProps = {
    onToggleDone: (id) => {
      const task = tasks.find((t) => t.id === id)
      toggleTaskDone(id)
      if (task) syncHabitForTask(task, task.status !== 'done', { habits, setCompletion: setHabitCompletion })
    },
    onEdit: openEdit,
    onEditDeadline: setPendingDateTask,
    onConvertToProject: convertToProject,
    onDelete: deleteTask,
    onSetStart: (task, minutes) => updateTask(task.id, { startMinute: Math.max(0, Math.min(1439, minutes)) }),
    onSetTitle: (task, title) => updateTask(task.id, { title }),
    onSetCycle: (task, recurrence, recurrenceDays) => {
      updateTask(task.id, { recurrence, recurrenceDays })
      spawnHabitForTask({ ...task, recurrence, recurrenceDays }, { habits, addHabit })
    },
    onSetDeadline: (task, iso) => updateTask(task.id, { whenDate: iso, deadline: null }),
    onSetMinutes: (task, minutes) => updateTask(task.id, { estimateMinutes: Math.max(5, Math.min(480, minutes)) }),
    onSetEnd: (task, start, end) => updateTask(task.id, { estimateMinutes: Math.max(5, Math.min(480, end - start)) }),
  }

  // Every active task with a deadline, sorted into 2 lanes (per user
  // request — "2 раздела: надо сделать вместо просроченных и будущего, а
  // второй это сегодня") regardless of which project (if any) it belongs
  // to — projects themselves aren't shown here any more (see Vazifalar
  // panel on the Data page instead). "Надо сделать" is everything NOT due
  // today — overdue and every future date alike, oldest-first then
  // soonest-first, since a plain date sort already puts overdue dates
  // (< today) ahead of future ones (> today) in the right order.
  const todayRows = useMemo(() => {
    const todayList = []
    // A project task is scheduled only once it's on that project's map (per
    // user request) — unplaced ones stay off the date board.
    const onMap = new Set(projects.flatMap((p) => p.flow || []))
    tasks.forEach((task) => {
      if (task.projectId && !onMap.has(task.id)) return
      // Done tasks stay in the list, marked done, until the day rolls over
      // (per user request — "выполненные держатся до следующего дня, потом
      // исчезают"): only those completed today remain visible.
      if (task.status === 'done') {
        if (!task.completedAt || isoFromDate(new Date(task.completedAt)) !== today) return
      } else if (task.status !== 'active') return
      const iso = task.deadline || task.whenDate
      if (!iso) return
      if (iso === today) {
        todayList.push(task)
      } else if (iso < today && !isRecurring(task)) {
        // A one-step task stays in Today day after day until it is done or
        // deleted (per user request); recurring ones are rolled by the store.
        todayList.push(task)
      }
    })
    // Repeating tasks come first (per user request), then the one-step ones;
    // inside each group the order is the store's own, which a drag rewrites.
    return [...todayList.filter(isRecurring), ...todayList.filter((task) => !isRecurring(task))]
  }, [tasks, projects, today])

  // Next free time in Today, offered as the default when a task is pulled in.
  const suggestedStart = useMemo(() => {
    const slots = computeSlots(todayRows, dayStart)
    return slots.length ? slots[slots.length - 1].end : dayStart
  }, [todayRows, dayStart])

  // Put a task into a column at a time (or at the end of the queue when
  // startMinute is null). If the time is taken, ask before pushing whoever
  // is there. Order in the store decides the sequence, so "pushing" means
  // slotting the task in before the blocker and letting the rest flow on.
  const placeInColumn = ({ taskId, title, minutes, startMinute, rows, dateFields, tone }) => {
    const others = rows.filter((r) => r.id !== taskId)
    const slotsO = computeSlots(others, dayStart)
    const apply = (index, startMin) => {
      const fields = { ...(dateFields || {}), ...(minutes != null ? { estimateMinutes: minutes } : null), startMinute: startMin }
      let id = taskId
      if (id) updateTask(id, fields)
      else id = addTask({ title, stage: 'tasks', ...fields })
      const order = others.map((r) => r.id)
      order.splice(index, 0, id)
      reorderTasks(order)
    }
    if (startMinute == null) { apply(others.length, null); return }
    const end = startMinute + minutes
    const j = slotsO.findIndex((sl) => startMinute < sl.end && sl.start < end)
    if (j === -1) {
      const at = slotsO.findIndex((sl) => sl.start >= end)
      apply(at === -1 ? others.length : at, startMinute)
      return
    }
    const blocker = others[j]
    setConflict({
      tone,
      blocker,
      blockerSlot: slotsO[j],
      blockerIsRoutine: !!ROUTINE_TASKS[blocker.title],
      push: () => apply(j, startMinute),
      after: () => apply(j + 1, slotsO[j].end),
    })
  }
  const requestStart = (task, minutes, rows, tone) => placeInColumn({
    taskId: task.id, minutes: task.estimateMinutes || DEFAULT_MINUTES, startMinute: minutes, rows, dateFields: null, tone,
  })

  const todayIds = todayRows.map((tsk) => tsk.id)
  const todayDrag = useDragReorder(todayIds, reorderTasks)

  const todayNode = (
    <BucketColumn
          icon={IconClock}
          tone="today"
          title={t('tasksActivity.bucketToday')}
          rows={todayRows}
          language={i18n.language}
          taskProps={taskProps}
          taskDrag={todayDrag}
          ghost={schedulePrompt}
          onGhostCancel={() => setSchedulePrompt(null)}
          onGhostSubmit={({ title, minutes, startMinute }) => {
            const p = schedulePrompt
            setSchedulePrompt(null)
            // Inserted via the "+" between two rows — its place in the list
            // is already known, so it goes in right there instead of going
            // through the time-conflict search (per user request, "легко
            // добавлять задачу между задачами").
            if (p.insertAfterId) {
              const id = addTask({ title, stage: 'tasks', whenDate: today, deadline: null })
              const order = todayRows.map((r) => r.id)
              const idx = order.indexOf(p.insertAfterId)
              order.splice(idx + 1, 0, id)
              reorderTasks(order)
              return
            }
            placeInColumn({ taskId: p.taskId, title: title || p.title, minutes, startMinute, rows: todayRows, dateFields: { whenDate: today, deadline: null }, tone: 'today' })
          }}
          conflict={conflict}
          onConflictPush={() => { conflict.push(); setConflict(null) }}
          onConflictAfter={() => { conflict.after(); setConflict(null) }}
          onConflictCancel={() => setConflict(null)}
          onRequestStart={requestStart}
          onAddClick={() => setSchedulePrompt({ isNew: true, title: '', minutes: DEFAULT_MINUTES })}
          onInsertAfter={(afterTask) => setSchedulePrompt({ isNew: true, title: '', minutes: DEFAULT_MINUTES, insertAfterId: afterTask.id })}
        />
  )

  const { view } = useParams()
  // «Мой день» is its own sidebar button now; the old Tasks hub (cards for
  // Inbox/Projects/Today) is gone, so any other /upcoming path lands here.
  let body
  if (view !== 'today') {
    body = <Navigate to="/upcoming/today" replace />
  } else {
    body = (
      <div className="tasks-page tasks-page--edge-to-edge">
        <div className="tasks-board tasks-board--fill tasks-board--stacked">{todayNode}</div>
      </div>
    )
  }

  return (
    <>
      {body}
      {todayDrag.dragGhost}
      <button
        type="button"
        className="tasks-table__pomodoro-btn tasks-table__pomodoro-btn--floating"
        onClick={() => setTimerOpen(true)}
        aria-label={t('tasksTable.startPomodoro')}
        title={t('tasksTable.startPomodoro')}
      >
        <IconFocus size={18} />
      </button>
      <DueRequiredPrompt
        task={pendingDateTask}
        onConfirm={(iso, estimateMinutes) => {
          updateTask(pendingDateTask.id, { whenDate: iso, estimateMinutes })
          setPendingDateTask(null)
        }}
        onCancel={() => setPendingDateTask(null)}
      />
      {modalOpen && editingTask && (
        <TaskFormModal
          task={editingTask}
          projects={projects}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          onCreateProject={addProject}
          onDelete={(id) => { deleteTask(id); setModalOpen(false) }}
        />
      )}
      {timerOpen && (
        <div className="task-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setTimerOpen(false) }}>
          <MyDayTimer task={{ id: PSEUDO_TIMER_TASK_ID, title: t('tasksTable.pomodoroSessionTitle') }} onClose={() => setTimerOpen(false)} />
        </div>
      )}
    </>
  )
}
