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
import { isoFromDate, todayISO, nextRecurringDate, recursOnDate } from '../features/tasks/taskLogic'
import { ROUTINE_TASKS } from '../features/tasks/dailyRoutineTasks'
import { syncHabitForTask, spawnHabitForTask, findLinkedHabit, isHabitTask } from '../features/tasks/habitTaskSync'
import { IconFocus, IconClock } from '../icons/Icons'
import { ROW_PALETTE } from '../features/tasks/rowPalette'
import { CYCLE_ICON, CyclePicker } from '../features/tasks/CyclePicker'
import { buildTodayRows } from '../features/tasks/todayRows'
import { projectRowColors, projectRole, projectLinks, groupProjectRows } from '../features/tasks/projectParent'
import MissedHabitBell, { lastMissedDay } from '../features/tasks/MissedHabitBell'
import PlusChoiceMenu from '../features/tasks/PlusChoiceMenu'

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

// Six-dot grip (per user pick, variant B): marks a card as draggable.
const DragGrip = () => (
  <span className="drag-grip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
)

function TimedRow({ task, number, role, plinks, onPlus, slot, linkPrev, linkNext, onToggleDone, onEdit, onSetCycle, onSetEnd, onSetStart, onSetTitle, onSetMinutes, seriesFor, seenMiss, onDismissMiss, onMarkMissed, selecting, selected, onSelect, dragHandleProps, dragging }) {
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
  const color = role ? projectRowColors(role.project) : ROW_PALETTE[(number - 1) % ROW_PALETTE.length]

  const startHandle = useTimeDrag(
    (delta) => setDragPreview({ edge: 'start', value: Math.max(0, Math.min(slot.end - 5, slot.start + delta)) }),
    (delta) => { setDragPreview(null); const m = Math.max(0, Math.min(slot.end - 5, slot.start + delta)); if (m !== slot.start) onSetStart(task, m) }
  )
  const endHandle = useTimeDrag(
    (delta) => setDragPreview({ edge: 'end', value: Math.max(slot.start + 5, slot.end + delta) }),
    (delta) => { setDragPreview(null); const m = Math.max(slot.start + 5, slot.end + delta); if (m !== slot.end) onSetEnd(task, slot.start, m) }
  )

  const results = isRecurring(task) ? cycleResults(task) : null
  const { t, i18n } = useTranslation()

  return (
    <>
    <div
      className={'timed-row' + (done ? ' timed-row--done' : '') + (linkPrev ? ' timed-row--link-prev' : '') + (linkNext ? ' timed-row--link-next' : '') + (dragging ? ' timed-row--dragging' : '') + (selecting ? ' timed-row--selecting' : '') + (selected ? ' timed-row--selected' : '') + (plinks?.prev ? ' timed-row--plink-prev' : '') + (plinks?.next ? ' timed-row--plink-next' : '')}
      style={{ minHeight: pinned ? Math.max(34, (end - start) * PX_PER_MIN) : 34, ...(role ? { '--proj-line': color.line } : null) }}
      onDoubleClick={selecting ? undefined : (e) => { if (!e.target.closest('button, input')) onEdit(task) }}
      onClick={selecting ? () => onSelect(task.id) : undefined}
      {...(selecting ? null : dragHandleProps)}
    >
      <span className="timed-row__body" style={{ background: color.bg, color: color.text, '--h': color.hue, '--row-bg-light': color.bg }}>
        {selecting ? (
          <span className={'task-sel' + (selected ? ' task-sel--on' : '')} aria-hidden="true">
            {selected && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
          </span>
        ) : <DragGrip />}
        <span className="timed-row__title">
          <span className="timed-row__num">{number}.</span>
          {editing === 'title' ? (
            <InlineField initial={task.title} className="timed-inline--title" onCancel={stop} onCommit={(v) => { const tt = v.trim(); if (tt && tt !== task.title) onSetTitle(task, tt); stop() }} />
          ) : (
            <span className="timed-row__title-text" onDoubleClick={startEdit('title')}>{task.title}</span>
          )}
        </span>
        {role?.kind === 'parent' && <span className="proj-pill">{t('tasksList.projectPill')}</span>}
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
        {results && seriesFor && (() => {
          const series = seriesFor(task)
          const applies = (h, iso) => recursOnDate({ recurrence: h.recurrence, recurrenceDays: h.recurrenceDays, whenDate: h.createdAt.slice(0, 10) }, iso)
          const missedIso = lastMissedDay(series, todayISO(), applies)
          return (
            <MissedHabitBell
              habit={series}
              missedIso={missedIso}
              unseen={!!missedIso && seenMiss?.[task.title] !== missedIso}
              today={todayISO()}
              applies={applies}
              t={t}
              locale={i18n.language || 'ru'}
              color={color.border}
              onMark={(iso) => onMarkMissed(task, series, iso)}
              onDismiss={() => onDismissMiss(task.title, missedIso)}
            />
          )
        })()}
        <button
          type="button"
          className="plus-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => onPlus(task, e.currentTarget.getBoundingClientRect())}
          title={t('tasksList.plusAddToProject')}
          aria-label={t('tasksList.plusAddToProject')}
          aria-haspopup="menu"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>
        </button>
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
      </span>
      <span className="timed-row__actions">
        {role?.kind === 'parent' && role.locked ? (
          <button
            type="button"
            className="timed-row__done-btn timed-row__done-btn--lock"
            disabled
            title={t('tasksList.projectLocked', { done: role.done, total: role.total })}
            aria-label={t('tasksList.projectLocked', { done: role.done, total: role.total })}
          >
            {role.done}/{role.total}
          </button>
        ) : (
          <button
            type="button"
            className={'timed-row__done-btn' + (done ? ' timed-row__done-btn--done' : '') + (role?.kind === 'parent' && !done ? ' timed-row__done-btn--ready' : '')}
            onClick={() => onToggleDone(task.id)}
            aria-label={done ? 'Выполнено' : 'Выполнить'}
            title={role?.kind === 'parent' && !done ? t('tasksList.projectReady') : undefined}
          >
            {done ? '✓' : ''}
          </button>
        )}
      </span>
    </div>
    {cycleOpen && <CyclePicker task={task} t={t} onSet={(rec, d) => onSetCycle(task, rec, d)} onClose={closeCycle} />}
    </>
  )
}
// One date lane — Overdue / Today / Tomorrow: a dotted, Miro-style field
// holding a timed list of the day's tasks. `onAddTask` is omitted for
// Overdue (adding an already-overdue task makes no sense).
function BucketColumn({ icon: Icon, title, tone, rows: baseRows, language, taskProps, taskDrag, onAddTask, onAddClick, onInsertAfter, onMoveToToday, onRequestStart, ghost, onGhostSubmit, onGhostCancel, conflict, onConflictPush, onConflictAfter, onConflictCancel, onDeleteMany }) {
  const { t } = useTranslation()
  const dayStart = useUiPreferencesStore((s) => s.dayStartMinutes)
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  // Group mode: pick several tasks and delete them together (to Трэш, like a single delete).
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [confirmDel, setConfirmDel] = useState(false)
  const exitSelect = () => { setSelecting(false); setSelected(new Set()); setConfirmDel(false) }
  const toggleSelected = (id) => {
    setConfirmDel(false)
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  useEffect(() => {
    if (!selecting) return undefined
    const onKey = (e) => { if (e.key === 'Escape') exitSelect() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selecting])
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
  const plinksAll = projectLinks(rows, taskProps.projects || [])
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const deleteSelected = () => {
    onDeleteMany(rows.filter((r) => selected.has(r.id)).map((r) => r.id))
    exitSelect()
  }
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
        {onDeleteMany && rows.length > 0 && (
          <button type="button" className={'tasks-select-btn' + (selecting ? ' tasks-select-btn--on' : '')} onClick={() => (selecting ? exitSelect() : setSelecting(true))} title={selecting ? t('tasksList.selectDone') : t('tasksList.select')} aria-label={selecting ? t('tasksList.selectDone') : t('tasksList.select')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
              <path d="M8 12.3l2.8 2.8L16.3 9.5" />
            </svg>
          </button>
        )}
      </div>
      {selecting && (
        <div className="tasks-select-bar">
          <span className="tasks-select-bar__count">{t('tasksList.selectedCount', { n: selected.size })}</span>
          <button type="button" onClick={() => { setConfirmDel(false); setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id))) }}>
            {allSelected ? t('tasksList.selectNone') : t('tasksList.selectAll')}
          </button>
          {confirmDel ? (
            <>
              <span className="tasks-select-bar__ask">{t('tasksList.deleteSelectedConfirm', { n: selected.size })}</span>
              <button type="button" className="tasks-select-bar__danger" onClick={deleteSelected}>{t('tasksList.deleteSelectedYes')}</button>
              <button type="button" onClick={() => setConfirmDel(false)}>{t('tasks.cancel')}</button>
            </>
          ) : (
            <button type="button" className="tasks-select-bar__danger" disabled={selected.size === 0} onClick={() => setConfirmDel(true)}>
              {t('tasksList.deleteSelected')}{selected.size ? ` (${selected.size})` : ''}
            </button>
          )}
        </div>
      )}
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
                role={projectRole(task, taskProps.allTasks || [], taskProps.projects || [])}
                plinks={plinksAll[i]}
                slot={slots[i]}
                linkPrev={task.status === 'done' && i > 0 && rows[i - 1].status === 'done'}
                linkNext={task.status === 'done' && i < rows.length - 1 && rows[i + 1].status === 'done'}
                mode={tone}
                onMoveToToday={onMoveToToday}
                language={language}
                dragHandleProps={taskDrag.bindHandle(task.id, task.title)}
                dragging={taskDrag.draggingId === task.id}
                selecting={selecting}
                selected={selected.has(task.id)}
                onSelect={toggleSelected}
                {...taskProps}
                onSetStart={(tk, m) => onRequestStart(tk, m, rows, tone)}
              />
              {ghost && ghost.insertAfterId === task.id && !(conflict && conflict.tone === tone) ? (
                <GhostRow key="mid" ghost={ghost} onSubmit={onGhostSubmit} onCancel={onGhostCancel} />
              ) : (
                onInsertAfter && !selecting && i < rows.length - 1 && (
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
            !conflict && !selecting && onAddClick && (
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
  const toggleHabitCompletion = useHabitsStore((s) => s.toggleCompletion)
  const convertTaskToProject = useTasksStore((s) => s.convertToProject)
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

  const [pendingDateTask, setPendingDateTask] = useState(null)
  const [schedulePrompt, setSchedulePrompt] = useState(null)
  const [conflict, setConflict] = useState(null)
  const dayStart = useUiPreferencesStore((s) => s.dayStartMinutes)
  // «+» on a row: create a project from the task, or add it to an existing one (it stays in today's list,
  // so it goes onto the project's map).
  const [plusMenu, setPlusMenu] = useState(null)
  const setProjectFlow = useTasksStore((s) => s.setProjectFlow)
  const openProjectAddTask = useTasksStore((s) => s.openProjectAddTask)
  const assignProject = (task, projectId) => {
    updateTask(task.id, { projectId })
    const project = projects.find((p) => p.id === projectId)
    if (project && !(project.flow || []).includes(task.id)) setProjectFlow(projectId, [...(project.flow || []), task.id])
  }
  // «Понял» on a missed-habit card hides its bell until the next miss (kept per device, by title).
  const [seenMiss, setSeenMiss] = useState(() => {
    try { return JSON.parse(localStorage.getItem('arkad:missedSeen') || '{}') } catch { return {} }
  })
  const dismissMiss = (title, iso) => {
    setSeenMiss((prev) => {
      const next = { ...prev, [title]: iso }
      try { localStorage.setItem('arkad:missedSeen', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }
  // The history of a repeating task's series: every finished copy (each completion is its own record),
  // plus the linked habit's days when it is a habit — this feeds the activity map.
  const seriesFor = (task) => {
    const habit = isHabitTask(task) ? findLinkedHabit(habits, task.title) : null
    const completions = { ...(habit?.completions || {}) }
    let created = (habit?.createdAt || task.createdAt || `${todayISO()}T00:00:00`).slice(0, 10)
    tasks.forEach((x) => {
      if (x.title !== task.title || !x.recurrence || x.recurrence === 'none' || x.status === 'trashed') return
      const c = (x.createdAt || '').slice(0, 10)
      if (c && c < created) created = c
      if (x.status === 'done' && x.completedAt) completions[isoFromDate(new Date(x.completedAt))] = true
    })
    return { id: habit?.id || task.id, title: task.title, createdAt: `${created}T00:00:00`, completions, recurrence: task.recurrence, recurrenceDays: task.recurrenceDays }
  }
  // Marks a missed day done: on the linked habit when there is one, otherwise as a finished copy of the task.
  const markMissed = (task, series, iso) => {
    const habit = isHabitTask(task) ? findLinkedHabit(habits, task.title) : null
    if (habit) { toggleHabitCompletion(habit.id, iso); return }
    addTask({
      title: task.title, stage: 'tasks', projectId: task.projectId, createdIn: task.createdIn,
      recurrence: task.recurrence, recurrenceDays: task.recurrenceDays,
      whenDate: iso, status: 'done', completedAt: `${iso}T12:00:00`,
    })
  }
  const taskProps = {
    onPlus: (task, rect) => setPlusMenu({ task, rect }),
    projects,
    allTasks: tasks,
    seriesFor,
    seenMiss,
    onDismissMiss: dismissMiss,
    onMarkMissed: markMissed,
    onToggleDone: (id) => {
      const task = tasks.find((t) => t.id === id)
      toggleTaskDone(id)
      if (task) syncHabitForTask(task, task.status !== 'done', { habits, setCompletion: setHabitCompletion })
    },
    onEdit: openEdit,
    onEditDeadline: setPendingDateTask,
    onDelete: deleteTask,
    onSetStart: (task, minutes) => updateTask(task.id, { startMinute: Math.max(0, Math.min(1439, minutes)) }),
    onSetTitle: (task, title) => updateTask(task.id, { title }),
    onSetCycle: (task, recurrence, recurrenceDays) => {
      const patch = { recurrence, recurrenceDays }
      // Weekly / monthly with a chosen day: the task shows up on the next such day.
      if ((recurrence === 'weekly' || recurrence === 'monthly') && recurrenceDays?.length) {
        const next = nextRecurringDate({ ...task, ...patch }, todayISO())
        if (next) { patch.whenDate = next; patch.deadline = null }
      }
      updateTask(task.id, patch)
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
  const todayRows = useMemo(() => buildTodayRows(tasks, projects, today), [tasks, projects, today])

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
      else id = addTask({ title, stage: 'tasks', createdIn: 'myday', ...fields })
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
              const id = addTask({ title, stage: 'tasks', createdIn: 'myday', whenDate: today, deadline: null })
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
          onDeleteMany={(ids) => ids.forEach((id) => deleteTask(id))}
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
      {plusMenu && (
        <PlusChoiceMenu
          rect={plusMenu.rect}
          projects={projects}
          tasks={tasks}
          parentProject={projectRole(plusMenu.task, tasks, projects)?.kind === 'parent' ? projectRole(plusMenu.task, tasks, projects).project : null}
          taskProject={null}
          onAddOwn={() => { openProjectAddTask(projectRole(plusMenu.task, tasks, projects).project.id); setPlusMenu(null) }}
          onCreateProject={() => { convertTaskToProject(plusMenu.task.id); setPlusMenu(null) }}
          onPickProject={(projectId) => { assignProject(plusMenu.task, projectId); setPlusMenu(null) }}
          onClose={() => setPlusMenu(null)}
        />
      )}
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
