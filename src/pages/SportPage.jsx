import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WORKOUT_SCHEDULE, CATEGORY_LABEL_KEYS } from '../constants/workoutSchedule'

// Monday-first week of the current date.
function buildCurrentWeek() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayIndex = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - dayIndex)
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d)
  }
  return days
}

export default function SportPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const week = useMemo(() => buildCurrentWeek(), [])

  const dowFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.language, { weekday: 'long' })
    } catch {
      return null
    }
  }, [i18n.language])
  const dateFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' })
    } catch {
      return null
    }
  }, [i18n.language])

  const todayIndex = (new Date().getDay() + 6) % 7

  const dayPlanText = (dayIndex) => {
    const plan = WORKOUT_SCHEDULE[dayIndex]
    if (plan.type === 'rest') return t('sport.restDay')
    if (plan.type === 'running') return t('sport.running')
    return plan.categories.map((c) => t(CATEGORY_LABEL_KEYS[c])).join(', ')
  }

  return (
    <div className="sport-page">
      <div className="sport-week-grid">
        {week.map((date, dayIndex) => {
          const isToday = dayIndex === todayIndex
          return (
            <button
              type="button"
              key={dayIndex}
              className={'sport-day-card' + (isToday ? ' sport-day-card--today' : '')}
              onClick={() => navigate(`/sport/${dayIndex}`)}
            >
              <div className="sport-day-card__header">
                <span className="sport-day-card__name">
                  {dowFormatter ? dowFormatter.format(date) : ''}
                  <span className="sport-day-card__date">
                    {dateFormatter ? dateFormatter.format(date) : ''}
                  </span>
                </span>
                {isToday && <span className="sport-day-card__badge">{t('sport.today')}</span>}
              </div>
              <p className="sport-day-card__plan">{dayPlanText(dayIndex)}</p>
              <span className="sport-day-card__chevron" aria-hidden="true">›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
