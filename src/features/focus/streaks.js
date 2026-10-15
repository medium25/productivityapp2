import { dateKey } from '../../store/useFocusHistoryStore'

// Consecutive days (ending today, or yesterday if today has no session
// yet — the day isn't over, so it shouldn't break the streak early).
export function computeCurrentStreak(seconds, today) {
  let streak = 0
  const cursor = new Date(today)
  if (!((seconds[dateKey(cursor)] || 0) > 0)) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while ((seconds[dateKey(cursor)] || 0) > 0) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
