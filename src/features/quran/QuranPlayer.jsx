import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconPause, IconPlay, IconArrowRight, IconRewind10, IconForward10, IconMoreHorizontal } from '../../icons/Icons'
import { useQuranStore, quranPercent, completedCount } from '../../store/useQuranStore'
import { useQuranPlaybackStore } from '../../store/useQuranPlaybackStore'
import { quranToggle, quranSeekTo, quranSeekBy, quranGoToSurah } from '../../audio/quranAudioEngine'
import { SURAHS, getSurah } from './surahs'

const SEEK_STEP = 10 // seconds, for the ±10s buttons

function formatTime(sec) {
  const s = Math.max(0, Math.round(sec || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

// UI for the Quran recitation (Mishary Rashid Alafasy). All the actual
// playback — the <audio> element, resume position, echo, listening-time
// counter, MediaSession — lives in the module singleton
// src/audio/quranAudioEngine.js so it keeps running when you leave this
// page; this component just renders its state (useQuranPlaybackStore) and
// the surah list, and calls the engine's exported controls.
export default function QuranPlayer() {
  const { t } = useTranslation()
  const trackRef = useRef(null)
  const listRef = useRef(null)

  const currentSurah = useQuranStore((s) => s.currentSurah)
  const completed = useQuranStore((s) => s.completed)
  const toggleCompleted = useQuranStore((s) => s.toggleCompleted)
  const khatms = useQuranStore((s) => s.khatms)
  const echo = useQuranStore((s) => s.echo)
  const setEcho = useQuranStore((s) => s.setEcho)

  const playing = useQuranPlaybackStore((s) => s.playing)
  const currentTime = useQuranPlaybackStore((s) => s.currentTime)
  const duration = useQuranPlaybackStore((s) => s.duration)
  const loading = useQuranPlaybackStore((s) => s.loading)
  const error = useQuranPlaybackStore((s) => s.error)

  const [echoOpen, setEchoOpen] = useState(false)

  const surah = getSurah(currentSurah)
  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0
  const pct = useMemo(() => quranPercent(completed), [completed])
  const doneCount = useMemo(() => completedCount(completed), [completed])

  // Scroll the surah list so the current one is in view when it changes.
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-current="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [currentSurah])

  const seekToClientX = (clientX) => {
    const track = trackRef.current
    if (!track || !Number.isFinite(duration) || duration <= 0) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    quranSeekTo(ratio * duration)
  }
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

  const prev = () => quranGoToSurah(currentSurah - 1, playing)
  const next = () => quranGoToSurah(currentSurah + 1, playing)

  return (
    <div className="quran-player">
      <div className="quran-player__overall">
        <div className="quran-player__overall-head">
          <span>{t('quran.overallProgress')}</span>
          <span className="quran-player__overall-num">{doneCount}/114 · {pct}%</span>
        </div>
        <div className="quran-player__overall-bar">
          <div className="quran-player__overall-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="quran-player__overall-khatm">{t('quran.khatmsLine', { count: khatms })}</div>
      </div>

      <div className="quran-player__now">
        <div className="quran-player__now-title">
          <span className="quran-player__now-ar" dir="rtl">{surah.ar}</span>
          <span className="quran-player__now-en">{currentSurah}. {surah.tr}</span>
        </div>

        {error ? (
          <p className="quran-player__error">{t('quran.loadError')}</p>
        ) : (
          <>
            <div className="quran-player__controls">
              <button type="button" className="quran-player__skip" onClick={prev} disabled={currentSurah <= 1} aria-label={t('quran.prevSurah')}>
                <IconArrowRight size={16} style={{ transform: 'scaleX(-1)' }} />
              </button>
              <button type="button" className="quran-player__seek" onClick={() => quranSeekBy(-SEEK_STEP)} aria-label={t('quran.rewind10')}>
                <IconRewind10 size={20} />
                <span>10</span>
              </button>
              <button type="button" className="quran-player__play" onClick={quranToggle} aria-label={playing ? t('quran.pause') : t('quran.play')}>
                {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
              </button>
              <button type="button" className="quran-player__seek" onClick={() => quranSeekBy(SEEK_STEP)} aria-label={t('quran.forward10')}>
                <IconForward10 size={20} />
                <span>10</span>
              </button>
              <button type="button" className="quran-player__skip" onClick={next} disabled={currentSurah >= 114} aria-label={t('quran.nextSurah')}>
                <IconArrowRight size={16} />
              </button>
            </div>

            <div className="quran-player__track" ref={trackRef} onPointerDown={onTrackPointerDown}>
              <div className="quran-player__track-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="quran-player__time">
              <span>{formatTime(currentTime)}</span>
              <span>{loading ? t('quran.loading') : formatTime(duration)}</span>
            </div>

            <div className="quran-player__echo">
              <button
                type="button"
                className={'quran-player__echo-toggle' + (echoOpen ? ' open' : '') + (echo > 0 ? ' active' : '')}
                onClick={() => setEchoOpen((v) => !v)}
                aria-expanded={echoOpen}
                aria-label={t('quran.echo')}
              >
                <IconMoreHorizontal size={18} />
              </button>
              {echoOpen && (
                <div className="quran-player__echo-panel">
                  <span className="quran-player__echo-label">{t('quran.echo')}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={echo}
                    onChange={(e) => setEcho(Number(e.target.value))}
                    aria-label={t('quran.echo')}
                  />
                  <span className="quran-player__echo-val">{echo}%</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="quran-player__list" ref={listRef}>
        {SURAHS.map((s) => (
          <div
            key={s.n}
            className={'quran-player__row' + (s.n === currentSurah ? ' quran-player__row--current' : '')}
            data-current={s.n === currentSurah}
            onClick={() => quranGoToSurah(s.n, playing)}
          >
            <span className="quran-player__row-num">{s.n}</span>
            <span className="quran-player__row-names">
              <span className="quran-player__row-en">{s.tr}</span>
              <span className="quran-player__row-ar" dir="rtl">{s.ar}</span>
            </span>
            <button
              type="button"
              className={'quran-player__row-check' + (completed[s.n] ? ' quran-player__row-check--done' : '')}
              onClick={(e) => { e.stopPropagation(); toggleCompleted(s.n) }}
              aria-label={completed[s.n] ? t('quran.markUnread') : t('quran.markRead')}
            >
              {completed[s.n] ? '✓' : ''}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
