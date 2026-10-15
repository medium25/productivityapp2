import { useTranslation } from 'react-i18next'
import QuranPlayer from '../features/quran/QuranPlayer'
import AmbientSoundPicker from '../features/focus/AmbientSoundPicker'
import WeeklyActivityChart from '../features/focus/WeeklyActivityChart'
import { useQuranStore } from '../store/useQuranStore'
import { dateKey } from '../store/useFocusHistoryStore'
import { getRangeDates } from '../features/focus/dateRanges'
import { formatDuration } from '../features/focus/timeFormat'
import { useCurrentRank } from '../features/focus/useCurrentRank'

// "My Focus" is a Quran-listening space now (per user request — the
// Pomodoro timer that used to live here moved to Results; this page is the
// recitation player plus a background-sound picker). The stat block that
// used to count focus minutes now counts time spent actually listening to
// the Quran — today as a big number, the week as a line + the Mon-Sun bar
// chart, both read off useQuranStore.listened.
export default function MyFocusPage() {
  const { t } = useTranslation()
  const rank = useCurrentRank()

  // Full map for the chart; today/week as primitives so the per-second
  // listened-counter tick (see QuranPlayer) doesn't needlessly re-render
  // the hero number between whole-minute changes.
  const listened = useQuranStore((s) => s.listened)
  const todayMinutes = useQuranStore((s) => Math.floor((s.listened[dateKey()] || 0) / 60))
  const weekSeconds = useQuranStore(
    (s) => getRangeDates('week').reduce((sum, d) => sum + (s.listened[dateKey(d)] || 0), 0)
  )

  return (
    <div className="my-focus-quran">
      <div className="my-focus-stats-row">
        <div className="my-focus-hero-stat">
          <p className="my-focus-hero-stat__label">{t('quran.listenedTodayLabel')}</p>
          <p className="my-focus-hero-stat__value">
            {todayMinutes}
            <span>{t('focus.minutesShort')}</span>
          </p>
          <p className="my-focus-hero-stat__week">
            {t('quran.listenedWeekLine', { duration: formatDuration(weekSeconds, t) })}
          </p>
        </div>
        <WeeklyActivityChart color={rank.color} showTotal={false} dailySeconds={listened} />
      </div>

      <AmbientSoundPicker />
      <QuranPlayer />
    </div>
  )
}
