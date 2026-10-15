import { useTranslation } from 'react-i18next'
import { IconTrash } from '../../icons/Icons'

function formatElapsed(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Staggered animation-delays give the bars an organic, non-uniform pulse
// instead of all rising/falling in lockstep — cheap CSS approximation of
// the live waveform Apple's own Voice Memos recording screen shows, not a
// real amplitude readout (see index.css's voice-recorder-wave keyframes).
const WAVEFORM_BARS = Array.from({ length: 28 }, (_, i) => i)

// Replaces the whole composer row while a recording owned by this page is
// in progress (see useVoiceRecorderStore.js) — styled after Apple's own
// dictaphone recording screen per user request: big red stop button,
// pulsing waveform, monospace timer, and a discard (trash) action instead
// of only ever being able to send.
export default function VoiceRecorderPanel({ elapsedSec, onStop, onDiscard }) {
  const { t } = useTranslation()
  return (
    <div className="voice-recorder">
      <button
        type="button"
        className="voice-recorder__discard"
        onClick={onDiscard}
        aria-label={t('insights.discardRecording')}
        title={t('insights.discardRecording')}
      >
        <IconTrash size={16} />
      </button>
      <div className="voice-recorder__center">
        <div className="voice-recorder__time">{formatElapsed(elapsedSec)}</div>
        <div className="voice-recorder__waveform">
          {WAVEFORM_BARS.map((i) => (
            <span key={i} className="voice-recorder__bar" style={{ animationDelay: `${(i % 14) * 0.08}s` }} />
          ))}
        </div>
      </div>
      <button
        type="button"
        className="voice-recorder__stop"
        onClick={onStop}
        aria-label={t('insights.stopRecording')}
        title={t('insights.stopRecording')}
      >
        <span className="voice-recorder__stop-icon" />
      </button>
    </div>
  )
}
