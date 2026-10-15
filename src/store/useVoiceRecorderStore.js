import { create } from 'zustand'

// The MediaRecorder/stream/chunks live outside the store's state (and
// outside React) on purpose — same pattern as useFocusTimerStore's
// tickInterval: a recording must keep running even once the InsightsChat
// instance that started it unmounts (navigating to another page/section,
// or the OS switching windows/tabs) per user request — "при переключении
// окон запись не должна останавливаться". Only the reactive bits
// (active/elapsedSec/errors/sourceRoute) live in the zustand store; the
// MediaRecorder itself isn't serializable and doesn't need to be.
let mediaRecorder = null
let mediaStream = null
let chunks = []
let startedAt = 0
let tickInterval = null
let pendingAddVoiceMessage = null
let discardNext = false

function cleanupMedia() {
  mediaStream?.getTracks().forEach((track) => track.stop())
  mediaStream = null
  mediaRecorder = null
  chunks = []
  if (tickInterval) clearInterval(tickInterval)
  tickInterval = null
}

export const useVoiceRecorderStore = create((set, get) => ({
  active: false,
  elapsedSec: 0,
  micError: false,
  saveError: false,
  // Route that started this recording (see InsightsChat.jsx/
  // VoiceRecorderWidget.jsx) — the owning page renders the full recording
  // panel; every other page just disables its own mic button and the
  // floating widget offers a way back.
  sourceRoute: null,

  start: async (route, addVoiceMessage) => {
    if (get().active) return
    set({ micError: false, saveError: false })
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      set({ micError: true })
      return
    }
    mediaStream = stream
    chunks = []
    discardNext = false
    pendingAddVoiceMessage = addVoiceMessage
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    mediaRecorder.onstop = async () => {
      const recordedChunks = chunks
      const recordedMime = mediaRecorder?.mimeType || 'audio/webm'
      // Real elapsed time, not tick count — a backgrounded tab can throttle
      // the 1s display interval below, but this stays accurate regardless.
      const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      const shouldSave = !discardNext
      const callback = pendingAddVoiceMessage
      cleanupMedia()
      pendingAddVoiceMessage = null
      set({ active: false, elapsedSec: 0, sourceRoute: null })
      if (shouldSave && callback) {
        try {
          await callback(new Blob(recordedChunks, { type: recordedMime }), duration)
        } catch {
          set({ saveError: true })
        }
      }
    }
    try {
      startedAt = Date.now()
      mediaRecorder.start()
    } catch {
      // A dead/unsupported track (or a MediaRecorder that just can't start)
      // must not leak the mic stream or leave `mediaRecorder`/`mediaStream`
      // pointing at a half-initialized session that blocks every later
      // start() call from ever reaching getUserMedia again.
      cleanupMedia()
      pendingAddVoiceMessage = null
      set({ micError: true })
      return
    }
    set({ active: true, elapsedSec: 0, sourceRoute: route })
    tickInterval = setInterval(() => {
      set({ elapsedSec: Math.round((Date.now() - startedAt) / 1000) })
    }, 1000)
  },

  stop: () => { discardNext = false; mediaRecorder?.stop() },
  discard: () => { discardNext = true; mediaRecorder?.stop() },
  clearMicError: () => set({ micError: false }),
  clearSaveError: () => set({ saveError: false }),
}))
