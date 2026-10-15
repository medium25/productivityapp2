import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'
import { createThrottledStorage } from '../firebase/throttledStorage'
import { SURAHS, TOTAL_AYAHS, getSurah } from '../features/quran/surahs'

export function dateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// addListenedSeconds() fires once a second while a surah is playing (see
// QuranPlayer.jsx) — same reasoning as useFocusHistoryStore: a Firestore
// write per tick would burn the free-tier quota, so the storage is
// throttled to one write a minute, flushed on tab-hide/close so a graceful
// close never loses more than a few seconds.
const QURAN_SAVE_INTERVAL_MS = 60 * 1000
const quranStorage = createThrottledStorage(
  createFirestoreStorage('productivity-hub-quran'),
  QURAN_SAVE_INTERVAL_MS
)

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) quranStorage.flush()
  })
  window.addEventListener('pagehide', () => quranStorage.flush())
}

export function flushQuranStore() {
  quranStorage.flush()
}

// Where the user is in the Quran recitation (see QuranPlayer.jsx) — kept in
// Firestore, not local storage, so "resume where you left off" works on a
// second device too, per user request.
//
//   currentSurah  1-114, the one that opens/resumes when the player mounts
//   position      seconds into currentSurah's audio to seek to on resume
//   completed     { [n]: true } — surahs listened all the way through
//   furthest      { [n]: seconds } — furthest point reached in each surah
//   listened      { 'YYYY-MM-DD': seconds } — time spent actually playing,
//                 per day, for the "how long did I listen" stat + chart
export const useQuranStore = create(
  persist(
    (set, get) => ({
      currentSurah: 1,
      position: 0,
      completed: {},
      furthest: {},
      listened: {},
      // How many times the whole Quran has been finished — bumped the moment
      // the 114th surah gets marked done (by playback or by hand), at which
      // point `completed`/`furthest` wipe so the next khatm starts clean.
      khatms: 0,
      // Echo/reverb amount for the recitation, 0-100 (see QuranPlayer's Web
      // Audio graph). A listening preference, persisted like the rest.
      echo: 0,

      // Switching surahs from the list — resets the resume position (a new
      // surah starts at 0), the old surah's `furthest` is untouched so its
      // progress bar stays.
      selectSurah: (n) => set({ currentSurah: n, position: 0 }),

      // Called on a throttle while playing, and on pause/unmount — just the
      // resume point, cheap to write often.
      savePosition: (seconds) => {
        const n = get().currentSurah
        const secs = Math.max(0, Math.floor(seconds))
        set((state) => ({
          position: secs,
          furthest: {
            ...state.furthest,
            [n]: Math.max(state.furthest[n] || 0, secs),
          },
        }))
      },

      // One playing second elapsed (QuranPlayer's 1s interval) — bumps
      // today's listened total.
      addListenedSecond: () => {
        const key = dateKey()
        set((state) => ({
          listened: { ...state.listened, [key]: (state.listened[key] || 0) + 1 },
        }))
      },

      // Surah finished — mark it done and roll to the next one. Finishing
      // the 114th completes a khatm: count it and wipe the board so the
      // caller loops straight back to Al-Fatiha. Returns the surah to play
      // next (always truthy — 1 after a khatm), or null if there's nothing
      // to advance to.
      completeAndAdvance: () => {
        const n = get().currentSurah
        let result = null
        set((state) => {
          const completed = { ...state.completed, [n]: true }
          const furthest = { ...state.furthest, [n]: Infinity }
          if (SURAHS.every((s) => completed[s.n])) {
            result = 1
            return { completed: {}, furthest: {}, khatms: state.khatms + 1, currentSurah: 1, position: 0 }
          }
          const next = n < 114 ? n + 1 : n
          result = next === n ? null : next
          return { completed, furthest, currentSurah: next, position: 0 }
        })
        return result
      },

      // Manual toggle from the list (checkbox) — lets someone mark a surah
      // they already know by heart without sitting through it. Ticking the
      // last missing box also completes a khatm and clears the board.
      toggleCompleted: (n) => set((state) => {
        const done = !state.completed[n]
        const completed = { ...state.completed, [n]: done }
        const furthest = { ...state.furthest, [n]: done ? Infinity : (state.furthest[n] || 0) }
        if (done && SURAHS.every((s) => completed[s.n])) {
          return { completed: {}, furthest: {}, khatms: state.khatms + 1 }
        }
        return { completed, furthest }
      }),

      setEcho: (v) => set({ echo: Math.max(0, Math.min(100, Math.round(v))) }),

      // Progress only — the khatm tally is a lifetime count, left alone.
      resetProgress: () => set({ currentSurah: 1, position: 0, completed: {}, furthest: {}, listened: {} }),
    }),
    {
      name: 'productivity-hub-quran',
      storage: quranStorage,
      skipHydration: true,
      partialize: (state) => ({
        currentSurah: state.currentSurah,
        position: state.position,
        completed: state.completed,
        furthest: state.furthest,
        listened: state.listened,
        khatms: state.khatms,
        echo: state.echo,
      }),
    }
  )
)

// Overall "% of the Quran listened", weighted by ayah count so finishing
// Al-Baqara (286 ayahs) moves the bar far more than An-Nasr (3). Uses the
// `completed` map only — a half-listened surah doesn't count yet.
export function quranPercent(completed) {
  const doneAyahs = SURAHS.reduce((sum, s) => sum + (completed[s.n] ? s.ayahs : 0), 0)
  return Math.round((doneAyahs / TOTAL_AYAHS) * 100)
}

export function completedCount(completed) {
  return SURAHS.filter((s) => completed[s.n]).length
}

export { getSurah }
