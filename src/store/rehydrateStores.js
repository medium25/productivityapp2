import { getCurrentUid } from '../firebase/currentUid'
import { clearDirtyKeys, invalidateAppDataCache, isDirtyKey, primeAppData, readCachedAppData, readServerAppData, replayOutbox, setMergedHandler } from '../firebase/firestoreStorage'
import { useSettingsStore } from './useSettingsStore'
import { useFocusStore } from './useFocusStore'
import { useFocusHistoryStore } from './useFocusHistoryStore'
import { useFocusRankStore } from './useFocusRankStore'
import { useTrophiesStore } from './useTrophiesStore'
import { useFocusTimerStore } from './useFocusTimerStore'
import { useTasksStore, clearTasksUndoHistory } from './useTasksStore'
import { useCustomSectionsStore } from './useCustomSectionsStore'
import { useInsightsStore } from './useInsightsStore'
import { useInsightsReminderStore } from './useInsightsReminderStore'
import { useHabitsStore } from './useHabitsStore'
import { useChatColorsStore } from './useChatColorsStore'
import { useTokovininStore } from './useTokovininStore'
import { useFinanceStore } from './useFinanceStore'
import { usePrinciplesStore } from './usePrinciplesStore'
import { useReferenceInfoStore } from './useReferenceInfoStore'
import { useTelegramLinksStore } from './useTelegramLinksStore'
import { useWorkoutStore } from './useWorkoutStore'
import { useQaydlarStore, useKnowledgeStore } from './useQaydlarStore'
import { useQuranStore } from './useQuranStore'
import { stopQuranEngine } from '../audio/quranAudioEngine'
import { SPORT_DAY_CHAT_STORES } from './useSportDayChatStore'

// Every store persisted through the Firestore-backed storage (see
// ../firebase/firestoreStorage.js) needs to be re-hydrated once we know
// which account is signed in, and reset to defaults on sign-out so a second
// account never briefly sees the first account's in-memory data.
const PERSISTED_STORES = [
  useSettingsStore,
  useFocusStore,
  useFocusHistoryStore,
  useFocusRankStore,
  useTrophiesStore,
  useFocusTimerStore,
  useTasksStore,
  useCustomSectionsStore,
  useInsightsStore,
  useInsightsReminderStore,
  useHabitsStore,
  useChatColorsStore,
  useTokovininStore,
  useFinanceStore,
  usePrinciplesStore,
  useReferenceInfoStore,
  useTelegramLinksStore,
  useWorkoutStore,
  useQaydlarStore,
  useKnowledgeStore,
  useQuranStore,
  ...SPORT_DAY_CHAT_STORES,
]

// After a save had to be merged with newer work from another device, the store re-reads the
// merged document so this device shows it too.
setMergedHandler((key) => {
  const store = PERSISTED_STORES.find((st) => st.persist.getOptions().storage?.__key === key)
  if (!store || store === useFocusTimerStore) return
  invalidateAppDataCache()
  store.persist.rehydrate()
})

// Fast start. Every store's data is first read from this device's own copy of
// Firestore (IndexedDB — milliseconds, no network), so the app can open at once
// with everything on screen; then the server is asked in the background and only
// the stores whose data actually changed (e.g. edited on the other device) are
// re-hydrated — never one the user has already touched here. On a device with
// no local copy yet the first read has to come from the server.
// Returns { ready, refreshed }: `ready` resolves when the stores hold data (open
// the app then); `refreshed` when the background server sync has finished.
export function rehydrateAllPersistedStores() {
  const uid = getCurrentUid()
  invalidateAppDataCache()
  clearDirtyKeys()

  const hydrateAll = (stores) => Promise.allSettled(stores.map((store) => store.persist.rehydrate()))

  let cached = null
  const ready = (async () => {
    try { cached = uid ? await readCachedAppData(uid) : null } catch { cached = null }
    if (cached) primeAppData(uid, cached)
    else invalidateAppDataCache() // nothing local: each store reads from the server
    await hydrateAll(PERSISTED_STORES)
  })()

  const refreshed = ready.then(async () => {
    // Saves left from an earlier session (offline edits) go out first, merged with the cloud.
    if (uid) {
      try {
        const replayed = await replayOutbox(uid)
        if (replayed.length) { invalidateAppDataCache(); await hydrateAll(PERSISTED_STORES.filter((st) => replayed.includes(st.persist.getOptions().storage?.__key) && st !== useFocusTimerStore)) }
      } catch { /* kept in the outbox */ }
    }
    if (!cached || !uid) return
    let fresh
    try { fresh = await readServerAppData(uid) } catch { return }
    if (getCurrentUid() !== uid) return // signed out / switched account meanwhile
    const changed = PERSISTED_STORES.filter((store) => {
      if (store === useFocusTimerStore) return false // live countdown runs in this tab
      const key = store.persist.getOptions().storage?.__key
      if (!key || isDirtyKey(key)) return false
      return JSON.stringify(fresh.get(key)) !== JSON.stringify(cached.get(key))
    })
    if (changed.length === 0) return
    primeAppData(uid, fresh)
    await hydrateAll(changed)
  }).catch(() => {})

  return { ready, refreshed }
}

// Re-read every store from Firestore without signing out — pulls in changes
// made on another device (stores only read their document once, at login).
// The focus timer is skipped: it runs a live countdown/sound in this tab and
// this tab's copy is the one being written, not a stale one.
export function refreshPersistedStores() {
  invalidateAppDataCache()
  clearDirtyKeys()
  return Promise.all(
    PERSISTED_STORES.filter((store) => store !== useFocusTimerStore).map((store) => store.persist.rehydrate()),
  )
}

export function resetAllStores() {
  // useFocusTimerStore keeps a live setInterval/ambient sound/ringtone
  // running outside React — a plain setState wouldn't stop any of that, so
  // signing out mid-session would leave last account's countdown and audio
  // running in the background. finish() is the existing "stop everything
  // cleanly" action, reused here for that side effect.
  useFocusTimerStore.getState().finish()
  stopQuranEngine()
  clearTasksUndoHistory()
  PERSISTED_STORES.forEach((store) => store.setState(store.getInitialState(), true))
}
