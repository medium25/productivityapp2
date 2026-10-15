import { addDays, todayISO } from './taskLogic'

// The user's own hand-typed "Сегодня" reminders-to-self (per user request) —
// matched by exact title, not a stored task field, since these are plain
// Task records with no dedicated "routine" concept in the data model.
// Пресекать эти названия как маршрут + правило выполнения:
// - 'visit': открыть раздел И сразу считать выполненным (сам переход — это
//   и есть выполнение задачи).
// - иначе: только открыть раздел — выполнение живое/двустороннее (см.
//   syncRoutineTaskStatus below) и считается соответствующей страницей
//   самой (InsightsChat.jsx), когда там впрямь выполнено нужное условие.
export const ROUTINE_TASKS = {
  'Освежить инсайты': { route: '/insights', autoComplete: 'insights-all-checked' },
  'Добавить инсайты': { route: '/insights', autoComplete: 'insights-new-today' },
  'Дневник': { route: '/principles', autoComplete: 'principles-new-today' },
  'Фокус': { route: '/my-focus', autoComplete: 'visit' },
  'Очистить входящие': { route: '/reference-info', autoComplete: 'visit' },
  'Привычки': { route: '/habits', autoComplete: 'visit' },
  'Разбор проектов': { route: '/projects', autoComplete: 'visit' },
}

// Old routine titles that were renamed — existing task records still carry
// the old text, so they get renamed in place (see App.jsx's Layout).
export const LEGACY_ROUTINE_TITLES = {
  'Очистить не забыть': 'Очистить входящие',
}

// Marks a routine task done — and, since nothing today auto-recreates a
// finished task tomorrow otherwise (see useTasksStore's recurrence/
// spawn-on-complete engine), switches it to daily recurrence first if it
// isn't already, so tomorrow's occurrence spawns the moment this one does
// (per user request — "ежедневно эти задачи должны появляться").
export function completeRoutineTask(task, { updateTask, toggleTaskDone }) {
  if (task.recurrence !== 'daily') updateTask(task.id, { recurrence: 'daily' })
  toggleTaskDone(task.id)
}

// Live/two-way sync for the 3 activity-driven routine tasks (Освежить
// инсайты / Добавить инсайты / Дневник) — their done-state has to track
// whatever's actually true right now, not just flip on once. Per user
// report: checking a reminder box and then unchecking it again (while
// still reviewing) left the task permanently stuck "done" — a one-way
// toggleTaskDone latch doesn't match "выполненным считается когда..."
// (a live condition, not a one-time event). Un-completing goes through
// updateTask directly (no recurrence spawn); completing only spawns
// tomorrow's occurrence the first time, via completeRoutineTask — if
// tomorrow's copy already exists (criteria flipped true again after an
// earlier revert), it's just flipped done without spawning a duplicate.
export function syncRoutineTaskStatus(tasks, title, criteriaMet, { updateTask, toggleTaskDone }) {
  const today = todayISO()
  const tomorrow = addDays(today, 1)
  const current = tasks.find(
    (t) => t.title === title && t.status !== 'trashed' && (t.deadline || t.whenDate) === today
  )
  if (!current) return
  if (criteriaMet && current.status === 'active') {
    const alreadySpawnedTomorrow = tasks.some((t) => t.title === title && (t.deadline || t.whenDate) === tomorrow)
    if (alreadySpawnedTomorrow) {
      updateTask(current.id, { status: 'done', completedAt: new Date().toISOString() })
    } else {
      completeRoutineTask(current, { updateTask, toggleTaskDone })
    }
  } else if (!criteriaMet && current.status === 'done') {
    updateTask(current.id, { status: 'active', completedAt: null })
  }
}
