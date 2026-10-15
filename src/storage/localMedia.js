import { get, set, del } from 'idb-keyval'

// Photo/voice/file blobs for Insights & Reference Info messages, kept
// on-device instead of Firebase Storage — see
// docs/superpowers/specs/2026-08-11-local-insights-media-design.md for why.
// One blob per message id; `localKey` is just that id, returned from
// saveLocalMedia so call sites never have to know the key scheme directly.

// This IndexedDB data is the only copy of the user's media — request
// persistent storage so browsers don't silently evict it under storage
// pressure or after a period of inactivity (WebKit ~7 days). Best-effort:
// the browser may still say no, and older browsers/non-browser contexts
// simply won't have the API.
let persistRequested = false
function requestPersistence() {
  if (persistRequested) return
  persistRequested = true
  if (typeof navigator === 'undefined') return
  navigator.storage?.persist?.()?.catch?.(() => {})
}

export async function saveLocalMedia(id, blob) {
  requestPersistence()
  await set(id, blob)
  window.dispatchEvent(new CustomEvent('local-media-saved', { detail: id }))
  return id
}

export async function getLocalMedia(localKey) {
  if (!localKey) return null
  try {
    const blob = await get(localKey)
    return blob ?? null
  } catch (error) {
    console.error('Error reading local media:', error)
    return null
  }
}

export async function deleteLocalMedia(localKey) {
  if (!localKey) return
  await del(localKey)
}
