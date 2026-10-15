import { createChatStore } from './createChatStore'

// The Insights column's personal notes feed (see InsightsChat.jsx) — text,
// photo, and voice messages, all "from me" (there's no second party in a
// solo notes feed). See createChatStore.js for the shared shape with
// useReferenceInfoStore.
//
// Telegram mirror (linked per-chat from Settings, see
// TelegramLinkSetting.jsx / docs/telegram-mirror.md) reads this store's
// link by its storageName — nothing to configure here.
export const useInsightsStore = createChatStore('productivity-hub-insights')
