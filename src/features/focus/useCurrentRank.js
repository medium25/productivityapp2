import { useMemo } from 'react'
import { useFocusHistoryStore } from '../../store/useFocusHistoryStore'
import { useFocusRankStore } from '../../store/useFocusRankStore'
import { buildRanks, getRankIndexForPoints } from './ranks'

// Same points → rank calculation RankCard.jsx does inline, pulled out here
// so other UI (the My day timer's color, see MyDayTimer.jsx) can read
// "the current rank" — and get a live update the moment it changes — without
// duplicating the three-store lookup.
export function useCurrentRank() {
  const totalMinutes = useFocusHistoryStore(
    (s) => Math.floor(Object.values(s.seconds).reduce((sum, sec) => sum + sec, 0) / 60)
  )
  const penalty = useFocusRankStore((s) => s.penalty)
  const ranks = useMemo(() => buildRanks(), [])
  const points = Math.max(0, totalMinutes - penalty)
  const currentIndex = getRankIndexForPoints(ranks, points)
  return ranks[currentIndex]
}
