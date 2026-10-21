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

export function rehydrateAllPersistedStores() {
  PERSISTED_STORES.forEach((store) => store.persist.rehydrate())
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
