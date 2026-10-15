import { dateKey } from '../../store/useFocusHistoryStore'

// Shared day-range helpers for the Focus summary and statistics views.
export function startOfDay(d) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function sumSecondsInRange(seconds, start, end) {
  let sum = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    sum += seconds[dateKey(cursor)] || 0
    cursor.setDate(cursor.getDate() + 1)
  }
  return sum
}

export function getRangeDates(range, today = new Date()) {
  const end = startOfDay(today)
  const start = new Date(end)

  if (range === 'week') {
    const dayIndex = (end.getDay() + 6) % 7 // Monday = 0
    start.setDate(end.getDate() - dayIndex)
  } else if (range === 'month') {
    start.setDate(1)
  } else if (range === 'year') {
    start.setMonth(0, 1)
  }
  // 'day' (or unknown): start === end already

  const dates = []
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}
