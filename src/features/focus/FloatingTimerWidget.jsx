import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useFocusTimerStore } from '../../store/useFocusTimerStore'
import { useFocusUiStore } from '../../store/useFocusUiStore'
import { useFocusStore } from '../../store/useFocusStore'
import { formatCountdown, formatCountdownLong } from './timeFormat'
import { IconPip } from '../../icons/Icons'
import { PIP_SUPPORTED, openPipWindow } from './pipWindow'
import { useCurrentRank } from './useCurrentRank'

// Rendered inside TopBar.jsx's own timer slot so it survives navigating
// away from the Focus section entirely — the Pomodoro session itself keeps
// running in useFocusTimerStore regardless of what's mounted.
export default function FloatingTimerWidget() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const phase = useFocusTimerStore((s) => s.phase)
  const remaining = useFocusTimerStore((s) => s.remaining)
  const projectId = useFocusTimerStore((s) => s.projectId)
  const sourceType = useFocusTimerStore((s) => s.sourceType)
  // A Focus project's countdown is its own remaining hours budget (see
  // TimerPanel.jsx) and can easily run past 99 minutes — formatCountdown's
  // bare MM:SS showed "1190:29" for it (per user report); task sessions
  // stay short enough for the plain form.
  const timeLabel = (sourceType === 'project' ? formatCountdownLong : formatCountdown)(remaining)
  const timerViewOpen = useFocusUiStore((s) => s.timerViewOpen)
  const setSelectedProjectId = useFocusUiStore((s) => s.setSelectedProjectId)
  const pipWindow = useFocusUiStore((s) => s.pipWindow)
  const setPipWindow = useFocusUiStore((s) => s.setPipWindow)
  const project = useFocusStore((s) => s.projects.find((p) => p.id === projectId))
  const rank = useCurrentRank()
  // A My day task session has no Focus "project" entity to color by — it's
  // always the current rank's color instead (see MyDayTimer.jsx).
  const dotColor = sourceType === 'task' ? rank.color : project?.color

  const sessionActive = phase !== 'idle' && (sourceType === 'task' || !!project)
  // The bar only makes sense on top of OTHER pages — the main timer screen
  // already shows the countdown, so it hides there. The PiP
  // window is a separate OS window and should keep running regardless of
  // which in-app screen is open underneath it.
  const visible = sessionActive && !timerViewOpen
  const isRest = phase === 'break'

  // Once there's nothing left to show (session actually finished), close
  // the detached window rather than leave it stranded.
  useEffect(() => {
    if (!sessionActive && pipWindow) {
      pipWindow.close()
      setPipWindow(null)
    }
  }, [sessionActive, pipWindow, setPipWindow])

  useEffect(() => () => pipWindow?.close(), [pipWindow])

  const openPip = async (e) => {
    e.stopPropagation()
    if (!PIP_SUPPORTED || pipWindow) return
    const pw = await openPipWindow()
    if (!pw) return
    pw.addEventListener('pagehide', () => setPipWindow(null))
    setPipWindow(pw)
  }

  const onDoubleClick = () => {
    if (sourceType === 'task') {
      navigate('/upcoming/today')
    } else {
      setSelectedProjectId(projectId)
      navigate('/focus')
    }
    try { window.focus() } catch { /* best-effort — browsers may block it */ }
  }

  // Checked before `visible` — the PiP window is a separate OS window, so
  // it keeps rendering even while the in-page bar is hidden (e.g. the main
  // timer screen is open underneath it).
  if (pipWindow && sessionActive) {
    return createPortal(
      <div className={'focus-timer-pip' + (isRest ? ' focus-timer-pip--rest' : '')} onDoubleClick={onDoubleClick} role="button" tabIndex={0}>
        <span className="focus-timer-pip__dot" style={isRest ? undefined : { background: dotColor }} />
        <span className="focus-timer-pip__time">{timeLabel}</span>
      </div>,
      pipWindow.document.body
    )
  }

  if (!visible) return null

  return (
    <div
      className={'focus-timer-widget' + (isRest ? ' focus-timer-widget--rest' : '')}
      onDoubleClick={onDoubleClick}
      role="button"
      tabIndex={0}
    >
      <span className="focus-timer-widget__dot" style={isRest ? undefined : { background: dotColor }} />
      <span className="focus-timer-widget__time">{timeLabel}</span>
      {PIP_SUPPORTED && (
        <button
          type="button"
          className="focus-timer-widget__pip-btn"
          onClick={openPip}
          aria-label={t('focus.floatAboveWindows')}
          title={t('focus.floatAboveWindows')}
        >
          <IconPip size={13} />
        </button>
      )}
    </div>
  )
}
