import { useTranslation } from 'react-i18next'
import { useSplitViewStore } from '../store/useSplitViewStore'
import FloatingTimerWidget from '../features/focus/FloatingTimerWidget'
import VoiceRecorderWidget from '../features/tasks/VoiceRecorderWidget'

// The running Pomodoro session's own status pill lives here (see
// FloatingTimerWidget.jsx) — per user report, rendering it as an
// independently `position: fixed` bubble sat awkwardly disconnected from
// the app's own header instead of reading as part of it. It's a proper
// flex child of this row now, not overlaid on top of it.
export default function TopBar() {
  const { t } = useTranslation()
  const splitOpen = useSplitViewStore((s) => s.open)
  const toggleSplit = useSplitViewStore((s) => s.toggle)
  const label = splitOpen ? t('splitView.close') : t('splitView.toggle')
  return (
    <header className="topbar">
      <div className="topbar__timer-slot">
        <FloatingTimerWidget />
        <VoiceRecorderWidget />
      </div>
      <button
        type="button"
        className={'topbar__split-btn' + (splitOpen ? ' topbar__split-btn--on' : '')}
        onClick={toggleSplit}
        title={label}
        aria-label={label}
        aria-pressed={splitOpen}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="14" rx="3" />
          <path d="M12 5v14" />
        </svg>
      </button>
    </header>
  )
}
