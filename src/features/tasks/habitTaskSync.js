import { todayISO } from './taskLogic'

// Links a Today recurring task to a habit of the same title (per user
// request — see docs/superpowers/specs/2026-10-14-habit-task-sync-design.md)
// so checking either one off, or adding either one, keeps the other in
// step. Same exact-title convention dailyRoutineTasks.js already uses for
// its own routine-task matching — no stored link id. A non-recurring task
// never links, even on a name match: a habit is inherently repeating, a
// one-off task isn't habit-shaped.
// A recurring task counts as a habit only when it was made in «Мой день» (createdIn 'myday'; old
// tasks with no marker keep working as before). Repeating tasks made in «Задачи» or anywhere
// else ('tasks' / 'other') stay plain tasks — they never create, join or sync with a habit.
export function isHabitTask(task) {
  return !!task.recurrence && task.recurrence !== 'none' && task.createdIn !== 'tasks' && task.createdIn !== 'other'
}

export function findLinkedHabit(habits, title) {
  return habits.find((h) => h.title === title)
}

export function findLinkedTodayTask(tasks, title, today = todayISO()) {
  return tasks.find((t) => (
    t.title === title
    && isHabitTask(t)
    && t.status !== 'trashed'
    && (t.deadline || t.whenDate) === today
  ))
}

// Called right after a Today task's own done-state changes (see
// UpcomingPage's taskProps.onToggleDone) — keeps the same-named habit's
// today cell in step. Uses setCompletion (a plain set, not toggleCompletion's
// flip) so a rapid double-click on either side can't desync the two.
export function syncHabitForTask(task, nowDone, { habits, setCompletion }) {
  if (!isHabitTask(task)) return
  const habit = findLinkedHabit(habits, task.title)
  if (!habit) return
  const today = todayISO()
  if (!!habit.completions[today] !== nowDone) setCompletion(habit.id, today, nowDone)
}

// Called right after a habit's own checkmark changes (see HabitsPage) —
// keeps today's same-named recurring task's done-state in step. Only
// `today` ever pushes into tasks: a recurring task's live record only ever
// represents today (see useTasksStore's rollRecurringToToday), so there's
// nothing on the task side for a past/future date-strip cell to sync to.
// Completing goes through toggleTaskDone so the usual next-occurrence spawn
// still happens, same as if the user had checked the task itself;
// un-completing goes through updateTask directly (no spawn) — the same
// done/undone asymmetry dailyRoutineTasks.js's syncRoutineTaskStatus
// already relies on.
export function syncTaskForHabit(habit, dateIso, nowDone, { tasks, toggleTaskDone, updateTask }) {
  if (dateIso !== todayISO()) return
  const task = findLinkedTodayTask(tasks, habit.title)
  if (!task) return
  const taskDone = task.status === 'done'
  if (taskDone === nowDone) return
  if (nowDone) toggleTaskDone(task.id)
  else updateTask(task.id, { status: 'active', completedAt: null })
}

// Adding a habit also ensures today has a matching task (per user request,
// "и добавление задач тоже"). If one already exists today under that exact
// title it's promoted to the habit's recurrence instead of creating a
// duplicate row.
export function spawnTaskForHabit(habit, { tasks, addTask, updateTask }) {
  const today = todayISO()
  const existing = tasks.find((t) => (
    t.title === habit.title && t.status !== 'trashed' && (t.deadline || t.whenDate) === today
  ))
  if (existing) {
    // A same-named task made elsewhere stays a plain task — it does not join the habit.
    if (existing.createdIn === 'tasks' || existing.createdIn === 'other') return
    if (!existing.recurrence || existing.recurrence === 'none') {
      updateTask(existing.id, { recurrence: habit.recurrence, recurrenceDays: habit.recurrenceDays || null })
    }
    return
  }
  addTask({
    title: habit.title,
    stage: 'tasks',
    createdIn: 'myday',
    whenDate: today,
    recurrence: habit.recurrence,
    recurrenceDays: habit.recurrenceDays || null,
  })
}

// A Today task becomes "habit-shaped" the moment its recurrence is set away
// from 'none' (see UpcomingPage's onSetCycle) — spawns the matching habit
// if none exists yet under that exact title.
export function spawnHabitForTask(task, { habits, addHabit }) {
  if (!isHabitTask(task)) return
  if (findLinkedHabit(habits, task.title)) return
  addHabit(task.title, task.recurrence, task.recurrenceDays || [], undefined, null, 'myday')
}
