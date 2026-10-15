import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, nextWeekdayDate, todayISO, TIME_PRESETS, WEEKDAYS } from './taskLogic'
import ModalClose from './ModalClose'

// GTD clarifying-questions wizard — opened for an Inbox (or Later) task
// instead of moving it directly. The answers, not the drop target, decide
// where the task actually ends up:
//   <2 min? --yes--> done now
//           --no--> important now? --no--> Later
//                                  --yes--> one step or many?
//                                             --one--> pick a deadline -> Tasks
//                                             --many--> becomes a Project
const STEPS = ['twoMin', 'important', 'steps', 'deadline', 'projectName']

export default function GtdWizardModal({ task, onClose, onMarkDone, onMoveToLater, onScheduleTask, onConvertToProject }) {
  const { t } = useTranslation()
  const [step, setStep] = useState('twoMin')
  const [history, setHistory] = useState([])
  const [deadlineMode, setDeadlineMode] = useState('today')
  const [deadlineDate, setDeadlineDate] = useState(todayISO())
  // Estimated time to actually do the task — same TIME_PRESETS chips as
  // DueRequiredPrompt's drag-drop gate (Projects/Wishes -> Tasks), so the
  // wizard asks the same two questions (deadline + time) that every other
  // path into Tasks already does.
  const [estimateMinutes, setEstimateMinutes] = useState(null)
  const [projectName, setProjectName] = useState(task.title)

  const goTo = (next) => {
    setHistory((h) => [...h, step])
    setStep(next)
  }
  const goBack = () => {
    setHistory((h) => {
      if (!h.length) return h
      setStep(h[h.length - 1])
      return h.slice(0, -1)
    })
  }

  const finish = (fn) => { fn(); onClose() }

  const pickDeadlineMode = (mode) => {
    const today = todayISO()
    setDeadlineMode(mode)
    if (mode === 'today') setDeadlineDate(today)
    else if (mode === 'tomorrow') setDeadlineDate(addDays(today, 1))
    else if (mode === 'pick') setDeadlineDate((d) => d || today)
  }

  const pickWeekday = (dow) => {
    setDeadlineMode('weekday')
    setDeadlineDate(nextWeekdayDate(todayISO(), dow))
  }

  const stepIndex = STEPS.indexOf(step) === 3 || STEPS.indexOf(step) === 4 ? 3 : STEPS.indexOf(step) + 1

  return (
    <div className="task-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="task-modal gtd-wizard">
        <ModalClose onClick={onClose} />
        <div className="task-modal__header">
          {t('tasks.gtd.wizardTitle')}
          <span className="gtd-wizard__step-counter">{t('tasks.gtd.stepCounter', { current: stepIndex, total: 3 })}</span>
        </div>

        <div className="task-modal__body gtd-wizard__body">
          <div className="gtd-wizard__task-title">{task.title.split('\n')[0]}</div>

          {step === 'twoMin' && (
            <>
              <div className="gtd-wizard__question">{t('tasks.gtd.q1Title')}</div>
              <div className="gtd-wizard__options">
                <button type="button" className="gtd-wizard__option" onClick={() => finish(() => onMarkDone(task.id))}>
                  {t('tasks.gtd.optionYes')}
                </button>
                <button type="button" className="gtd-wizard__option" onClick={() => goTo('important')}>
                  {t('tasks.gtd.optionNo')}
                </button>
              </div>
            </>
          )}

          {step === 'important' && (
            <>
              <div className="gtd-wizard__question">{t('tasks.gtd.q2Title')}</div>
              <div className="gtd-wizard__options">
                <button type="button" className="gtd-wizard__option" onClick={() => finish(() => onMoveToLater(task.id))}>
                  {t('tasks.gtd.optionNo')}
                </button>
                <button type="button" className="gtd-wizard__option" onClick={() => goTo('steps')}>
                  {t('tasks.gtd.optionYes')}
                </button>
              </div>
            </>
          )}

          {step === 'steps' && (
            <>
              <div className="gtd-wizard__question">{t('tasks.gtd.q3Title')}</div>
              <div className="gtd-wizard__options">
                <button type="button" className="gtd-wizard__option" onClick={() => goTo('deadline')}>
                  {t('tasks.gtd.optionOneStep')}
                </button>
                <button type="button" className="gtd-wizard__option" onClick={() => goTo('projectName')}>
                  {t('tasks.gtd.optionManySteps')}
                </button>
              </div>
            </>
          )}

          {step === 'deadline' && (
            <>
              <div className="gtd-wizard__question">{t('tasks.deadlineLabel')}</div>
              <div className="task-modal__chip-group">
                <button type="button" className={'task-modal__chip' + (deadlineMode === 'today' ? ' active' : '')} onClick={() => pickDeadlineMode('today')}>{t('tasks.today')}</button>
                <button type="button" className={'task-modal__chip' + (deadlineMode === 'tomorrow' ? ' active' : '')} onClick={() => pickDeadlineMode('tomorrow')}>{t('tasks.tomorrow')}</button>
                <button type="button" className={'task-modal__chip' + (deadlineMode === 'weekday' ? ' active' : '')} onClick={() => pickDeadlineMode('weekday')}>{t('tasks.weekdayPicker')}</button>
                <button type="button" className={'task-modal__chip' + (deadlineMode === 'pick' ? ' active' : '')} onClick={() => pickDeadlineMode('pick')}>{t('tasks.pickDate')}</button>
              </div>
              {deadlineMode === 'weekday' && (
                <div className="task-modal__chip-group">
                  {WEEKDAYS.map((w) => (
                    <button
                      key={w.dow}
                      type="button"
                      className={'task-modal__chip' + (deadlineDate === nextWeekdayDate(todayISO(), w.dow) ? ' active' : '')}
                      onClick={() => pickWeekday(w.dow)}
                    >
                      {t(`tasks.weekdayShort.${w.key}`)}
                    </button>
                  ))}
                </div>
              )}
              {deadlineMode === 'pick' && (
                <input type="date" value={deadlineDate || ''} onChange={(e) => setDeadlineDate(e.target.value || todayISO())} />
              )}
              <div className="gtd-wizard__question">{t('tasks.timeLabel')}</div>
              <div className="task-modal__due-required-time">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.labelKey}
                    type="button"
                    className={'task-modal__project-option' + (estimateMinutes === preset.minutes ? ' active' : '')}
                    onClick={() => setEstimateMinutes(preset.minutes)}
                  >
                    {t(`tasks.${preset.labelKey}`)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="gtd-wizard__confirm"
                onClick={() => finish(() => onScheduleTask(task.id, deadlineDate, estimateMinutes))}
              >
                {t('tasks.gtd.confirm')}
              </button>
            </>
          )}

          {step === 'projectName' && (
            <>
              <div className="gtd-wizard__question">{t('tasks.gtd.projectNameTitle')}</div>
              <input
                type="text"
                className="focus-create__input"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                maxLength={48}
                autoFocus
              />
              <button
                type="button"
                className="gtd-wizard__confirm"
                disabled={!projectName.trim()}
                onClick={() => finish(() => onConvertToProject(task.id, projectName.trim()))}
              >
                {t('tasks.gtd.confirm')}
              </button>
            </>
          )}
        </div>

        <div className="task-modal__footer">
          {history.length > 0 && (
            <button type="button" onClick={goBack}>{t('tasks.gtd.back')}</button>
          )}
          <button type="button" onClick={onClose}>{t('tasks.cancel')}</button>
        </div>
      </div>
    </div>
  )
}
