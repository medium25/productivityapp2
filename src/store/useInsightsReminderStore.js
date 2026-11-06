import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

const BATCH_SIZE = 20

// UTC-sliced, matching InsightsChat.jsx's own day-grouping
// (message.createdAt.slice(0, 10)) — the reminder batch needs to land in
// the exact same "today" bucket the chat itself already groups messages
// into, not a locally-midnight-shifted one.
function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

// Daily "flashback" batch for the Insights chat — per user request,
// resurfaces old entries 20 at a time, one batch per calendar day, looping
// back to the start once the pool is exhausted (see InsightsChat.jsx for how
// the batch gets rendered). Insights that were not ticked in a day's batch
// come back first in the next day's batch; the rest of its 20 slots are
// filled from the rotation, which carries on after the last insight it
// reached. The batch is stored as message ids (and extends/changes only when
// a new day is first observed) — computed from the date rather than a live
// midnight timer, so it is right whenever the app happens to be opened, and
// a gap of several days advances by one batch, not backfilled per missed day.
export const useInsightsReminderStore = create(
  persist(
    (set, get) => ({
      cursorIndex: 0, // legacy: batch number in the old fixed-slice rotation
      lastAdvancedDate: null,
      batchIds: null,
      lastId: null, // last insight the rotation reached
      advanceIfNewDay: (messages) => {
        // Nothing to build from yet (data still loading) — don't burn the day.
        if (!messages || messages.length === 0) return
        const today = todayKey()
        const { lastAdvancedDate, cursorIndex, batchIds } = get()
        const n = messages.length
        const legacyStart = (cursorIndex % Math.max(1, Math.ceil(n / BATCH_SIZE))) * BATCH_SIZE
        const legacySlice = messages.slice(legacyStart, legacyStart + BATCH_SIZE)

        if (lastAdvancedDate === today) {
          // Today already decided. Only the old-format state has no ids yet.
          if (!batchIds) set({ batchIds: legacySlice.map((m) => m.id), lastId: legacySlice.length ? legacySlice[legacySlice.length - 1].id : null })
          return
        }

        const byId = new Map(messages.map((m) => [m.id, m]))
        let leftovers = []
        if (lastAdvancedDate) {
          if (batchIds) {
            leftovers = batchIds
              .map((id) => byId.get(id))
              .filter((m) => m && !(m.reviewDays && m.reviewDays.includes(lastAdvancedDate)))
          } else {
            leftovers = legacySlice.filter((m) => !m.done)
          }
        }
        const leftoverIds = new Set(leftovers.map((m) => m.id))

        let anchor = -1
        const { lastId } = get()
        if (lastId && byId.has(lastId)) anchor = messages.findIndex((m) => m.id === lastId)
        else if (!batchIds && lastAdvancedDate) anchor = Math.min(n, legacyStart + BATCH_SIZE) - 1

        const need = Math.max(0, BATCH_SIZE - leftovers.length)
        const picked = []
        for (let i = 1; i <= n && picked.length < need; i++) {
          const m = messages[(((anchor + i) % n) + n) % n]
          if (!leftoverIds.has(m.id)) picked.push(m)
        }
        const batch = [...leftovers, ...picked]
        set({
          batchIds: batch.map((m) => m.id),
          lastId: picked.length ? picked[picked.length - 1].id : lastId,
          lastAdvancedDate: today,
        })
      },
    }),
    {
      name: 'productivity-hub-insights-reminders',
      storage: createFirestoreStorage('productivity-hub-insights-reminders'),
      skipHydration: true,
      partialize: (state) => ({
        cursorIndex: state.cursorIndex,
        lastAdvancedDate: state.lastAdvancedDate,
        batchIds: state.batchIds,
        lastId: state.lastId,
      }),
    }
  )
)
