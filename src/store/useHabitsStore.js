import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'
import { COLOR_PALETTE } from '../constants/colorPalette'

// The Habits section (see HabitsPage.jsx) — a small, separate list from the
// main tasks store since a habit isn't a one-off task: it repeats every day
// forever and tracks a per-day done/not-done map instead of a single
// status, which the task model has no room for.
export const useHabitsStore = create(
  persist(
    (set) => ({
      // { id, title, createdAt, color, recurrence: 'daily'|'weekly'|'monthly'|
      //   'custom', recurrenceDays: [0-6] (only meaningful for 'custom'),
      //   targetDays: number|null (total days planned for the habit, e.g.
      //   "30 дней пить магний" — separate from how often it repeats),
      //   completions: { 'YYYY-MM-DD': true } }
      habits: [],

      // recurrence/recurrenceDays per user request ("выделять количество
      // дней для привычек, также цикличность") — same shape as a task's own
      // recurrence fields (see taskLogic.js's RECURRENCE_OPTIONS/WEEKDAYS),
      // so HabitsPage's picker can reuse that exact UI. `color` defaults to
      // cycling the same shared palette projects use (see
      // useTasksStore.js's addProject) — per user request, a habit's own
      // "done" color no longer has to be the fixed red every row used
      // before.
      addHabit: (title, recurrence = 'daily', recurrenceDays = [], color, targetDays = null) => {
        const trimmed = (title || '').trim()
        if (!trimmed) return
        set((state) => ({
          habits: [
            ...state.habits,
            {
              id: crypto.randomUUID(),
              title: trimmed,
              createdAt: new Date().toISOString(),
              color: color || COLOR_PALETTE[state.habits.length % COLOR_PALETTE.length],
              recurrence,
              recurrenceDays,
              targetDays,
              completions: {},
            },
          ],
        }))
      },

      // Rename/re-cycle/re-color an existing habit (see HabitsPage.jsx's
      // inline edit form) — everything except id/createdAt/completions is
      // fair game, same "just spread the patch in" shape as
      // useTasksStore.js's updateTask.
      updateHabit: (id, patch) => set((state) => ({
        habits: state.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      })),

      deleteHabit: (id) => set((state) => ({ habits: state.habits.filter((h) => h.id !== id) })),

      // Drag-to-reorder (see useDragReorder.jsx, grab-anywhere-on-the-card
      // per user request) — habits are always rendered as one flat list, so
      // (unlike reorderTasks's subset-reslotting) the new order just
      // replaces the array outright, same as reorderProjects.
      reorderHabits: (orderedIds) => set((state) => {
        const byId = new Map(state.habits.map((h) => [h.id, h]))
        return { habits: orderedIds.map((id) => byId.get(id)).filter(Boolean) }
      }),

      // Toggles just the one date — a habit's "done" state is per-day, not
      // a single flag like a task's, so every date strip cell needs its own
      // independent on/off.
      toggleCompletion: (id, dateIso) => set((state) => ({
        habits: state.habits.map((h) => {
          if (h.id !== id) return h
          const completions = { ...h.completions }
          if (completions[dateIso]) delete completions[dateIso]
          else completions[dateIso] = true
          return { ...h, completions }
        }),
      })),

      // Explicit set (not a flip) for the same per-day map — used by the
      // Task<->Habit done-sync (see habitTaskSync.js) so a rapid double
      // toggle on the task side can't leave the habit's cell out of step.
      setCompletion: (id, dateIso, done) => set((state) => ({
        habits: state.habits.map((h) => {
          if (h.id !== id) return h
          const completions = { ...h.completions }
          if (done) completions[dateIso] = true
          else delete completions[dateIso]
          return { ...h, completions }
        }),
      })),
    }),
    {
      name: 'productivity-hub-habits',
      storage: createFirestoreStorage('productivity-hub-habits'),
      skipHydration: true,
      partialize: (state) => ({ habits: state.habits }),
    }
  )
)
