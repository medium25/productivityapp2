import { createChatStore } from './createChatStore'

// One chat feed per weekday (per user request — "пусть в каждом дне будет
// чат как в телеграме"), same text/photo/voice shape every other chat in
// the app already uses (see createChatStore.js), just 7 separate stores
// instead of one shared feed — Monday's log has nothing to do with
// Friday's. Keyed 0-6 exactly like WORKOUT_SCHEDULE (see
// constants/workoutSchedule.js) — Monday-first. Created eagerly (not
// lazily per dayIndex) so all 7 can be registered in
// rehydrateStores.js's PERSISTED_STORES the same way every other store is.
export const SPORT_DAY_CHAT_STORES = Array.from({ length: 7 }, (_, dayIndex) =>
  createChatStore(`productivity-hub-sport-day-${dayIndex}`)
)

// SportDayPage.jsx's own bubble-color class per day (see
// .insights-chat--sport-mon etc. in index.css) — per user request, "по
// цвету должны отличаться" (each day's chat reads as visually its own).
export const SPORT_DAY_VARIANTS = ['sport-mon', 'sport-tue', 'sport-wed', 'sport-thu', 'sport-fri', 'sport-sat', 'sport-sun']
