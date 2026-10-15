import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

// UTC-sliced, matching InsightsChat.jsx's own day-grouping
// (message.createdAt.slice(0, 10)) — the reminder batch needs to land in
// the exact same "today" bucket the chat itself already groups messages
// into, not a locally-midnight-shifted one.
function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

// Daily-rotating "flashback" cursor for the Insights chat — per user
// request, resurfaces old entries 20 at a time, one batch per calendar day,
// looping back to the start once the pool is exhausted (see InsightsChat.jsx
// for how the batch gets rendered). Advances by exactly one batch per
// newly-observed day, computed from the date rather than a live midnight
// timer — correct whenever the app happens to be opened, and a gap of
// several days advances by one batch, not backfilled per missed day.
export const useInsightsReminderStore = create(
  persist(
    (set, get) => ({
      cursorIndex: 0,
      lastAdvancedDate: null,
      advanceIfNewDay: (poolSize) => {
        const today = todayKey()
        const { lastAdvancedDate, cursorIndex } = get()
        if (lastAdvancedDate === today) return
        const batchCount = Math.max(1, Math.ceil(poolSize / 20))
        // First-ever run shows the first batch today rather than skipping
        // straight to the second — there's no "yesterday" to have already
        // shown batch 0.
        const nextIndex = lastAdvancedDate === null ? 0 : (cursorIndex + 1) % batchCount
        set({ cursorIndex: nextIndex, lastAdvancedDate: today })
      },
    }),
    {
      name: 'productivity-hub-insights-reminders',
      storage: createFirestoreStorage('productivity-hub-insights-reminders'),
      skipHydration: true,
      partialize: (state) => ({ cursorIndex: state.cursorIndex, lastAdvancedDate: state.lastAdvancedDate }),
    }
  )
)
