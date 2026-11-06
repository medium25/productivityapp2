// Per-day review marks on Insights messages. A message is "repeated" on a day
// when its checkbox was ticked in that day's flashback batch; `reviewDays`
// holds those day keys (UTC-sliced, same buckets as the chat's day groups and
// useInsightsReminderStore). `reviewBase` carries ticks from before dates were
// recorded (the old permanent `done` flag counted as one repeat).

export function reviewDayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function reviewedOn(message, day) {
  return !!message.reviewDays && message.reviewDays.includes(day)
}

// How many times this insight has been repeated over its whole history.
export function reviewCount(message) {
  if (message.reviewDays) return (message.reviewBase || 0) + message.reviewDays.length
  return message.done ? 1 : 0
}
