import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WORKOUT_SCHEDULE } from '../constants/workoutSchedule'
import InsightsChat from '../features/tasks/InsightsChat'
import { SPORT_DAY_CHAT_STORES, SPORT_DAY_VARIANTS } from '../store/useSportDayChatStore'

// Same Monday-first "current week" recipe as SportPage.jsx's buildCurrentWeek
// (duplicated rather than shared, same reasoning as that file's own
// comment) — this page only ever needs one day's date, not the whole week.
function dateForDayIndex(dayIndex) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentDayIndex = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - currentDayIndex)
  const d = new Date(monday)
  d.setDate(monday.getDate() + dayIndex)
  return d
}

// Reached from SportPage.jsx's day-card grid — a real page (its own route,
// back button, browser-back-compatible) instead of a modal, per user
// request. Used to render structured exercise-logging widgets per day
// (ExerciseCategorySection/RunningLogSection, categories/type-specific) —
// per later user request ("надо сделать чат сплошным убрать orqa или
// triseps, нужен просто чат") that's gone now for every day type
// (strength/running/rest alike), replaced with just the day's own chat
// filling the page. Those components/useWorkoutStore.js are untouched, not
// deleted — this page just doesn't render them anymore.
export default function SportDayPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { dayIndex } = useParams()
  const index = Number(dayIndex)
  const plan = WORKOUT_SCHEDULE[index]

  const dowFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.language, { weekday: 'long' })
    } catch {
      return null
    }
  }, [i18n.language])
  const dateFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' })
    } catch {
      return null
    }
  }, [i18n.language])

  const goBack = () => navigate('/sport')

  // An out-of-range/garbage :dayIndex (typed URL, stale link) has nothing
  // to show — same "guard and bail" shape the old modal used (`if (!day)
  // return null`), just with a way back since this is a real page now.
  if (!plan) {
    return (
      <div className="sport-page sport-day-page">
        <button type="button" className="sport-day-page__back" onClick={goBack}>
          ← {t('sport.backToWeek')}
        </button>
      </div>
    )
  }

  const date = dateForDayIndex(index)
  const label = dowFormatter ? dowFormatter.format(date) : ''
  const dateLabel = dateFormatter ? dateFormatter.format(date) : ''

  return (
    // Same edge-to-edge + .tasks-column--insights glass-chat frame Data/
    // Insights/Analysis already use (see ReferenceInfoPage.jsx) — reused
    // here rather than hand-rolling a new fixed-height box, so the chat
    // genuinely fills the page ("чат сплошным", per user request) instead
    // of sitting in a small box under the (now-removed) exercise widgets.
    <div className="tasks-page tasks-page--edge-to-edge">
      <div className="tasks-board tasks-board--fill tasks-board--inbox">
        <div className="tasks-column tasks-column--insights">
          <div className="sport-day-page__chat-header">
            <button type="button" className="sport-day-page__back" onClick={goBack}>
              ← {t('sport.backToWeek')}
            </button>
            <h1 className="sport-day-page__title">
              {label}
              <span className="sport-day-page__date">{dateLabel}</span>
            </h1>
          </div>
          {/* Per-day chat (per user request — "пусть в каждом дне будет
              чат как в телеграме"), same text/photo/voice feed every other
              chat in the app uses, one separate store per weekday (see
              useSportDayChatStore.js) so a note on Monday never bleeds
              into Friday's log. Each day's own bubble color
              (SPORT_DAY_VARIANTS, see index.css's .insights-chat--sport-*
              rules). */}
          <InsightsChat useStore={SPORT_DAY_CHAT_STORES[index]} variant={SPORT_DAY_VARIANTS[index]} />
        </div>
      </div>
    </div>
  )
}
