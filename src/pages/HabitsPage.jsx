import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useHabitsStore } from '../store/useHabitsStore'
import { useTasksStore } from '../store/useTasksStore'
import { addDays, RECURRENCE_OPTIONS, todayISO, WEEKDAYS } from '../features/tasks/taskLogic'
import { useDragReorder } from '../features/tasks/useDragReorder'
import { buildTodayRows, splitHabits } from '../features/tasks/todayRows'
import { isHabitTask } from '../features/tasks/habitTaskSync'
import { ROW_PALETTE } from '../features/tasks/rowPalette'
import EmptyStateCelebration from '../features/tasks/EmptyStateCelebration'
import { syncTaskForHabit, spawnTaskForHabit } from '../features/tasks/habitTaskSync'
import { COLOR_PALETTE } from '../constants/colorPalette'
import { IconFlame, IconSettings } from '../icons/Icons'

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const STRIP_DAYS_BEFORE = 14 // 2 full weeks before this week's Monday
// Was 4 (just through this week's Friday) — per user report the strip felt
// like it "stopped" since there was no way to see further ahead. No
// scroll/pagination here, so this just widens the fixed window itself.
const STRIP_DAYS_AFTER = 30
// "none" doesn't make sense for a habit — it's the one field that always
// repeats, unlike a task's optional recurrence.
const HABIT_RECURRENCE_OPTIONS = RECURRENCE_OPTIONS.filter((o) => o.key !== 'none')

// Monday-aligned window matching the reference design exactly (per user
// request) — starts 2 weeks before the current week's Monday, ends on the
// current week's Friday, so "today" always lands within the visible strip
// with a couple of upcoming days showing after it.
function buildDateStrip(today) {
  const dow = new Date(`${today}T00:00:00`).getDay() // 0=Sun..6=Sat
  const mondayOffset = (dow + 6) % 7
  const thisMonday = addDays(today, -mondayOffset)
  const start = addDays(thisMonday, -STRIP_DAYS_BEFORE)
  const length = STRIP_DAYS_BEFORE + STRIP_DAYS_AFTER + 1
  return Array.from({ length }, (_, i) => addDays(start, i))
}

// Consecutive done-days ending at `date` (inclusive if `date` itself is
// done) — walks backward day by day until it hits a gap. A habit that's
// still pending for the selected date still shows whatever streak it
// already had going into that date (see the reference: an unchecked row
// keeps its streak number, just dimmer/orange instead of red).
function computeStreak(habit, date) {
  let count = 0
  let cursor = habit.completions[date] ? date : addDays(date, -1)
  while (habit.completions[cursor]) {
    count += 1
    cursor = addDays(cursor, -1)
  }
  return count
}

// Whether a habit is even "due" on a given date, per its own cyclicity
// (see addHabit's recurrence/recurrenceDays) — mirrors recursOnDate in
// ActionColumnBoard.jsx. Used to decide which habits count toward a day's
// completion ratio (see dayColorClass below); a weekly habit not due on a
// Tuesday shouldn't count against Tuesday just because it's untouched
// that day.
export function appliesOnDate(habit, iso) {
  if (habit.recurrence === 'daily' || !habit.recurrence) return true
  const anchor = new Date(`${habit.createdAt.slice(0, 10)}T00:00:00`)
  const d = new Date(`${iso}T00:00:00`)
  if (habit.recurrence === 'weekly' && habit.recurrenceDays?.length) return habit.recurrenceDays.includes(d.getDay())
  if (habit.recurrence === 'monthly' && habit.recurrenceDays?.length) {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return d.getDate() === Math.min(habit.recurrenceDays[0], last)
  }
  if (habit.recurrence === 'weekly') return anchor.getDay() === d.getDay()
  if (habit.recurrence === 'monthly') return anchor.getDate() === d.getDate()
  if (habit.recurrence === 'custom') return (habit.recurrenceDays || []).includes(d.getDay())
  return true
}

// Shared title/recurrence/goal/color fields for both the bottom "add" row
// and a habit's own inline edit form (per user request to be able to edit
// these, not just set them once at creation) — one definition so the two
// forms can't drift apart. Everything but the title itself lives behind one
// "options" popover (per user request — used to be split between a visible
// recurrence <select> and a separate gear button, now it's all one window).
function HabitFields({ t, title, onTitleChange, recurrence, onRecurrenceChange, recurrenceDays, onToggleDay, targetDays, onTargetDaysChange, color, onColorChange, onSubmit, submitLabel, titleRef, autoFocus }) {
  const [optionsOpen, setOptionsOpen] = useState(false)

  return (
    <div className="habits-add-row">
      <input
        ref={titleRef}
        type="text"
        className="habits-add-input"
        placeholder={t('habits.addPlaceholder')}
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && recurrence !== 'custom') onSubmit() }}
        autoFocus={autoFocus}
      />
      <div className="habits-options">
        <button
          type="button"
          className="habits-options-btn"
          style={{ '--swatch-color': color }}
          onClick={() => setOptionsOpen((v) => !v)}
          aria-label={t('habits.options')}
          aria-expanded={optionsOpen}
        >
          <IconSettings size={15} />
        </button>
        {optionsOpen && (
          <div className="habits-options-dropdown">
            <label className="habits-options-label" htmlFor="habit-recurrence-select">{t('tasks.recurrenceLabel')}</label>
            <select
              id="habit-recurrence-select"
              className="habits-add-recurrence"
              value={recurrence}
              onChange={(e) => onRecurrenceChange(e.target.value)}
            >
              {HABIT_RECURRENCE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{t(`tasks.${opt.labelKey}`)}</option>
              ))}
            </select>
            {/* Only meaningful once "custom" is picked above — which
                weekdays it recurs on. */}
            {recurrence === 'custom' && (
              <div className="task-modal__chip-group habits-add-days">
                {WEEKDAYS.map((w) => (
                  <button
                    key={w.dow}
                    type="button"
                    className={'task-modal__chip' + (recurrenceDays.includes(w.dow) ? ' active' : '')}
                    onClick={() => onToggleDay(w.dow)}
                  >
                    {t(`tasks.weekdayShort.${w.key}`)}
                  </button>
                ))}
              </div>
            )}
            {/* Total days planned for the habit (per user request — "30 дней
                пить магний", "365 дней читать"), not how often it repeats. */}
            <label className="habits-options-label" htmlFor="habit-goal-input">{t('habits.goalLabel')}</label>
            <input
              id="habit-goal-input"
              type="number"
              min="1"
              className="habits-goal-input"
              placeholder={t('habits.goalPlaceholder')}
              value={targetDays}
              onChange={(e) => onTargetDaysChange(e.target.value)}
            />
            {/* Per user request — a habit's "done" color no longer has to be
                the fixed red every row used before. */}
            <div className="habits-color-picker">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={'habits-color-swatch' + (color === c ? ' habits-color-swatch--active' : '')}
                  style={{ '--swatch-color': c }}
                  onClick={() => onColorChange(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <button type="button" className="habits-add-btn" onClick={onSubmit}>{submitLabel}</button>
    </div>
  )
}

export default function HabitsPage() {
  const { t } = useTranslation()
  const habits = useHabitsStore((s) => s.habits)
  const addHabit = useHabitsStore((s) => s.addHabit)
  const updateHabit = useHabitsStore((s) => s.updateHabit)
  const deleteHabit = useHabitsStore((s) => s.deleteHabit)
  const toggleCompletion = useHabitsStore((s) => s.toggleCompletion)
  const reorderHabits = useHabitsStore((s) => s.reorderHabits)
  const tasks = useTasksStore((s) => s.tasks)
  const addTask = useTasksStore((s) => s.addTask)
  const updateTask = useTasksStore((s) => s.updateTask)
  const toggleTaskDone = useTasksStore((s) => s.toggleTaskDone)

  // Grab-anywhere-on-the-card drag-to-reorder (per user request), same
  // pointer-based hook every other list in the app uses (see
  // useDragReorder.jsx) — the whole list is one flat bucket, so the new
  // order replaces habits outright (see reorderHabits).
  const today = todayISO()
  // The page lists (1) the habits whose task is in «Мой день» today, in that list's order, then
  // (2) the habits made in this section (draggable). See splitHabits.
  const allTasks = useTasksStore((s) => s.tasks)
  const allProjects = useTasksStore((s) => s.projects)
  const todayRowsForHabits = useMemo(() => buildTodayRows(allTasks, allProjects, today), [allTasks, allProjects, today])
  const { linked: linkedHabits, own: ownHabits, rowIndex } = useMemo(
    () => splitHabits(habits, todayRowsForHabits),
    [habits, todayRowsForHabits],
  )
  // A repeating task made in «Мой день» IS a habit: if one of today's has no habit yet, create it,
  // so the list here always follows «Мой день» row for row.
  useEffect(() => {
    if (habits.length === 0) return // the store may not be loaded yet — never create from an empty list
    const seen = new Set(habits.map((h) => h.title))
    todayRowsForHabits.forEach((task) => {
      if (!isHabitTask(task) || seen.has(task.title)) return
      seen.add(task.title)
      addHabit(task.title, task.recurrence, task.recurrenceDays || [], undefined, null, 'myday')
    })
  }, [habits, todayRowsForHabits, addHabit])
  const shownHabits = useMemo(() => [...linkedHabits, ...ownHabits], [linkedHabits, ownHabits])
  const linkedIds = useMemo(() => new Set(linkedHabits.map((h) => h.id)), [linkedHabits])
  const habitIds = useMemo(() => ownHabits.map((h) => h.id), [ownHabits])
  const { displayOrder: ownOrder, draggingId: draggingHabitId, bindHandle: bindHabitHandle, dragGhost } =
    useDragReorder(habitIds, reorderHabits)
  const habitOrder = useMemo(() => [...linkedHabits.map((h) => h.id), ...ownOrder], [linkedHabits, ownOrder])
  const habitsById = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits])

  const dateStrip = useMemo(() => buildDateStrip(today), [today])
  const [selectedDate, setSelectedDate] = useState(today)
  const [newTitle, setNewTitle] = useState('')
  const [newRecurrence, setNewRecurrence] = useState('daily')
  const [newRecurrenceDays, setNewRecurrenceDays] = useState([])
  const [newTargetDays, setNewTargetDays] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0])
  const inputRef = useRef(null)

  // Which habit is open in the edit modal (per user request — clicking the
  // row itself, anywhere but the checkmark, opens a separate modal window
  // instead of the old inline "⋮" dropdown), and whether that modal's own
  // delete button is mid-confirm.
  const [editingId, setEditingId] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editRecurrence, setEditRecurrence] = useState('daily')
  const [editRecurrenceDays, setEditRecurrenceDays] = useState([])
  const [editTargetDays, setEditTargetDays] = useState('')
  const [editColor, setEditColor] = useState(COLOR_PALETTE[0])

  // Each day's own completion ratio (per user request, replacing the
  // earlier chain-link between days) — green once everything due that day
  // is checked off, red while nothing is, yellow anywhere in between. Only
  // counts habits actually due that date (see appliesOnDate); a day with
  // nothing due at all stays neutral. Future days stay neutral too (per
  // user report) — they haven't happened yet, so "0% done" would read as a
  // failure that isn't real; only today and past days actually get judged.
  const dayColorClass = useMemo(() => {
    const map = new Map()
    dateStrip.forEach((iso) => {
      if (iso > today) { map.set(iso, ''); return }
      const due = shownHabits.filter((h) => appliesOnDate(h, iso))
      if (due.length === 0) { map.set(iso, ''); return }
      const doneCount = due.filter((h) => h.completions[iso]).length
      if (doneCount === due.length) map.set(iso, ' habits-day--full')
      else if (doneCount === 0) map.set(iso, ' habits-day--empty')
      else map.set(iso, ' habits-day--partial')
    })
    return map
  }, [dateStrip, shownHabits, today])

  // Same celebration as Tasks/Wishes/Inbox/Insights (per user request) —
  // shown once every habit actually due today is checked off, mirroring
  // the sidebar's own green-check condition (see Sidebar.jsx's
  // sectionCounts.habits) so the two never disagree.
  const dueToday = useMemo(() => shownHabits.filter((h) => appliesOnDate(h, today)), [shownHabits, today])
  const allDoneToday = dueToday.length > 0 && dueToday.every((h) => h.completions[today])

  const toggleNewRecurrenceDay = (dow) => {
    setNewRecurrenceDays((days) => (days.includes(dow) ? days.filter((d) => d !== dow) : [...days, dow]))
  }

  const handleAdd = () => {
    if (!newTitle.trim()) return
    const title = newTitle.trim()
    addHabit(title, newRecurrence, newRecurrenceDays, newColor, newTargetDays ? Number(newTargetDays) : null)
    spawnTaskForHabit({ title, recurrence: newRecurrence, recurrenceDays: newRecurrenceDays }, { tasks, addTask, updateTask })
    setNewTitle('')
    setNewRecurrence('daily')
    setNewRecurrenceDays([])
    setNewTargetDays('')
    setNewColor(COLOR_PALETTE[0])
    inputRef.current?.focus()
  }

  const startEdit = (habit) => {
    setEditingId(habit.id)
    setConfirmingDelete(false)
    setEditTitle(habit.title)
    setEditRecurrence(habit.recurrence || 'daily')
    setEditRecurrenceDays(habit.recurrenceDays || [])
    setEditTargetDays(habit.targetDays ? String(habit.targetDays) : '')
    setEditColor(habit.color || COLOR_PALETTE[0])
  }
  const cancelEdit = () => { setEditingId(null); setConfirmingDelete(false) }
  const toggleEditRecurrenceDay = (dow) => {
    setEditRecurrenceDays((days) => (days.includes(dow) ? days.filter((d) => d !== dow) : [...days, dow]))
  }
  const saveEdit = () => {
    if (!editTitle.trim()) return
    updateHabit(editingId, {
      title: editTitle.trim(),
      recurrence: editRecurrence,
      recurrenceDays: editRecurrenceDays,
      targetDays: editTargetDays ? Number(editTargetDays) : null,
      color: editColor,
    })
    setEditingId(null)
  }
  const confirmDeleteEditing = () => {
    deleteHabit(editingId)
    setEditingId(null)
    setConfirmingDelete(false)
  }

  return (
    <div className="tasks-page tasks-page--edge-to-edge">
      <div className="tasks-board tasks-board--fill">
        <div className="tasks-column tasks-column--habits">

          <div className="tasks-column__list">
            <div className="habits-datestrip">
              {dateStrip.map((iso) => {
                const d = new Date(`${iso}T00:00:00`)
                const dowKey = WEEKDAY_KEYS[(d.getDay() + 6) % 7]
                const isToday = iso === today
                const isSelected = iso === selectedDate
                return (
                  <div className="habits-day-cell" key={iso}>
                    <button
                      type="button"
                      className={
                        'habits-day'
                        + (isToday ? ' habits-day--today' : '')
                        + (isSelected ? ' habits-day--selected' : '')
                        + (dayColorClass.get(iso) || '')
                      }
                      onClick={() => setSelectedDate(iso)}
                    >
                      <span className="habits-day__label">{t(`tasks.weekdayShort.${dowKey}`)}</span>
                      <span className="habits-day__num">{d.getDate()}</span>
                    </button>
                  </div>
                )
              })}
            </div>

            {allDoneToday && <EmptyStateCelebration message={t('habits.allDoneToday')} compact />}

            <div className="habits-list">
              {shownHabits.length === 0 ? (
                <p className="task-section__empty">{t('habits.emptyHint')}</p>
              ) : (
                habitOrder.map((habitId) => {
                  const habit = habitsById.get(habitId)
                  if (!habit) return null
                  const done = !!habit.completions[selectedDate]
                  const streak = computeStreak(habit, selectedDate)
                  // "Daily"/"Weekly"/etc no longer shown as its own line (per
                  // user request) — only an actual day count does: the
                  // total-days goal's progress if one's set ("30 дней пить
                  // магний"), nothing at all otherwise (the streak pill below
                  // already covers the day-to-day case).
                  const goalLabel = habit.targetDays
                    ? `${Object.keys(habit.completions).length}/${habit.targetDays} ${t('habits.streakUnit')}`
                    : ''
                  return (
                    <div
                      key={habit.id}
                      {...(linkedIds.has(habit.id) ? null : bindHabitHandle(habit.id, habit.title))}
                      className={
                        'habits-row'
                        + (done ? ' habits-row--done' : ' habits-row--pending')
                        + (draggingHabitId === habit.id ? ' habits-row--dragging' : '')
                      }
                      data-linked={linkedIds.has(habit.id) ? '' : undefined}
                      style={linkedIds.has(habit.id)
                        // Same colour as its row in «Мой день»: bright hue on the dark theme, the row's border colour on light.
                        ? { '--habit-color': ROW_PALETTE[rowIndex.get(habit.id) % ROW_PALETTE.length].border, '--hc-dark': ROW_PALETTE[rowIndex.get(habit.id) % ROW_PALETTE.length].hue }
                        : { '--habit-color': habit.color || COLOR_PALETTE[0] }}
                      onClick={() => startEdit(habit)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startEdit(habit) }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="habits-row__body">
                        <span className="habits-row__title">{habit.title}</span>
                        {goalLabel && <span className="habits-row__freq">{goalLabel}</span>}
                      </span>
                      {/* Streak, shown next to the habit per user request,
                          "x{n} день"-style instead of the earlier floating
                          corner badge. */}
                      <span className="habits-streak-pill"><IconFlame size={13} /> x{streak} {t('habits.streakUnit')}</span>
                      <button
                        type="button"
                        className="habits-toggle-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          const nowDone = !habit.completions[selectedDate]
                          toggleCompletion(habit.id, selectedDate)
                          syncTaskForHabit(habit, selectedDate, nowDone, { tasks, toggleTaskDone, updateTask })
                        }}
                        aria-label={done ? t('tasks.markUndone') : t('tasks.toggleDone')}
                      >
                        {done ? '✓' : '+'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {dragGhost}

          <div className="habits-add">
            <HabitFields
              t={t}
              title={newTitle}
              onTitleChange={setNewTitle}
              recurrence={newRecurrence}
              onRecurrenceChange={setNewRecurrence}
              recurrenceDays={newRecurrenceDays}
              onToggleDay={toggleNewRecurrenceDay}
              targetDays={newTargetDays}
              onTargetDaysChange={setNewTargetDays}
              color={newColor}
              onColorChange={setNewColor}
              onSubmit={handleAdd}
              submitLabel="+"
              titleRef={inputRef}
            />
          </div>
        </div>
      </div>

      {/* Edit/delete window (per user request — clicking a habit row itself,
          anywhere but the checkmark, opens this instead of the old inline
          "⋮" dropdown). */}
      {editingId && (
        <div className="habits-modal-backdrop" onClick={cancelEdit}>
          <div className="habits-modal" onClick={(e) => e.stopPropagation()}>
            <HabitFields
              t={t}
              title={editTitle}
              onTitleChange={setEditTitle}
              recurrence={editRecurrence}
              onRecurrenceChange={setEditRecurrence}
              recurrenceDays={editRecurrenceDays}
              onToggleDay={toggleEditRecurrenceDay}
              targetDays={editTargetDays}
              onTargetDaysChange={setEditTargetDays}
              color={editColor}
              onColorChange={setEditColor}
              onSubmit={saveEdit}
              submitLabel={t('tasks.save')}
              autoFocus
            />
            <div className="habits-modal-actions">
              {confirmingDelete ? (
                <span className="project-row__confirm">
                  <span>{t('tasks.confirmDeleteTask')}</span>
                  <button type="button" onClick={confirmDeleteEditing}>{t('tasks.yes')}</button>
                  <button type="button" onClick={() => setConfirmingDelete(false)}>{t('tasks.no')}</button>
                </span>
              ) : (
                <button type="button" className="project-row__menu-danger habits-modal-delete" onClick={() => setConfirmingDelete(true)}>
                  {t('tasks.deleteTask')}
                </button>
              )}
              <button type="button" className="habits-edit-cancel" onClick={cancelEdit}>{t('tasks.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
