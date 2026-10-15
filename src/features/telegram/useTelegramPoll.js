import { useEffect } from 'react'
import { useTelegramLinksStore } from '../../store/useTelegramLinksStore'

const POLL_INTERVAL_MS = 15000

// While a chat page linked to Telegram is open, periodically asks Apps
// Script (see docs/telegram-mirror.md) for any human-posted channel
// messages it queued up since the last poll, and drops them into the
// chat via addIncomingTelegramMessage — same store action used for every
// other message type, so they render, sync to Firestore, and can be
// deleted (which also removes them from Telegram) exactly like any other
// message.
//
// This is polling, not a push — up to POLL_INTERVAL_MS of lag is expected
// and fine for this use case (no websocket/webhook-to-client path exists
// here). Only runs while the given chat's page is actually mounted.
export function useTelegramPoll(useStore) {
  const storageName = useStore.storageName

  useEffect(() => {
    const webAppUrl = import.meta.env.VITE_TG_NOTIFY_URL
    if (!webAppUrl || !storageName) return undefined

    let cancelled = false

    const poll = async () => {
      const chatId = useTelegramLinksStore.getState().links[storageName]
      if (!chatId) return
      try {
        const url = `${webAppUrl}?action=poll&storageName=${encodeURIComponent(storageName)}`
        const res = await fetch(url)
        const data = await res.json()
        if (cancelled || !data?.ok || !Array.isArray(data.messages)) return
        const { addIncomingTelegramMessage } = useStore.getState()
        data.messages.forEach((msg) => {
          if (msg?.text && msg?.telegramMessageId) {
            addIncomingTelegramMessage(msg.text, msg.telegramMessageId, chatId)
          }
        })
      } catch (err) {
        console.error('Telegram poll failed', err)
      }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [useStore, storageName])
}
