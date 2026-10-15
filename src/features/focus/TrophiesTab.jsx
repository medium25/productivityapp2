import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusHistoryStore } from '../../store/useFocusHistoryStore'
import { useFocusRankStore } from '../../store/useFocusRankStore'
import { useTrophiesStore, STREAK_MILESTONES } from '../../store/useTrophiesStore'
import { buildRanks, getRankIndexForPoints, TIER_ORDER, TIER_COLORS } from './ranks'
import { RANK_ICONS } from './RankIcons'

const LEGENDARY_COLOR = '#FFD700'

function milestoneColor(index) {
  const colors = [
    TIER_COLORS.bronze, TIER_COLORS.iron, TIER_COLORS.silver, TIER_COLORS.gold, TIER_COLORS.platinum,
    TIER_COLORS.diamond, TIER_COLORS.sapphire, TIER_COLORS.crown, TIER_COLORS.conqueror, LEGENDARY_COLOR,
  ]
  return colors[index] ?? LEGENDARY_COLOR
}

function OrderMedal({ color, children, label, sublabel }) {
  return (
    <div className="order-medal">
      <div className="order-medal__badge" style={{ '--medal-color': color }}>{children}</div>
      <div className="order-medal__ribbon" style={{ '--medal-color': color }} />
      <div className="order-medal__label">{label}</div>
      {sublabel && <div className="order-medal__sublabel">{sublabel}</div>}
    </div>
  )
}

export default function TrophiesTab() {
  const { t, i18n } = useTranslation()
  const seconds = useFocusHistoryStore((s) => s.seconds)
  const penalty = useFocusRankStore((s) => s.penalty)
  const streakTrophies = useTrophiesStore((s) => s.streakTrophies)
  const competitionTrophies = useTrophiesStore((s) => s.competitionTrophies)

  const ranks = useMemo(() => buildRanks(), [])
  const totalMinutes = useMemo(
    () => Math.floor(Object.values(seconds).reduce((sum, s) => sum + s, 0) / 60),
    [seconds]
  )
  const points = Math.max(0, totalMinutes - penalty)
  const currentIndex = getRankIndexForPoints(ranks, points)

  const rankTiers = useMemo(() => [...TIER_ORDER, 'conqueror'], [])
  const achievedTiers = rankTiers.filter((tier) => ranks.find((r) => r.tier === tier).index <= currentIndex)

  const formatDate = (value) => {
    try {
      return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
    } catch {
      return String(value)
    }
  }

  const tierLabel = (tier) => t(`focus.rankTier.${tier}`)

  return (
    <div className="trophies-tab">
      <section className="trophies-section">
        <h2 className="focus-stats__heading">{t('focus.trophiesStreakHeading')}</h2>
        {streakTrophies.length === 0 ? (
          <p className="settings-hint">{t('focus.trophiesStreakEmpty')}</p>
        ) : (
          <div className="order-medal-grid">
            {[...streakTrophies]
              .sort((a, b) => b.milestone - a.milestone || b.awardedAt - a.awardedAt)
              .map((trophy) => (
                <OrderMedal
                  key={trophy.id}
                  color={milestoneColor(STREAK_MILESTONES.indexOf(trophy.milestone))}
                  label={t('focus.trophyStreakLabel', { count: trophy.milestone })}
                  sublabel={formatDate(trophy.awardedAt)}
                >
                  {trophy.milestone}
                </OrderMedal>
              ))}
          </div>
        )}
      </section>

      <section className="trophies-section">
        <h2 className="focus-stats__heading">{t('focus.trophiesCompetitionHeading')}</h2>
        {competitionTrophies.length === 0 ? (
          <p className="settings-hint">{t('focus.trophiesCompetitionEmpty')}</p>
        ) : (
          <div className="order-medal-grid">
            {[...competitionTrophies]
              .sort((a, b) => new Date(b.awardedAt) - new Date(a.awardedAt))
              .map((trophy) => (
                <OrderMedal
                  key={trophy.id}
                  color={TIER_COLORS.crown}
                  label={t('focus.trophyCompetitionLabel', { name: trophy.opponentEmail })}
                  sublabel={formatDate(trophy.awardedAt)}
                >
                  ★
                </OrderMedal>
              ))}
          </div>
        )}
      </section>

      <section className="trophies-section">
        <h2 className="focus-stats__heading">{t('focus.trophiesRankHeading')}</h2>
        {achievedTiers.length === 0 ? (
          <p className="settings-hint">{t('focus.trophiesRankEmpty')}</p>
        ) : (
          <div className="order-medal-grid">
            {achievedTiers.map((tier) => {
              const Icon = RANK_ICONS[tier]
              return (
                <OrderMedal key={tier} color={TIER_COLORS[tier]} label={tierLabel(tier)}>
                  <Icon size={26} filled />
                </OrderMedal>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
