import { useTranslation } from 'react-i18next'
import { useFocusHistoryStore, dateKey } from '../../store/useFocusHistoryStore'
import { getRangeDates } from './dateRanges'
import { formatDuration } from './timeFormat'

// The day/week/all-time range picker used to live in RankCard, showing one
// total at a time behind a toggle. Moved here, under the timer, with all
// three always visible — no click required to see where the week stands.
export default function FocusTimeSummary() {
  const { t } = useTranslation()
  // Minute-quantized selectors (formatDuration only ever shows whole
  // minutes anyway) instead of subscribing to the raw `seconds` object —
  // that object gets a new reference every second while a session is
  // running, which would otherwise re-render this 59 times more than the
  // displayed text actually changes. See RankCard.jsx for the same fix.
  const todayMinutes = useFocusHistoryStore((s) => Math.floor((s.seconds[dateKey()] || 0) / 60))
  const weekMinutes = useFocusHistoryStore(
    (s) => Math.floor(getRangeDates('week').reduce((sum, d) => sum + (s.seconds[dateKey(d)] || 0), 0) / 60)
  )
  const allMinutes = useFocusHistoryStore(
    (s) => Math.floor(Object.values(s.seconds).reduce((sum, sec) => sum + sec, 0) / 60)
  )

  const rows = [
    { key: 'today', prefix: t('focus.summaryTodayPrefix'), value: todayMinutes * 60 },
    { key: 'week', prefix: t('focus.summaryWeekPrefix'), value: weekMinutes * 60 },
    { key: 'all', prefix: t('focus.summaryAllPrefix'), value: allMinutes * 60 },
  ]

  return (
    <div className="focus-time-summary">
      {rows.map((row) => (
        <p key={row.key} className="focus-time-summary__row">
          {row.prefix}: <strong>{formatDuration(row.value, t)}</strong>
        </p>
      ))}
    </div>
  )
}
