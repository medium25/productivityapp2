import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

// Consecutive-day milestones that award a streak trophy. A trophy is
// granted every time a fresh streak run reaches one of these — the same
// milestone can be earned again after a break and a new run.
export const STREAK_MILESTONES = [5, 10, 15, 25, 40, 50, 70, 100, 200, 365]

export const useTrophiesStore = create(
  persist(
    (set, get) => ({
      // { id, milestone, awardedAt } — permanent, never removed.
      streakTrophies: [],
      // Milestones already granted during the streak currently in progress,
      // so we don't re-award the same one every time this runs. Cleared
      // whenever the streak breaks.
      awardedInCurrentRun: [],

      checkStreakMilestones: (currentStreak) => {
        if (currentStreak <= 0) {
          if (get().awardedInCurrentRun.length > 0) set({ awardedInCurrentRun: [] })
          return
        }
        const awarded = get().awardedInCurrentRun
        const newlyReached = STREAK_MILESTONES.filter((m) => currentStreak >= m && !awarded.includes(m))
        if (newlyReached.length === 0) return
        const now = Date.now()
        const newTrophies = newlyReached.map((m) => ({ id: crypto.randomUUID(), milestone: m, awardedAt: now }))
        set((state) => ({
          streakTrophies: [...state.streakTrophies, ...newTrophies],
          awardedInCurrentRun: [...state.awardedInCurrentRun, ...newlyReached],
        }))
      },

      // { id, opponentEmail, awardedAt, myHours, opponentHours } — permanent.
      // Live competitions themselves are synced through Firestore directly
      // (see useCompetitionsStore) — this store only records the wins.
      competitionTrophies: [],

      addCompetitionTrophy: (trophy) => set((state) => ({
        competitionTrophies: [...state.competitionTrophies, { id: crypto.randomUUID(), ...trophy }],
      })),
    }),
    {
      name: 'productivity-hub-trophies',
      storage: createFirestoreStorage('productivity-hub-trophies'),
      skipHydration: true,
      partialize: (state) => ({
        streakTrophies: state.streakTrophies,
        awardedInCurrentRun: state.awardedInCurrentRun,
        competitionTrophies: state.competitionTrophies,
      }),
    }
  )
)
