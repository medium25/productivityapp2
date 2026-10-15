import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusRankStore } from '../store/useFocusRankStore'
import { useFocusHistoryStore } from '../store/useFocusHistoryStore'
import { useFocusUiStore } from '../store/useFocusUiStore'
import { useTrophiesStore } from '../store/useTrophiesStore'
import { computeCurrentStreak } from '../features/focus/streaks'
import { startOfDay } from '../features/focus/dateRanges'
import FocusStatistics from '../features/focus/FocusStatistics'
import RankCard from '../features/focus/RankCard'
import TrophiesTab from '../features/focus/TrophiesTab'
import FocusTimeSummary from '../features/focus/FocusTimeSummary'

export default function FocusPage() {
  const { t } = useTranslation()
  const selectedId = useFocusUiStore((s) => s.selectedProjectId)
  const [tab, setTab] = useState('projects') // projects | statistics | trophies

  useEffect(() => {
    useFocusRankStore.getState().reconcile()
    const { seconds } = useFocusHistoryStore.getState()
    const streak = computeCurrentStreak(seconds, startOfDay(new Date()))
    useTrophiesStore.getState().checkStreakMilestones(streak)
  }, [])

  // Jumping here from the floating widget (double-click) or elsewhere
  // always means "show me this project" — make sure the Projects tab is
  // actually the one showing.
  useEffect(() => {
    if (selectedId) setTab('projects')
  }, [selectedId])

  // Lets the floating timer widget (mounted at the app root) know whether
  // it's safe to show — the hero timer used to live on Projects and hide
  // it there to avoid a duplicate, but that hero card is gone now (per user
  // request, removed from this tab entirely), so Statistics has no room for
  // the floating bubble.
  useEffect(() => {
    useFocusUiStore.getState().setTimerViewOpen(tab === 'statistics')
    return () => useFocusUiStore.getState().setTimerViewOpen(false)
  }, [tab])

  return (
    <div className="focus-page">
      <div className="focus-tabs">
        <button
          type="button"
          className={'focus-tabs__item' + (tab === 'projects' ? ' active' : '')}
          onClick={() => setTab('projects')}
        >
          {t('focus.tabProjects')}
        </button>
        <button
          type="button"
          className={'focus-tabs__item' + (tab === 'statistics' ? ' active' : '')}
          onClick={() => setTab('statistics')}
        >
          {t('focus.tabStatistics')}
        </button>
        <button
          type="button"
          className={'focus-tabs__item' + (tab === 'trophies' ? ' active' : '')}
          onClick={() => setTab('trophies')}
        >
          {t('focus.tabTrophies')}
        </button>
      </div>

      {tab === 'projects' && (
        <>
          <RankCard />
          <FocusTimeSummary />
        </>
      )}
      {tab === 'statistics' && <FocusStatistics />}
      {tab === 'trophies' && <TrophiesTab />}
    </div>
  )
}
