import i18n from '../i18n'
import { useQuranStore, flushQuranStore } from '../store/useQuranStore'
import { useQuranPlaybackStore } from '../store/useQuranPlaybackStore'
import { getAudioContext } from './audioContext'
import { getSurah, surahAudioUrl } from '../features/quran/surahs'

// The Quran recitation player, as a module singleton rather than a React
// component — so a single <audio> element (plus its echo graph, position
// saving, listening counter and MediaSession wiring) keeps running when the
// user navigates away from My Focus, instead of being torn down with the
// page. QuranPlayer.jsx is now just UI that reads useQuranPlaybackStore and
// calls the exported controls here.
//
// Surah selection / progress / echo level still live in useQuranStore (the
// Firestore-persisted one); this engine subscribes to it for surah changes
// and echo, and writes back position / listened-time / completion.

let started = false
let audio = null
let echo = null // { ctx, wet, feedback }, built lazily on first echo > 0
let autoplayNext = false
let seekTarget = 0
let userEngaged = false // has the user pressed play / picked a surah this session
let saveTimer = null
let listenTimer = null

const setPlayback = (patch) => useQuranPlaybackStore.setState(patch)

function buildEchoGraph() {
  if (echo) return echo
  try {
    const ctx = getAudioContext()
    const source = ctx.createMediaElementSource(audio)
    const dry = ctx.createGain()
    dry.gain.value = 1
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.23
    const feedback = ctx.createGain()
    feedback.gain.value = 0
    const wet = ctx.createGain()
    wet.gain.value = 0
    source.connect(dry).connect(ctx.destination)
    source.connect(delay)
    delay.connect(feedback).connect(delay)
    delay.connect(wet).connect(ctx.destination)
    echo = { ctx, wet, feedback }
  } catch {
    echo = null
  }
  return echo
}

// echoLevel is 0-100. Never builds the graph while it's off and has never
// been on — a listener who leaves echo at 0 keeps the plain <audio> output.
function applyEcho(echoLevel) {
  if (echoLevel <= 0 && !echo) return
  const g = buildEchoGraph()
  if (!g) return
  const amt = echoLevel / 100
  const now = g.ctx.currentTime
  g.wet.gain.setTargetAtTime(amt * 0.9, now, 0.05)
  g.feedback.gain.setTargetAtTime(amt * 0.6, now, 0.05)
}

function updateMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  const n = useQuranStore.getState().currentSurah
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: getSurah(n).tr,
      artist: 'Mishary Rashid Alafasy',
      album: i18n.t('quran.title'),
    })
    navigator.mediaSession.playbackState = useQuranPlaybackStore.getState().playing ? 'playing' : 'paused'
    navigator.mediaSession.setActionHandler('play', quranPlay)
    navigator.mediaSession.setActionHandler('pause', quranPause)
    // Case наушников next/prev случайно жмут и сбивают позицию в суре —
    // отключено по запросу пользователя. play/pause остаются рабочими.
    navigator.mediaSession.setActionHandler('previoustrack', null)
    navigator.mediaSession.setActionHandler('nexttrack', null)
  } catch {
    /* MediaSession/MediaMetadata not supported — non-essential */
  }
}

function startTimers() {
  stopTimers()
  // Throttled resume-point save (the store further throttles Firestore
  // writes to once a minute).
  saveTimer = setInterval(() => {
    if (audio && audio.currentTime > 0 && !audio.paused) {
      useQuranStore.getState().savePosition(audio.currentTime)
    }
  }, 5000)
  // Listening-time counter for MyFocusPage's stat — one tick a second only
  // while really playing.
  listenTimer = setInterval(() => {
    if (audio && !audio.paused && !audio.ended) useQuranStore.getState().addListenedSecond()
  }, 1000)
}

function stopTimers() {
  clearInterval(saveTimer)
  clearInterval(listenTimer)
  saveTimer = null
  listenTimer = null
}

function loadSurah(n, position, autoplay) {
  autoplayNext = !!autoplay
  seekTarget = position || 0
  setPlayback({ loading: true, error: false, duration: 0, currentTime: seekTarget })
  audio.src = surahAudioUrl(n)
  audio.load()
  updateMediaSession()
}

export function quranPlay() {
  if (!audio) return
  userEngaged = true
  if (echo && echo.ctx.state === 'suspended') echo.ctx.resume().catch(() => {})
  audio
    .play()
    .then(() => {
      setPlayback({ playing: true })
      startTimers()
      updateMediaSession()
    })
    .catch(() => setPlayback({ playing: false }))
}

export function quranPause() {
  if (!audio) return
  audio.pause()
  setPlayback({ playing: false })
  stopTimers()
  if (audio.currentTime > 0 && !audio.ended) {
    useQuranStore.getState().savePosition(audio.currentTime)
    flushQuranStore()
  }
  updateMediaSession()
}

export function quranToggle() {
  if (useQuranPlaybackStore.getState().playing) quranPause()
  else quranPlay()
}

export function quranSeekTo(seconds) {
  if (!audio) return
  const dur = Number.isFinite(audio.duration) ? audio.duration : Infinity
  const t = Math.max(0, Math.min(dur - 0.25, seconds))
  audio.currentTime = t
  setPlayback({ currentTime: t })
  useQuranStore.getState().savePosition(t)
}

export function quranSeekBy(delta) {
  if (!audio) return
  quranSeekTo(audio.currentTime + delta)
}

// Selecting a surah goes through useQuranStore; the subscription below
// notices currentSurah changed and (re)loads the audio, carrying the
// autoplay intent.
export function quranGoToSurah(n, autoplay) {
  if (n < 1 || n > 114) return
  autoplayNext = !!autoplay
  userEngaged = true
  useQuranStore.getState().selectSurah(n)
}

// Called on sign-out (see rehydrateStores.js) — stop the sound and drop
// back to a clean idle state so the next account doesn't inherit playback.
export function stopQuranEngine() {
  if (!started || !audio) return
  audio.pause()
  stopTimers()
  autoplayNext = false
  userEngaged = false
  setPlayback({ playing: false, currentTime: 0, duration: 0, loading: true, error: false })
}

export function ensureQuranEngine() {
  if (started) return
  started = true

  audio = new Audio()
  audio.preload = 'metadata'
  audio.crossOrigin = 'anonymous'

  audio.addEventListener('loadedmetadata', () => {
    setPlayback({ loading: false })
    if (Number.isFinite(audio.duration)) setPlayback({ duration: audio.duration })
    if (seekTarget > 0 && seekTarget < (audio.duration || Infinity)) {
      audio.currentTime = seekTarget
    }
    if (autoplayNext) {
      autoplayNext = false
      quranPlay()
    }
  })
  audio.addEventListener('timeupdate', () => setPlayback({ currentTime: audio.currentTime }))
  audio.addEventListener('ended', () => {
    useQuranStore.getState().savePosition(0)
    const next = useQuranStore.getState().completeAndAdvance()
    if (next) {
      // completeAndAdvance moved currentSurah — the subscription reloads it;
      // tell that reload to keep playing.
      autoplayNext = true
    } else {
      setPlayback({ playing: false })
      stopTimers()
    }
  })
  audio.addEventListener('error', () => setPlayback({ error: true, loading: false, playing: false }))

  let lastSurah = useQuranStore.getState().currentSurah
  let lastEcho = useQuranStore.getState().echo
  useQuranStore.subscribe((state) => {
    if (state.currentSurah !== lastSurah) {
      lastSurah = state.currentSurah
      loadSurah(state.currentSurah, state.position, autoplayNext)
    }
    if (state.echo !== lastEcho) {
      lastEcho = state.echo
      applyEcho(state.echo)
    }
  })

  const st = useQuranStore.getState()
  loadSurah(st.currentSurah, st.position, false)
  applyEcho(st.echo)

  // If Firestore hydration lands after this point and the user hasn't
  // touched anything, reload at the real saved surah / position.
  useQuranStore.persist.onFinishHydration((state) => {
    if (!userEngaged) {
      lastSurah = state.currentSurah
      lastEcho = state.echo
      loadSurah(state.currentSurah, state.position, false)
      applyEcho(state.echo)
    }
  })

  const flush = () => {
    if (audio && audio.currentTime > 0 && !audio.ended) {
      useQuranStore.getState().savePosition(audio.currentTime)
    }
    flushQuranStore()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush()
  })
  window.addEventListener('pagehide', flush)
}
