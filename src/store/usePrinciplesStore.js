import { createChatStore } from './createChatStore'
import { computeDailyPrinciplesReset, todayISO } from '../features/tasks/taskLogic'

// "Анализ" (formerly "Принципы") — switched from a table-with-checkmarks
// UI to the exact same text/photo/voice chat feed as Data/Insights (per
// user request: "один в один скопировать логику чата из Data"). The old
// shape was `{ items: [{ id, text, createdAt, readDates }] }`; `migrate`
// below runs once per account to carry each existing principle over as a
// plain text message so nothing already written gets silently dropped.
// Telegram mirror (linked per-chat from Settings, see
// TelegramLinkSetting.jsx / docs/telegram-mirror.md) reads this store's
// link by its storageName — nothing to configure here.

// Fixed daily journal prompt, posted above the checklist on every reset
// (see docs/superpowers/specs/2026-08-29-daily-principles-reset-design.md)
// — not user-editable, so an exact string match is enough to find and
// replace yesterday's copy in computeDailyPrinciplesReset.
export const PRINCIPLES_PROMPT =
  'Расскажи про главные события и мысли вчерашнего дня\n\nРасскажи про планы на ближайшее будущее'

export const usePrinciplesStore = createChatStore('productivity-hub-principles', {
  version: 1,
  migrate: (persistedState) => {
    if (persistedState?.items && !persistedState.messages) {
      return {
        messages: persistedState.items.map((it) => ({
          id: it.id,
          type: 'text',
          text: it.text,
          mediaUrl: null,
          durationSec: null,
          createdAt: it.createdAt,
          editedAt: null,
          done: false,
        })),
        draft: '',
      }
    }
    return persistedState
  },
  // Runs once after rehydrateAllPersistedStores() reads the saved chat
  // back from Firestore (see ../store/rehydrateStores.js) — same "mutate
  // `state` in place" pattern useFocusTimerStore.js uses for its own
  // once-per-rehydrate catch-up logic. Delegates the actual decision/
  // transform to the pure computeDailyPrinciplesReset so it stays testable
  // without a live store.
  onRehydrateStorage: () => (state, error) => {
    if (error || !state) return
    const result = computeDailyPrinciplesReset(
      state.messages || [],
      state.lastPrinciplesReset,
      todayISO(),
      PRINCIPLES_PROMPT
    )
    if (!result) return
    state.messages = result.messages
    state.lastPrinciplesReset = result.lastPrinciplesReset
  },
})
