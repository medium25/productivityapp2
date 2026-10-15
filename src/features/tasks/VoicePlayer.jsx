import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconPause, IconPlay } from '../../icons/Icons'

function formatTime(sec) {
  const s = Math.max(0, Math.round(sec || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const WAVEFORM_BARS = 28

// Decorative waveform, not a real amplitude readout (recorded webm blobs
// aren't decoded client-side just to draw bars) — deterministic per src so
// a given voice message always renders the same shape instead of reshuffling
// on every re-render.
function waveformHeights(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const heights = []
  for (let i = 0; i < WAVEFORM_BARS; i++) {
    h = (h * 1103515245 + 12345) >>> 0
    heights.push(25 + ((h >>> 8) % 1000) / 1000 * 65)
  }
  return heights
}

// Custom voice-message player — replaces the browser's native <audio
// controls>, a plain system widget (light-mode pill, tiny scrub handle)
// that clashed with the dark chat bubbles and was fiddly to scrub on, per
// user request for something "удобным для прослушивания". `durationHint`
// is the message's own stored durationSec, shown until the audio element's
// real metadata loads so the time readout doesn't flash 0:00 first.
export default function VoicePlayer({ src, durationHint }) {
  const { t } = useTranslation()
  const audioRef = useRef(null)
  const trackRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(durationHint || 0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onLoaded = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration)
        return
      }
      // Chrome (and others) report `Infinity` for a MediaRecorder-produced
      // webm blob's duration until the browser has actually indexed the
      // whole file — seeking silently did nothing until then, which read as
      // "scrubbing is broken" per user report. Seeking to a huge time forces
      // that indexing; 'durationchange' below fires once the real duration
      // is known, and rewinds back to the start.
      setDuration(durationHint || 0)
      audio.currentTime = 1e101
    }
    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
        audio.currentTime = 0
      }
    }
    const onEnd = () => { setPlaying(false); setCurrentTime(0) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnd)
    }
  }, [src, durationHint])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else audio.play().catch(() => {})
    setPlaying(!playing)
  }

  const seekToClientX = (clientX) => {
    const audio = audioRef.current
    const track = trackRef.current
    if (!audio || !track || !Number.isFinite(duration) || duration <= 0) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrentTime(audio.currentTime)
  }

  // Pointer-drag scrub, not just click-to-jump (per user request, "allow
  // rewinding" on a sent recording) — grabbing the track and dragging
  // tracks the pointer continuously, same as any native scrubber.
  const onTrackPointerDown = (e) => {
    seekToClientX(e.clientX)
    const onMove = (ev) => seekToClientX(ev.clientX)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0
  const heights = useMemo(() => waveformHeights(src), [src])
  const playedBars = Math.round((progress / 100) * WAVEFORM_BARS)

  return (
    <div className="voice-player">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" />
      {/* Flat row directly on the message bubble's own background — no
          separate pill/border/blur underneath it, so the bubble reads as
          one shape instead of a box nested inside a box. */}
      <div className="voice-player__capsule">
        <button
          type="button"
          className="voice-player__toggle"
          onClick={toggle}
          aria-label={playing ? t('insights.pauseVoice') : t('insights.playVoice')}
        >
          {playing ? <IconPause size={12} /> : <IconPlay size={12} />}
        </button>
        <div className="voice-player__wave" ref={trackRef} onPointerDown={onTrackPointerDown}>
          {heights.map((h, i) => (
            <span
              key={i}
              className={'voice-player__bar' + (i < playedBars ? ' voice-player__bar--played' : '')}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <span className="voice-player__time">{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>
    </div>
  )
}
