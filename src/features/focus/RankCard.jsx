import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusHistoryStore } from '../../store/useFocusHistoryStore'
import { useFocusRankStore } from '../../store/useFocusRankStore'
import { TIER_ORDER, buildRanks, getRankIndexForPoints, romanNumeral } from './ranks'
import { RANK_ICONS } from './RankIcons'

function RankBadge({ tier, sub, color, achieved, current, size, label }) {
  const Icon = RANK_ICONS[tier]
  return (
    <div
      className={'rank-badge-icon' + (current ? ' current' : '') + (achieved ? '' : ' dim')}
      style={{ color }}
      title={label}
    >
      <Icon size={size} filled={achieved} />
      {sub && <span className="rank-badge-icon__sub">{romanNumeral(sub)}</span>}
    </div>
  )
}

const RAY_COUNT = 16

// A tapering sunburst — each ray a triangle from a shared base radius out to
// its tip, alternating long/short — with a bright glowing core behind the
// badge. The gradient is pinned to the true center in userSpaceOnUse
// coordinates, so it fades every ray from bright-at-center to
// transparent-at-tip identically regardless of that ray's own rotation.
function RankRays() {
  const rays = Array.from({ length: RAY_COUNT })
  return (
    // The plain outer div (sized via inset, no transform) establishes the
    // box; the animated/rotated element is the inner svg, given an explicit
    // 100%x100% size instead of relying on inset to auto-size a replaced
    // element. WebKit (Tauri's WKWebView) appears to compute the rotated
    // element's box from its un-stretched intrinsic size rather than the
    // inset-stretched one when position:absolute + inset + transform land
    // on the same element — Chrome doesn't show this, but splitting the
    // sizing and the rotating transform onto two elements sidesteps it.
    <div className="rank-hero__rays">
      <svg className="rank-hero__rays-spin" viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <defs>
          <radialGradient id="rankRayGradient" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="48">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="20" fill="url(#rankRayGradient)" />
        {rays.map((_, i) => {
          const long = i % 2 === 0
          const halfWidth = long ? 3.4 : 2.2
          const tipRadius = long ? 47 : 33
          const baseRadius = 13
          const angle = i * (360 / rays.length)
          const d = `M ${50 - halfWidth} ${50 - baseRadius} L ${50 + halfWidth} ${50 - baseRadius} L 50 ${50 - tipRadius} Z`
          return <path key={i} d={d} fill="url(#rankRayGradient)" transform={`rotate(${angle} 50 50)`} />
        })}
      </svg>
    </div>
  )
}

// A single continuous ring showing exactly the same number as the "N%" text
// next to it — progress toward the next sublevel. An earlier version showed
// a 3-segment ring here (how many sublevels already reached), but that's a
// different number than the percent text right below it, and the two
// disagreeing at a glance ("ring looks 2/3 full, text says 95%") read as
// broken rather than as two separate metrics. One ring, one meaning.
function RankProgressRing({ fraction, color }) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const dash = Math.max(0, Math.min(1, fraction)) * circumference
  return (
    <svg className="rank-hero__level-ring" viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--control-bg)" strokeWidth="4" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference - dash}`}
        transform="rotate(-90 50 50)"
      />
    </svg>
  )
}

// The time-range picker (day/week/all-time) that used to live here moved out
// to FocusTimeSummary, shown under the timer instead — see FocusPage.jsx.
// This card is just identity now: which rank, how close to the next one,
// and the full ladder of tiers reached so far.
export default function RankCard() {
  const { t } = useTranslation()
  // Selects the already-reduced whole-minute count (not the raw `seconds`
  // object) so zustand's Object.is bail-out actually kicks in — the Pomodoro
  // tick replaces `seconds` every 1s while a session runs, but this card's
  // rank/points are minute-granularity, so re-rendering the rays/ring/ladder
  // SVGs every single second for the whole session is wasted work.
  const totalMinutes = useFocusHistoryStore(
    (s) => Math.floor(Object.values(s.seconds).reduce((sum, sec) => sum + sec, 0) / 60)
  )
  const penalty = useFocusRankStore((s) => s.penalty)
  const [showInfo, setShowInfo] = useState(false)

  const ranks = useMemo(() => buildRanks(), [])

  const points = Math.max(0, totalMinutes - penalty)

  const currentIndex = getRankIndexForPoints(ranks, points)
  const currentRank = ranks[currentIndex]
  const nextRank = ranks[currentIndex + 1]

  const progressFraction = nextRank
    ? (points - currentRank.threshold) / (nextRank.threshold - currentRank.threshold)
    : 1
  const progressPercent = Math.round(Math.min(100, Math.max(0, progressFraction * 100)))

  const tierLabel = (tier) => t(`focus.rankTier.${tier}`)

  const tierReached = (tier) => {
    const firstRankOfTier = ranks.find((r) => r.tier === tier)
    return firstRankOfTier.index <= currentIndex
  }

  // Sub 3 (just entered the tier) -> 1 pip lit; sub 1 (about to promote to
  // the next tier) -> all 3. Separate from the ring/percent above (which is
  // about the next single sublevel) — this is "where am I within this tier",
  // a different question, shown as its own small indicator so the two don't
  // read as disagreeing with each other.
  const litPips = currentRank.sub != null ? 4 - currentRank.sub : 3

  return (
    <div className="rank-hero rank-hero--centered">
      <div className="rank-hero__badge-wrap">
        <RankRays />
        <RankProgressRing fraction={progressFraction} color={currentRank.color} />
        <RankBadge
          tier={currentRank.tier}
          sub={currentRank.sub}
          color={currentRank.color}
          achieved
          current
          size={72}
          label={tierLabel(currentRank.tier)}
        />
      </div>

      <div className="rank-hero__name">
        {tierLabel(currentRank.tier)}{currentRank.sub ? ` ${romanNumeral(currentRank.sub)}` : ''}
      </div>
      {currentRank.sub != null && (
        <div className="rank-hero__pips" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={'rank-hero__pip' + (i <= litPips ? ' lit' : '')}
              style={i <= litPips ? { background: currentRank.color } : undefined}
            />
          ))}
        </div>
      )}
      <div className="rank-hero__subtitle">{t('focus.yourRank')}</div>

      <div className="rank-hero__points-wrap">
        <div className="rank-hero__points">
          {t('focus.rankPointsLabel', { count: points })}
          {nextRank && <> · {t('focus.rankProgressToNext', { percent: progressPercent })}</>}
          <button
            type="button"
            className="rank-info-btn"
            onClick={() => setShowInfo((v) => !v)}
            aria-label={t('focus.rankInfoLabel')}
          >
            i
          </button>
        </div>
        {showInfo && (
          <div className="rank-info-popover rank-info-popover--centered">
            <div className="rank-info-popover__rows">
              <div className="rank-info-popover__row">
                <span>{t('focus.rankCalcMinutes')}</span>
                <span>{totalMinutes}</span>
              </div>
              <div className="rank-info-popover__row">
                <span>{t('focus.rankCalcPenalty')}</span>
                <span>−{penalty}</span>
              </div>
              <div className="rank-info-popover__row rank-info-popover__row--total">
                <span>{t('focus.rankCalcTotal')}</span>
                <span>{points}</span>
              </div>
            </div>
            <p>{t('focus.rankFromFocusNote')}</p>
            <p>{t('focus.rankPenaltyNote')}</p>
          </div>
        )}
      </div>

      {!nextRank && <div className="rank-hero__next">{t('focus.rankMax')}</div>}

      <div className="rank-ladder-line">
        {TIER_ORDER.map((tier) => (
          <RankBadge
            key={tier}
            tier={tier}
            sub={null}
            color={ranks.find((r) => r.tier === tier).color}
            achieved={tierReached(tier)}
            current={currentRank.tier === tier}
            size={26}
            label={tierLabel(tier)}
          />
        ))}
        <RankBadge
          tier="conqueror"
          sub={null}
          color={ranks.find((r) => r.tier === 'conqueror').color}
          achieved={tierReached('conqueror')}
          current={currentRank.tier === 'conqueror'}
          size={26}
          label={tierLabel('conqueror')}
        />
      </div>
    </div>
  )
}
