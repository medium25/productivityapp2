import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useFocusHistoryStore, dateKey } from './useFocusHistoryStore'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

const PENALTY_PER_MISSED_DAY = 100

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const useFocusRankStore = create(
  persist(
    (set, get) => ({
      penalty: 0,
      lastProcessedDate: null,

      // Walks every day between the last check and yesterday, subtracting
      // 100 points for each one with no focus session at all. Today is
      // never judged — it isn't over yet. Safe to call repeatedly.
      reconcile: () => {
        const { lastProcessedDate, penalty } = get()
        const yesterday = addDays(startOfToday(), -1)

        if (!lastProcessedDate) {
          set({ lastProcessedDate: dateKey(yesterday) })
          return
        }

        if (lastProcessedDate === dateKey(yesterday)) return

        const [y, m, d] = lastProcessedDate.split('-').map(Number)
        const cursor = new Date(y, m - 1, d)
        cursor.setDate(cursor.getDate() + 1)

        const { seconds } = useFocusHistoryStore.getState()
        let addedPenalty = 0
        while (cursor <= yesterday) {
          const key = dateKey(cursor)
          if (!((seconds[key] || 0) > 0)) addedPenalty += PENALTY_PER_MISSED_DAY
          cursor.setDate(cursor.getDate() + 1)
        }

        set({ penalty: penalty + addedPenalty, lastProcessedDate: dateKey(yesterday) })
      },
    }),
    {
      name: 'productivity-hub-focus-rank',
      storage: createFirestoreStorage('productivity-hub-focus-rank'),
      skipHydration: true,
      partialize: (state) => ({ penalty: state.penalty, lastProcessedDate: state.lastProcessedDate }),
    }
  )
)
