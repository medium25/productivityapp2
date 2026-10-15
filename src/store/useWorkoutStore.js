import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

// Weekly workout schedule + per-exercise progression log (see
// docs/superpowers/specs/2026-08-28-sport-tracker-design.md). Same
// Firestore-persisted shape as useHabitsStore.js — one document, hydrated
// on login via rehydrateStores.js, reset on sign-out.
export const useWorkoutStore = create(
  persist(
    (set) => ({
      // { [categoryId]: [{ id, name }] } — the user's own exercise names
      // per category, added once via "+ Add exercise" and reused every
      // week so an exercise's logged history has a stable key.
      exercises: {},

      // { [categoryId]: { [exerciseId]: [{ id, date, weight, reps, sets }] } }
      // Append-only — every logged session adds a new entry (in
      // chronological order, since date is always "now"), never
      // overwrites. "Last time" is simply the last item in that array.
      logs: {},

      // [{ id, date, distanceKm, paceMinPerKm, zone1Min, zone2Min, zone3Min }]
      // Append-only, one entry per run, across both running days (Tue/Sat)
      // — there's no per-day split, it's just "your runs" in order.
      runningLogs: [],

      addExercise: (categoryId, name) => {
        const trimmed = (name || '').trim()
        if (!trimmed) return
        set((state) => ({
          exercises: {
            ...state.exercises,
            [categoryId]: [
              ...(state.exercises[categoryId] || []),
              { id: crypto.randomUUID(), name: trimmed },
            ],
          },
        }))
      },

      // Also drops that exercise's own log history — an orphaned log with
      // no exercise to belong to would just be dead weight in storage.
      deleteExercise: (categoryId, exerciseId) => set((state) => {
        const categoryLogs = { ...(state.logs[categoryId] || {}) }
        delete categoryLogs[exerciseId]
        return {
          exercises: {
            ...state.exercises,
            [categoryId]: (state.exercises[categoryId] || []).filter((e) => e.id !== exerciseId),
          },
          logs: { ...state.logs, [categoryId]: categoryLogs },
        }
      }),

      logExercise: (categoryId, exerciseId, { weight, reps, sets }) => set((state) => {
        const categoryLogs = state.logs[categoryId] || {}
        const exerciseLogs = categoryLogs[exerciseId] || []
        return {
          logs: {
            ...state.logs,
            [categoryId]: {
              ...categoryLogs,
              [exerciseId]: [
                ...exerciseLogs,
                { id: crypto.randomUUID(), date: new Date().toISOString(), weight, reps, sets },
              ],
            },
          },
        }
      }),

      logRun: ({ distanceKm, paceMinPerKm, zone1Min, zone2Min, zone3Min }) => set((state) => ({
        runningLogs: [
          ...state.runningLogs,
          {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            distanceKm,
            paceMinPerKm,
            zone1Min,
            zone2Min,
            zone3Min,
          },
        ],
      })),
    }),
    {
      name: 'productivity-hub-workout',
      storage: createFirestoreStorage('productivity-hub-workout'),
      skipHydration: true,
      partialize: (state) => ({
        exercises: state.exercises,
        logs: state.logs,
        runningLogs: state.runningLogs,
      }),
    }
  )
)
