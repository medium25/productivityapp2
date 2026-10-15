import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusTimerStore, BREAK_SKIP_DAILY_LIMIT } from '../../store/useFocusTimerStore'
import { useFocusStore, getProjectRemainingSeconds } from '../../store/useFocusStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useFocusHistoryStore, dateKey } from '../../store/useFocusHistoryStore'
import { AMBIENT_SOUNDS } from '../../audio/ambientSounds'
import { IconChevronDown } from '../../icons/Icons'
import { formatCountdown, formatCountdownLong } from './timeFormat'

// How much of the phase must remain before the bar switches to an urgent
// "time's nearly up" color — last ~20% of whichever duration is active.
const LOW_TIME_THRESHOLD = 0.2

// Renders as a continuation of the clicked project's row in ProjectList
// (not a separate full-screen view) — a linear bar instead of the old ring,
// since it now sits inline in a fairly narrow card rather than owning the
// whole page. "Today focused" and the PiP button live in the project row's
// header above this panel, not duplicated in here.
//
// Generalized beyond just Focus projects (see FocusTimerHero) — the My day
// timer (MyDayTimer.jsx) also renders this, keyed to a task id instead of a
// project id, with its own work-duration default (the task's estimate) and
// sourceType:'task' so the shared timer store/history can tell the two
// apart. Color comes from the parent's `--chip-color` CSS var either way.
export default function TimerPanel({ id, sourceType = 'project', defaultWorkMinutes, onCancel }) {
  const { t } = useTranslation()
  const [soundMenuOpen, setSoundMenuOpen] = useState(false)
  const [editingDuration, setEditingDuration] = useState(false)
  const [workInput, setWorkInput] = useState('')
  const [breakInput, setBreakInput] = useState('')
  // A task's own estimate (defaultWorkMinutes) is a starting point, not a
  // hard limit — per user request the timer's number must stay editable
  // even when it came from the task rather than the global setting. Kept
  // local (not written back to the global setting or the task itself)
  // and reset whenever a different task/project takes over this panel, so
  // a one-off override never leaks onto the next task's own estimate.
  const [workOverrideMinutes, setWorkOverrideMinutes] = useState(null)
  useEffect(() => { setWorkOverrideMinutes(null) }, [id])

  // A Focus project's whole countdown is now its own remaining hours
  // budget (per user request — "however many hours a project needs,
  // that's what's on the timer"), not a Pomodoro slot — see
  // getProjectRemainingSeconds in useFocusStore.js. My day tasks
  // (sourceType 'task') are untouched, still workMinutes-based below.
  const isProjectSource = sourceType === 'project'
  const project = useFocusStore((s) => (isProjectSource ? s.projects.find((p) => p.id === id) : null))
  const setProjectEstimatedHours = useFocusStore((s) => s.setProjectEstimatedHours)
  const remainingBudgetSeconds = isProjectSource ? getProjectRemainingSeconds(project) : 0
  // True both for a legacy project that predates this requirement and for
  // one that's simply run its whole budget out — either way there's
  // nothing to count down from until hours are (re)assigned.
  const needsHours = isProjectSource && remainingBudgetSeconds <= 0
  const [hoursInput, setHoursInput] = useState('')
  useEffect(() => {
    if (needsHours) setHoursInput(project?.estimatedHours ? String(project.estimatedHours) : '')
  }, [needsHours, id, project?.estimatedHours])

  const saveHours = () => {
    const value = Number(hoursInput)
    if (value > 0) setProjectEstimatedHours(id, value)
  }

  const activeId = useFocusTimerStore((s) => s.projectId)
  const globalPhase = useFocusTimerStore((s) => s.phase)
  const globalBreakOfferPending = useFocusTimerStore((s) => s.breakOfferPending)
  const globalWorkResumedNotice = useFocusTimerStore((s) => s.workResumedNotice)
  const dismissWorkResumedNotice = useFocusTimerStore((s) => s.dismissWorkResumedNotice)
  const muteRingtone = useFocusTimerStore((s) => s.muteRingtone)
  const remaining = useFocusTimerStore((s) => s.remaining)
  const totalSeconds = useFocusTimerStore((s) => s.totalSeconds)
  const soundId = useFocusTimerStore((s) => s.soundId)
  const setSoundId = useFocusTimerStore((s) => s.setSoundId)
  const start = useFocusTimerStore((s) => s.start)
  const stopTimer = useFocusTimerStore((s) => s.stop)
  const continueFocus = useFocusTimerStore((s) => s.continueFocus)
  const finish = useFocusTimerStore((s) => s.finish)
  const acceptBreakOffer = useFocusTimerStore((s) => s.acceptBreakOffer)
  const declineBreakOffer = useFocusTimerStore((s) => s.declineBreakOffer)
  const skipBreak = useFocusTimerStore((s) => s.skipBreak)
  const breakSkips = useFocusHistoryStore((s) => s.breakSkips)
  const settingsWorkMinutes = useSettingsStore((s) => s.workMinutes)
  const breakMinutes = useSettingsStore((s) => s.breakMinutes)
  const setWorkMinutes = useSettingsStore((s) => s.setWorkMinutes)
  const setBreakMinutes = useSettingsStore((s) => s.setBreakMinutes)

  // A Focus project's minutes come straight from its remaining budget now
  // (see isProjectSource above) — no override/default chain, that's all
  // task-timer territory. For a task, a manual override (see
  // workOverrideMinutes above) wins over everything else; failing that, the
  // task's own estimate (see MyDayTimer) wins over the global setting.
  const workMinutes = isProjectSource
    ? remainingBudgetSeconds / 60
    : (workOverrideMinutes || defaultWorkMinutes || settingsWorkMinutes)

  // The Pomodoro session lives in a global store precisely so that
  // collapsing this panel (or switching to a different project's row)
  // never resets its progress.
  const isActive = activeId === id
  const phase = isActive ? globalPhase : 'idle'
  const breakOfferPending = isActive && globalBreakOfferPending
  const workResumedNotice = isActive && globalWorkResumedNotice

  // Self-dismisses (unlike breakOfferPending's banner, there's no decision
  // to make here — work's already resumed either way) so it doesn't linger
  // once its job of explaining the ringtone that just played is done.
  useEffect(() => {
    if (!workResumedNotice) return
    const timeoutId = setTimeout(dismissWorkResumedNotice, 5000)
    return () => clearTimeout(timeoutId)
  }, [workResumedNotice, dismissWorkResumedNotice])
  // Idle preview reflects the configured length directly; once running, the
  // session's own totalSeconds (captured at start) is the source of truth —
  // see useFocusTimerStore — so changing the setting mid-session doesn't
  // yank the bar out from under an already-running countdown.
  const displaySeconds = isActive ? remaining : workMinutes * 60
  const totalForPhase = isActive ? totalSeconds : workMinutes * 60
  // Starts full and shrinks toward empty as time runs out, not the other way.
  const remainingFraction = phase === 'idle' ? 1 : displaySeconds / totalForPhase
  const isRest = phase === 'break'
  const isLowTime = (phase === 'work' || phase === 'break') && remainingFraction <= LOW_TIME_THRESHOLD
  const breakSkipsLeft = BREAK_SKIP_DAILY_LIMIT - (breakSkips[dateKey()] || 0)

  // "Finishes at HH:MM" while a session is actually counting down (per user
  // request — knowing the wall-clock end time, not just the countdown).
  // Recomputed every render off the live `remaining` seconds rather than
  // memoized once at start, since start() itself doesn't stamp a fixed end
  // time anywhere in the store to read back.
  const showFinishTime = phase === 'work' || phase === 'break'
  const finishTimeLabel = showFinishTime
    ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
        new Date(Date.now() + displaySeconds * 1000)
      )
    : null

  const currentSoundLabel = soundId === 'none'
    ? t('focus.sound.none')
    : t(AMBIENT_SOUNDS.find((s) => s.id === soundId)?.labelKey || 'focus.sound.none')

  const pickSound = (soundOptionId) => {
    setSoundId(soundOptionId)
    setSoundMenuOpen(false)
  }

  const openDurationEditor = () => {
    // A project's work length isn't freely editable anymore — it's derived
    // from the project's own remaining hours (see needsHours below for how
    // that gets set/changed). Only task sessions still have a plain
    // editable minutes count.
    if (phase !== 'idle' || isProjectSource) return
    setWorkInput(String(workMinutes))
    setBreakInput(String(breakMinutes))
    setEditingDuration(true)
  }

  const saveDuration = () => {
    // A task with its own estimate keeps that estimate as-is (see
    // MyDayTimer/TaskFormModal) — editing here only overrides this panel's
    // session, it doesn't rewrite the task. Without a per-task estimate,
    // there's nothing local to override, so it goes to the shared setting
    // exactly as before.
    if (defaultWorkMinutes) setWorkOverrideMinutes(Number(workInput))
    else setWorkMinutes(Number(workInput))
    setBreakMinutes(Number(breakInput))
    setEditingDuration(false)
  }

  return (
    <div className="inline-timer">
      {breakOfferPending && (
        // Every work stretch (25min by default) fires this notification —
        // resting is opt-in, never automatic — but per user request it's
        // just that: a notification. The countdown below keeps ticking the
        // whole time; only actually accepting the break (the button below)
        // stops it.
        <div className="inline-timer__prompt inline-timer__prompt--rest">
          <div className="inline-timer__prompt-row">
            <strong>{t('focus.breakOfferTitle')}</strong>
            <button type="button" className="inline-timer__mute-btn" onClick={muteRingtone}>
              {t('focus.muteRingtone')}
            </button>
          </div>
          <span>{t('focus.breakOfferBody')}</span>
        </div>
      )}
      {workResumedNotice && (
        // Explains the work-start ringtone that just played when a break
        // ran out on its own (see _tick's 'break' branch) — per user report,
        // that sound used to fire with nothing on screen to say why.
        <div className="inline-timer__prompt inline-timer__prompt--work">
          <div className="inline-timer__prompt-row">
            <strong>{t('focus.workResumedTitle')}</strong>
            <button type="button" className="inline-timer__mute-btn" onClick={muteRingtone}>
              {t('focus.muteRingtone')}
            </button>
          </div>
          <span>{t('focus.workResumedBody')}</span>
        </div>
      )}
      {phase === 'idle' && needsHours ? (
        // No (or exhausted) hours budget — nothing to count down from yet.
        // Same field as the project-creation form (see
        // FocusActivityTimer.jsx), just inline here for a legacy project or
        // one that's run its budget out and needs more assigned.
        <div className="inline-timer__duration-edit">
          <label className="inline-timer__duration-field">
            {t('focus.estimatedTimeLabel')}
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={hoursInput}
              onChange={(e) => setHoursInput(e.target.value)}
              placeholder={t('focus.estimatedTimePlaceholder')}
              autoFocus
            />
          </label>
          <div className="inline-timer__duration-actions">
            <button
              type="button"
              className="inline-timer__btn inline-timer__btn--primary"
              onClick={saveHours}
              disabled={!(Number(hoursInput) > 0)}
            >
              {t('focus.save')}
            </button>
            {onCancel && (
              <button type="button" className="inline-timer__btn" onClick={onCancel}>{t('focus.cancel')}</button>
            )}
          </div>
        </div>
      ) : editingDuration ? (
        <div className="inline-timer__duration-edit">
          <label className="inline-timer__duration-field">
            {t('focus.workDurationLabel')}
            <input
              type="number"
              min="1"
              max="180"
              value={workInput}
              onChange={(e) => setWorkInput(e.target.value)}
              autoFocus
            />
          </label>
          <label className="inline-timer__duration-field">
            {t('focus.breakDurationLabel')}
            <input
              type="number"
              min="1"
              max="60"
              value={breakInput}
              onChange={(e) => setBreakInput(e.target.value)}
            />
          </label>
          <div className="inline-timer__duration-actions">
            <button type="button" className="inline-timer__btn inline-timer__btn--primary" onClick={saveDuration}>
              {t('focus.save')}
            </button>
            <button type="button" className="inline-timer__btn" onClick={() => setEditingDuration(false)}>
              {t('focus.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div
          className={
            'inline-timer__bar-wrap' +
            (isRest ? ' inline-timer__bar-wrap--rest' : '') +
            (isLowTime ? ' inline-timer__bar-wrap--low' : '') +
            (phase === 'idle' && !isProjectSource ? ' inline-timer__bar-wrap--editable' : '')
          }
          onClick={phase === 'idle' && !isProjectSource ? openDurationEditor : undefined}
          role={phase === 'idle' && !isProjectSource ? 'button' : undefined}
          tabIndex={phase === 'idle' && !isProjectSource ? 0 : undefined}
          title={phase === 'idle' && !isProjectSource ? t('focus.editDurationHint') : undefined}
        >
          {phase === 'break' && <div className="inline-timer__phase-label">{t('focus.restLabel')}</div>}
          {/* Per user request — a prominent, hard-to-miss prompt for what to
              actually do during the break, not just a status tag. */}
          {phase === 'break' && <div className="inline-timer__rest-reminder">{t('focus.restReminder')}</div>}
          <div className="inline-timer__digits">
            {isProjectSource ? formatCountdownLong(displaySeconds) : formatCountdown(displaySeconds)}
          </div>
          <div className="inline-timer__bar">
            <div className="inline-timer__bar-fill" style={{ width: `${remainingFraction * 100}%` }} />
          </div>
          {finishTimeLabel && (
            <div className="inline-timer__finish-time">{t('focus.finishesAt', { time: finishTimeLabel })}</div>
          )}
        </div>
      )}

      {!(phase === 'idle' && needsHours) && (
      <div className="inline-timer__controls">
        {breakOfferPending ? (
          <>
            <button type="button" className="inline-timer__btn inline-timer__btn--primary" onClick={acceptBreakOffer}>
              {t('focus.breakOfferAccept')}
            </button>
            <button type="button" className="inline-timer__btn" onClick={declineBreakOffer}>
              {t('focus.breakOfferDecline')}
            </button>
          </>
        ) : phase === 'stopped' ? (
          <>
            <span className="inline-timer__prompt-text">{t('focus.continuePrompt')}</span>
            <button type="button" className="inline-timer__btn" onClick={finish}>{t('focus.cancel')}</button>
            <button type="button" className="inline-timer__btn inline-timer__btn--primary" onClick={continueFocus}>
              {t('focus.continueFocus')}
            </button>
          </>
        ) : (
          <>
            {phase === 'idle' && !editingDuration && (
              <>
                {onCancel && (
                  <button type="button" className="inline-timer__btn" onClick={onCancel}>{t('focus.cancel')}</button>
                )}
                <button
                  type="button"
                  className="inline-timer__btn inline-timer__btn--primary"
                  onClick={() => start(id, { sourceType, workSeconds: workMinutes * 60 })}
                >
                  {t('focus.start')}
                </button>
              </>
            )}
            {phase === 'work' && (
              // Simplified per user request to match the native Timer app's
              // running screen — Cancel ends the session outright (straight
              // to finish(), skipping the old intermediate "stopped" prompt
              // instead of forcing Cancel→Finish through it), Pause is the
              // same suspend-and-resume stopTimer already did, just relabeled.
              <>
                <button type="button" className="inline-timer__btn" onClick={finish}>{t('focus.cancel')}</button>
                <button type="button" className="inline-timer__btn inline-timer__btn--primary" onClick={stopTimer}>
                  {t('focus.pause')}
                </button>
              </>
            )}
            {phase === 'break' && breakSkipsLeft > 0 && (
              <button type="button" className="inline-timer__btn" onClick={skipBreak}>
                {t('focus.skipBreakButton', { left: breakSkipsLeft })}
              </button>
            )}
          </>
        )}
      </div>
      )}

      <div className="sound-picker">
        <button
          type="button"
          className="sound-picker__toggle"
          onClick={() => setSoundMenuOpen((v) => !v)}
          aria-expanded={soundMenuOpen}
        >
          <span>{t('focus.backgroundSound')}: {currentSoundLabel}</span>
          <IconChevronDown size={16} className={'sound-picker__chevron' + (soundMenuOpen ? ' open' : '')} />
        </button>
        {soundMenuOpen && (
          <div className="sound-picker__grid">
            <button
              type="button"
              className={'sound-pill' + (soundId === 'none' ? ' active' : '')}
              onClick={() => pickSound('none')}
            >
              {t('focus.sound.none')}
            </button>
            {AMBIENT_SOUNDS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={'sound-pill' + (soundId === s.id ? ' active' : '')}
                onClick={() => pickSound(s.id)}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
