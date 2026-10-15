// Wraps a zustand-persist-compatible storage so most writes just update an
// in-memory pending value instead of hitting Firestore on every set() call —
// only flushed at most once per minIntervalMs, plus whenever the caller
// explicitly calls the returned `flush()` (e.g. on a meaningful state
// transition, or when the tab is hidden/closing), so real progress is never
// lost by more than a few seconds even under a per-second tick that would
// otherwise write on every single tick (see useFocusTimerStore.js and
// useFocusHistoryStore.js, both driven by the same 1-second Pomodoro tick).
export function createThrottledStorage(baseStorage, minIntervalMs) {
  let lastFlushAt = 0
  let pendingName = null
  let pendingValue
  let pendingTimer = null

  const flush = () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    if (pendingValue === undefined) return
    const name = pendingName
    const value = pendingValue
    pendingValue = undefined
    lastFlushAt = Date.now()
    baseStorage.setItem(name, value)
  }

  return {
    getItem: (name) => baseStorage.getItem(name),
    removeItem: (name) => baseStorage.removeItem(name),
    setItem: (name, value) => {
      pendingName = name
      pendingValue = value
      const elapsed = Date.now() - lastFlushAt
      if (elapsed >= minIntervalMs) {
        flush()
      } else if (!pendingTimer) {
        pendingTimer = setTimeout(flush, minIntervalMs - elapsed)
      }
    },
    flush,
  }
}
