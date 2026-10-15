import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DateCalendar from './DateCalendar'
import { TIME_PRESETS, formatDateBadge, formatEstimateLabel } from './taskLogic'
import ModalClose from './ModalClose'

// Shown on every Inbox/Projects -> Tasks move (per user request) instead
// of silently moving the task — see useSectionDropDateGate.js. Pre-filled
// with the task's current whenDate/estimateMinutes if it has them. Two
// steps: pick/adjust a deadline + estimated time, then confirm the exact
// values before the move actually happens (the last screen restates both
// so nothing lands silently). Clicking outside/Cancel at any point leaves
// the task exactly where it was.
export default function DueRequiredPrompt({ task, onConfirm, onCancel }) {
  const { t, i18n } = useTranslation()
  const [step, setStep] = useState('pick')
  const [date, setDate] = useState(null)
  const [minutes, setMinutes] = useState(null)

  useEffect(() => {
    setStep('pick')
    setDate(task?.whenDate || null)
    setMinutes(task?.estimateMinutes ?? null)
  }, [task?.id])

  if (!task) return null

  const handleConfirm = () => onConfirm(date, minutes)

  return (
    <div className="task-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="task-modal">
        <ModalClose onClick={onCancel} />
        <div className="task-modal__header">{t('tasks.dueRequiredTitle')}</div>
        <div className="task-modal__body">
          {step === 'pick' ? (
            <>
              <p className="task-modal__due-required-text">{t('tasks.dueRequiredBody', { title: task.title })}</p>
              <DateCalendar value={date} onChange={setDate} />
              <div className="task-modal__due-required-time">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.labelKey}
                    type="button"
                    className={'task-modal__project-option' + (minutes === preset.minutes ? ' active' : '')}
                    onClick={() => setMinutes(preset.minutes)}
                  >
                    {t(`tasks.${preset.labelKey}`)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="task-modal__due-required-text">
              {t('tasks.dueRequiredConfirmBody', {
                title: task.title,
                date: formatDateBadge(date, t, i18n.language),
                time: minutes != null ? formatEstimateLabel(minutes) : t('tasks.timeNone'),
              })}
            </p>
          )}
        </div>
        <div className="task-modal__footer">
          {step === 'pick' ? (
            <>
              <button type="button" onClick={onCancel}>{t('tasks.cancel')}</button>
              <button type="button" className="primary" disabled={!date} onClick={() => setStep('confirm')}>
                {t('tasks.nextButton')}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setStep('pick')}>{t('tasks.backButton')}</button>
              <button type="button" className="primary" onClick={handleConfirm}>
                {t('tasks.confirmButton')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
