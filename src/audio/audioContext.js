let ctx = null

// Lazily created, since browsers only allow starting an AudioContext
// after a user gesture (click/tap).
export function getAudioContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    ctx = new Ctor()

    // The OS/browser can suspend our audio session out from under us —
    // a phone call interrupting playback, or (observed in practice) some
    // browsers suspending a minimized window's AudioContext even though it's
    // actively producing sound. A single resume() attempt 500ms later isn't
    // enough — some of these suspensions only let go after several tries —
    // so this keeps retrying on an interval instead of giving up after one
    // shot, until it actually reports 'running' again.
    let watchdog = null
    const startWatchdog = () => {
      if (watchdog) return
      watchdog = setInterval(() => {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {})
        } else {
          clearInterval(watchdog)
          watchdog = null
        }
      }, 1000)
    }

    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'suspended') startWatchdog()
    })

    // The moment the tab/window is visible again is the best chance to get
    // an actual resume() through, in case the interval above hasn't caught
    // up yet.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && ctx.state === 'suspended') ctx.resume().catch(() => {})
      })
    }

    // Registering Media Session metadata tells the browser this page is
    // legitimately playing background media (the same signal music/podcast
    // players rely on) rather than an inactive background tab, which makes
    // browsers noticeably less eager to suspend the audio when minimized.
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: 'ARKAD — Focus' })
        navigator.mediaSession.playbackState = 'playing'
      } catch {
        /* MediaMetadata not available in this browser — non-essential, skip */
      }
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}
