import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'
import { saveLocalMedia, deleteLocalMedia } from '../storage/localMedia'
import { useTelegramLinksStore } from './useTelegramLinksStore'

// Shared shape behind useInsightsStore and useReferenceInfoStore (see
// InsightsChat.jsx, made generic to take a `useStore` prop) — per user
// request, "Справочная информация" should look and behave exactly like
// Insights, so it gets the exact same text/photo/voice message feed
// instead of a different UI. Photo/voice/file blobs live in local
// IndexedDB keyed by message id (see storage/localMedia.js), not in
// per-section Firebase Storage folders, so the only thing that needs to
// stay unique per section here is `storageName`, the Firestore doc name.
// Photo messages still mirror to Telegram (per user request) even with no
// public URL to give it — see notifyTelegramPhoto below, which sends the
// actual bytes instead. Voice/file messages don't mirror at all yet.
export function createChatStore(storageName, persistOptions = {}) {
  // Mirror of new text messages to whichever Telegram channel this chat is
  // linked to (see Settings page -> TelegramLinkSetting.jsx ->
  // useTelegramLinksStore). One Apps Script web app URL for every chat
  // store — which channel a message lands in is resolved here,
  // client-side, per storageName, not on the server. See
  // docs/telegram-mirror.md. text/plain body on purpose —
  // application/json triggers a CORS preflight that Apps Script web apps
  // don't answer, so the request would just fail silently.
  //
  // Returns { chatId, telegramMessageId } once Telegram confirms the post,
  // so the local message can remember exactly where its mirror lives —
  // needed to delete that same Telegram message later (see deleteMessage).
  // Not fire-and-forget on purpose (unlike the delete call below): losing
  // this id silently would make deletion permanently impossible for that
  // message, not just delayed.
  const notifyTelegram = async (text) => {
    const webAppUrl = import.meta.env.VITE_TG_NOTIFY_URL
    const chatId = useTelegramLinksStore.getState().links[storageName]
    if (!webAppUrl || !chatId) return null
    try {
      const res = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'send', text, chatId }),
      })
      const data = await res.json()
      if (!data?.ok || !data.messageId) return null
      return { chatId, telegramMessageId: data.messageId }
    } catch (err) {
      console.error('Telegram mirror failed', err)
      return null
    }
  }

  // Photo messages have no public URL to hand Telegram (media lives in
  // local IndexedDB only, see storage/localMedia.js) — so the actual bytes
  // go over the wire instead, base64-encoded into the same text/plain POST
  // every other app->Telegram call already uses (keeps the no-CORS-
  // preflight trick intact). Apps Script's handleSendPhoto decodes it back
  // into a Blob and forwards it to Telegram's sendPhoto as multipart.
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result || '').toString().split(',')[1] || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  const notifyTelegramPhoto = async (file) => {
    const webAppUrl = import.meta.env.VITE_TG_NOTIFY_URL
    const chatId = useTelegramLinksStore.getState().links[storageName]
    if (!webAppUrl || !chatId) return null
    try {
      const photoBase64 = await fileToBase64(file)
      if (!photoBase64) return null
      const res = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'sendPhoto', chatId, photoBase64, mimeType: file.type || 'image/jpeg' }),
      })
      const data = await res.json()
      if (!data?.ok || !data.messageId) return null
      return { chatId, telegramMessageId: data.messageId }
    } catch (err) {
      console.error('Telegram photo mirror failed', err)
      return null
    }
  }

  // Fire-and-forget on purpose — the local message is already gone from
  // the chat by the time this runs, so there's nothing left to reconcile
  // if it fails; worst case a stray message lingers in the Telegram
  // channel.
  const deleteFromTelegram = (chatId, telegramMessageId) => {
    const webAppUrl = import.meta.env.VITE_TG_NOTIFY_URL
    if (!webAppUrl || !chatId || !telegramMessageId) return
    fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete', chatId, messageId: telegramMessageId }),
    }).catch((err) => console.error('Telegram delete failed', err))
  }

  const useStore = create(
    persist(
      (set, get) => ({
        messages: [], // { id, type: 'text'|'photo'|'voice'|'file', text, mediaUrl, mediaLocalKey, fileName, durationSec, createdAt, editedAt, done }

        // The composer's unsent text (per user request — it always needs to
        // be there, not just on this device). Used to live in
        // useUiPreferencesStore (plain localStorage, per-device only) —
        // moved into the Firestore-backed chat store itself so it survives
        // a device switch or cleared browser data exactly like every real
        // message already does.
        draft: '',
        setDraft: (draft) => set({ draft }),

        addTextMessage: async (text) => {
          const trimmed = (text || '').trim()
          if (!trimmed) return
          const id = crypto.randomUUID()
          set((state) => ({
            messages: [
              ...state.messages,
              {
                id,
                type: 'text',
                text: trimmed,
                mediaUrl: null,
                durationSec: null,
                createdAt: new Date().toISOString(),
                editedAt: null,
                done: false,
              },
            ],
          }))
          const telegram = await notifyTelegram(trimmed)
          if (!telegram) return
          // The message (or the whole chat) may have been deleted while the
          // Telegram round-trip was in flight — only attach the mirror id if
          // it's still there.
          set((state) => ({
            messages: state.messages.map((m) => (m.id === id ? { ...m, ...telegram } : m)),
          }))
        },

        addPhotoMessage: async (file) => {
          const id = crypto.randomUUID()
          let localKey
          try {
            localKey = await saveLocalMedia(id, file)
          } catch (err) {
            console.error('Failed to save photo locally', err)
            throw new Error('media-save-failed')
          }
          set((state) => ({
            messages: [
              ...state.messages,
              {
                id,
                type: 'photo',
                text: '',
                mediaUrl: null,
                mediaLocalKey: localKey,
                durationSec: null,
                createdAt: new Date().toISOString(),
                editedAt: null,
                done: false,
              },
            ],
          }))
          const telegram = await notifyTelegramPhoto(file)
          if (!telegram) return
          // Same "may have been deleted while the round-trip was in
          // flight" guard as addTextMessage — only attach the mirror id if
          // the message (or the whole chat) is still there.
          set((state) => ({
            messages: state.messages.map((m) => (m.id === id ? { ...m, ...telegram } : m)),
          }))
        },

        addVoiceMessage: async (blob, durationSec) => {
          const id = crypto.randomUUID()
          let localKey
          try {
            localKey = await saveLocalMedia(id, blob)
          } catch (err) {
            console.error('Failed to save voice message locally', err)
            throw new Error('media-save-failed')
          }
          set((state) => ({
            messages: [
              ...state.messages,
              {
                id,
                type: 'voice',
                text: '',
                mediaUrl: null,
                mediaLocalKey: localKey,
                durationSec,
                createdAt: new Date().toISOString(),
                editedAt: null,
                done: false,
              },
            ],
          }))
        },

        // Any pasted/dropped file that isn't an image (see InsightsChat.jsx's
        // onPaste) — same local-storage path as a photo, just keeps the
        // original filename since there's no thumbnail to show instead.
        addFileMessage: async (file) => {
          const id = crypto.randomUUID()
          let localKey
          try {
            localKey = await saveLocalMedia(id, file)
          } catch (err) {
            console.error('Failed to save file locally', err)
            throw new Error('media-save-failed')
          }
          set((state) => ({
            messages: [
              ...state.messages,
              {
                id,
                type: 'file',
                text: '',
                mediaUrl: null,
                mediaLocalKey: localKey,
                fileName: file.name || null,
                durationSec: null,
                createdAt: new Date().toISOString(),
                editedAt: null,
                done: false,
              },
            ],
          }))
        },

        toggleMessageDone: (id) => set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, done: !m.done } : m)),
        })),

        editMessage: (id, text) => {
          const trimmed = (text || '').trim()
          if (!trimmed) return
          set((state) => ({
            messages: state.messages.map((m) => (
              m.id === id ? { ...m, text: trimmed, editedAt: new Date().toISOString() } : m
            )),
          }))
        },

        deleteMessage: (id) => {
          const target = get().messages.find((m) => m.id === id)
          set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }))
          if (target?.mediaLocalKey) {
            deleteLocalMedia(target.mediaLocalKey).catch((err) => console.error('Failed to delete local media', err))
          }
          if (target?.telegramMessageId) {
            deleteFromTelegram(target.chatId, target.telegramMessageId)
          }
        },

        // Bulk version for InsightsChat's multi-select (per user request) —
        // one state update for the whole batch instead of N separate ones,
        // same per-message local-media/Telegram cleanup as deleteMessage.
        deleteMessages: (ids) => {
          const idSet = new Set(ids)
          if (idSet.size === 0) return
          const targets = get().messages.filter((m) => idSet.has(m.id))
          set((state) => ({ messages: state.messages.filter((m) => !idSet.has(m.id)) }))
          targets.forEach((target) => {
            if (target.mediaLocalKey) {
              deleteLocalMedia(target.mediaLocalKey).catch((err) => console.error('Failed to delete local media', err))
            }
            if (target.telegramMessageId) {
              deleteFromTelegram(target.chatId, target.telegramMessageId)
            }
          })
        },

        // A message posted directly in the linked Telegram channel (picked
        // up by useTelegramPoll.js), not something typed here — comes in
        // already carrying its chatId/telegramMessageId (see
        // docs/telegram-mirror.md) so deleteMessage above can remove it
        // from Telegram too later. Deliberately does NOT call
        // notifyTelegram — mirroring it back would echo the same message
        // into the channel forever.
        addIncomingTelegramMessage: (text, telegramMessageId, chatId) => {
          if (get().messages.some((m) => m.telegramMessageId === telegramMessageId)) return
          set((state) => ({
            messages: [
              ...state.messages,
              {
                id: crypto.randomUUID(),
                type: 'text',
                text,
                mediaUrl: null,
                durationSec: null,
                createdAt: new Date().toISOString(),
                editedAt: null,
                done: false,
                chatId,
                telegramMessageId,
              },
            ],
          }))
        },
      }),
      {
        name: storageName,
        storage: createFirestoreStorage(storageName),
        skipHydration: true,
        partialize: (state) => ({ messages: state.messages, draft: state.draft }),
        ...persistOptions,
      }
    )
  )

  // Exposed so useTelegramPoll.js (and TelegramLinkSetting.jsx) can go
  // from "which store is this" to "which Telegram link config row is
  // this" without every call site having to import/repeat the raw string.
  useStore.storageName = storageName
  return useStore
}
