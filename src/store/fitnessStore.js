import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Fitness store: workout entries logged by the user.
// Persisted to localStorage so entries survive a reload.
// Each workout entry has the shape:
//   { id, type, date, durationMin, calories, notes }
// - id: string, generated with crypto.randomUUID()
// - type: one of 'run' | 'walk' | 'gym' | 'cycling' | 'swim' | 'other'
//   (see src/constants/workoutTypes.js)
// - date: ISO date string, 'YYYY-MM-DD'
// - durationMin: number (minutes)
// - calories: number
// - notes: string, optional, defaults to ''
export const useFitnessStore = create(
  persist(
    (set) => ({
      workouts: [],

      addWorkout: (entry) =>
        set((state) => ({
          workouts: [
            ...state.workouts,
            {
              id: crypto.randomUUID(),
              notes: '',
              ...entry,
            },
          ],
        })),

      updateWorkout: (id, patch) =>
        set((state) => ({
          workouts: state.workouts.map((workout) =>
            workout.id === id ? { ...workout, ...patch } : workout,
          ),
        })),

      deleteWorkout: (id) =>
        set((state) => ({
          workouts: state.workouts.filter((workout) => workout.id !== id),
        })),
    }),
    {
      name: 'productivity-hub-fitness',
    },
  ),
)

export default useFitnessStore
