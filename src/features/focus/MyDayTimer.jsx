import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusTimerStore } from '../../store/useFocusTimerStore'
import { useFocusUiStore } from '../../store/useFocusUiStore'
import { PIP_SUPPORTED, openPipWindow } from './pipWindow'
import { IconPip } from '../../icons/Icons'
import { useCurrentRank } from './useCurrentRank'
import TimerPanel from './TimerPanel'

// The Focus timer, relocated into the My day section per user request —
// instead of Focus's own projects, it attaches to whichever task the user
// clicked (see TaskCard's onSelectForTimer). Opens as a popup right over
// the list rather than pinned at the top of the column — per user request
// the shared always-visible panel there is gone; this only appears while a
// specific card's popup is open (see openTimerTask/onClose in
// ActionColumnBoard.jsx). Colored by the current rank rather than a
// per-project color, and its work-session length defaults to the task's
// own time estimate instead of the shared Focus setting — see TimerPanel's
// `defaultWorkMinutes`.
export default function MyDayTimer({ task, onClose }) {
  const { t } = useTranslation()
  const runningId = useFocusTimerStore((s) => s.projectId)
  const runningSourceType = useFocusTimerStore((s) => s.sourceType)
  const timerPhase = useFocusTimerStore((s) => s.phase)
  const pipWindow = useFocusUiStore((s) => s.pipWindow)
  const setPipWindow = useFocusUiStore((s) => s.setPipWindow)
  const rank = useCurrentRank()

  const isRunningThisTask = runningSourceType === 'task' && runningId === task?.id

  // Same "tell the floating widget it doesn't need to duplicate this" wiring
  // as FocusPage does for its own hero timer — only claim it while the
  // running session actually belongs to the task shown here.
  useEffect(() => {
    useFocusUiStore.getState().setTimerViewOpen(isRunningThisTask)
    return () => useFocusUiStore.getState().setTimerViewOpen(false)
  }, [isRunningThisTask])

  const openPip = async (e) => {
    e.stopPropagation()
    if (!PIP_SUPPORTED || pipWindow) return
    const pw = await openPipWindow()
    if (!pw) return
    pw.addEventListener('pagehide', () => setPipWindow(null))
    setPipWindow(pw)
  }

  if (!task) return null

  return (
    <div className="focus-hero focus-hero--myday">
      <div className="focus-hero__meta">
        <span className="focus-hero__meta-name">{task.title}</span>
        {isRunningThisTask && timerPhase !== 'idle' && PIP_SUPPORTED && (
          <button
            type="button"
            className="focus-hero__pip-btn"
            onClick={openPip}
            disabled={!!pipWindow}
            aria-label={t('focus.floatAboveWindows')}
            title={t('focus.floatAboveWindows')}
          >
            <IconPip size={20} />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            className="focus-hero__close-btn"
            onClick={onClose}
            aria-label={t('tasks.cancel')}
            title={t('tasks.cancel')}
          >
            ✕
          </button>
        )}
      </div>

      <div className="focus-hero__panel" style={{ '--chip-color': rank.color }}>
        <TimerPanel id={task.id} sourceType="task" defaultWorkMinutes={task.estimateMinutes || undefined} />
      </div>
    </div>
  )
}
