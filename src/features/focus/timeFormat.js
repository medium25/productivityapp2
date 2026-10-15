export function formatDuration(totalSeconds, t) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h > 0) return `${h} ${t('focus.hoursShort')} ${m} ${t('focus.minutesShort')}`
  return `${m} ${t('focus.minutesShort')}`
}

export function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// H:MM:SS — for a Focus project's countdown, which is now the project's
// whole remaining-hours budget (can easily run past 99 minutes), not a
// Pomodoro slot. formatCountdown's bare MM:SS would show "1110:00" for an
// 18h30m budget; this is what the native macOS Timer app's own long-form
// countdown looks like.
export function formatCountdownLong(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}
