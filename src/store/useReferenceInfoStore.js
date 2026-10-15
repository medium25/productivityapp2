import { createChatStore } from './createChatStore'

// "Справочная информация" (see InsightsChat.jsx) — per user request, made
// to look and behave exactly like Insights instead of a card-notes UI —
// same text/photo/voice feed, its own Firestore doc.
// Telegram mirror (linked per-chat from Settings, see
// TelegramLinkSetting.jsx / docs/telegram-mirror.md) reads this store's
// link by its storageName — nothing to configure here.
export const useReferenceInfoStore = createChatStore('productivity-hub-reference-info')
