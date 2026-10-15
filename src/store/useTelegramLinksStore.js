import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

// Tells Apps Script which chat_id maps to which storageName (its
// CHAT_TO_STORAGE reverse map, see docs/telegram-mirror.md) — needed so an
// incoming channel post can be routed back to the right chat. Fire-and-forget:
// if this fails, incoming-message polling for that chat just silently finds
// nothing (same failure mode as the link never having been set), nothing
// else breaks.
const syncLinkToAppsScript = (action, chatId, storageName) => {
  const webAppUrl = import.meta.env.VITE_TG_NOTIFY_URL
  if (!webAppUrl || !chatId) return
  fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, chatId, storageName }),
  }).catch((err) => console.error('Telegram link sync failed', err))
}

// Which chat store (by its Firestore storageName, e.g.
// 'productivity-hub-reference-info') mirrors to which Telegram chat_id —
// set from the Settings page (see TelegramLinkSetting.jsx), read by
// createChatStore.js's notifyTelegram. Kept as its own tiny store instead
// of living inside useSettingsStore since it's unrelated to app-display
// settings and only createChatStore.js needs to read it.
export const useTelegramLinksStore = create(
  persist(
    (set, get) => ({
      links: {}, // { [storageName]: chatId }

      setLink: (storageName, chatId) => {
        const trimmed = (chatId || '').trim()
        const previous = get().links[storageName]
        set((state) => {
          const links = { ...state.links }
          if (trimmed) links[storageName] = trimmed
          else delete links[storageName]
          return { links }
        })
        // Relinking to a different chat, or unlinking outright, leaves a
        // stale reverse-map entry on the server unless the old chatId is
        // explicitly cleared first — otherwise posts in the old channel
        // would keep getting routed into this chat forever.
        if (previous && previous !== trimmed) syncLinkToAppsScript('unlink', previous, storageName)
        if (trimmed) syncLinkToAppsScript('link', trimmed, storageName)
      },
    }),
    {
      name: 'productivity-hub-telegram-links',
      storage: createFirestoreStorage('productivity-hub-telegram-links'),
      skipHydration: true,
      partialize: (state) => ({ links: state.links }),
    }
  )
)
