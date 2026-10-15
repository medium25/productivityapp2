import { useLocation, useNavigate } from 'react-router-dom'
import { useVoiceRecorderStore } from '../../store/useVoiceRecorderStore'

function formatElapsed(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Mirrors FloatingTimerWidget.jsx's own pattern: the recording itself
// lives outside React (see useVoiceRecorderStore.js) so it survives
// navigating away from wherever it was started — this pill is just the
// "something's still recording" reminder plus a way back to it. Hidden on
// the page that actually started the recording, since that page already
// shows the full VoiceRecorderPanel inline.
export default function VoiceRecorderWidget() {
  const navigate = useNavigate()
  const location = useLocation()
  const active = useVoiceRecorderStore((s) => s.active)
  const elapsedSec = useVoiceRecorderStore((s) => s.elapsedSec)
  const sourceRoute = useVoiceRecorderStore((s) => s.sourceRoute)

  if (!active || sourceRoute === location.pathname) return null

  return (
    <button type="button" className="voice-recorder-widget" onClick={() => navigate(sourceRoute)}>
      <span className="voice-recorder-widget__dot" />
      <span className="voice-recorder-widget__time">{formatElapsed(elapsedSec)}</span>
    </button>
  )
}
