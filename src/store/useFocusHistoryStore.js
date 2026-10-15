import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'
import { createThrottledStorage } from '../firebase/throttledStorage'

export function dateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// addSecond() below fires on every 1-second Pomodoro tick while a work
// session runs (see useFocusTimerStore.js `_tick`) — writing to Firestore on
// every single tick would be ~3600 writes/hour of active focus time alone,
// easily exhausting the free-tier daily write quota by itself. Throttled the
// same way the session store already is: most ticks just update an
// in-memory pending value, flushed at most once per HISTORY_SAVE_INTERVAL_MS
// (plus immediately on tab-hide/close, so a graceful close never loses
// anything). 60s matches useFocusTimerStore's interval — only a true crash
// loses up to a minute of history for the day, which doesn't meaningfully
// move rank/stats. Shortening this multiplies the write cost of every
// minute of active focus time across every user of the app.
const HISTORY_SAVE_INTERVAL_MS = 60 * 1000

const focusHistoryStorage = createThrottledStorage(
  createFirestoreStorage('productivity-hub-focus-history'),
  HISTORY_SAVE_INTERVAL_MS
)

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) focusHistoryStorage.flush()
  })
  window.addEventListener('pagehide', () => focusHistoryStorage.flush())
}

export const useFocusHistoryStore = create(
  persist(
    (set) => ({
      // { 'YYYY-MM-DD': totalSecondsFocused }
      seconds: {},
      // { 'YYYY-MM-DD': { [projectId]: secondsFocused } }
      byProject: {},
      // { [projectId]: completedWorkCycles } — all-time total
      cycles: {},
      // { 'YYYY-MM-DD': { [projectId]: completedWorkCycles } } — same total,
      // broken out by day so the Statistics "sessions" view can respect the
      // day/week/month/year range picker the same way duration already does.
      cyclesByDate: {},
      // { 'YYYY-MM-DD': count } — breaks skipped, capped at 3/day in
      // useFocusTimerStore.skipBreak.
      breakSkips: {},
      incrementBreakSkip: (key) => set((state) => ({
        breakSkips: { ...state.breakSkips, [key]: (state.breakSkips[key] || 0) + 1 },
      })),
      addSecond: (key, projectId) => set((state) => ({
        seconds: { ...state.seconds, [key]: (state.seconds[key] || 0) + 1 },
        byProject: {
          ...state.byProject,
          [key]: {
            ...(state.byProject[key] || {}),
            [projectId]: ((state.byProject[key] || {})[projectId] || 0) + 1,
          },
        },
      })),
      incrementCycle: (key, projectId) => set((state) => ({
        cycles: { ...state.cycles, [projectId]: (state.cycles[projectId] || 0) + 1 },
        cyclesByDate: {
          ...state.cyclesByDate,
          [key]: {
            ...(state.cyclesByDate[key] || {}),
            [projectId]: ((state.cyclesByDate[key] || {})[projectId] || 0) + 1,
          },
        },
      })),
    }),
    {
      name: 'productivity-hub-focus-history',
      storage: focusHistoryStorage,
      skipHydration: true,
      partialize: (state) => ({
        seconds: state.seconds,
        byProject: state.byProject,
        cycles: state.cycles,
        cyclesByDate: state.cyclesByDate,
        breakSkips: state.breakSkips,
      }),
    }
  )
)
