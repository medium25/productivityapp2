// The user's fixed weekly training split — hardcoded per user request (see
// docs/superpowers/specs/2026-08-28-sport-tracker-design.md's "Out of
// scope: editing the weekly schedule in the UI"). Keyed 0-6, Monday-first,
// matching the same (getDay()+6)%7 convention WeeklyActivityChart.jsx's
// buildCurrentWeek already uses elsewhere in this app.
export const CATEGORIES = [
  { id: 'chest', labelKey: 'sport.category.chest' },
  { id: 'biceps', labelKey: 'sport.category.biceps' },
  { id: 'triceps', labelKey: 'sport.category.triceps' },
  { id: 'shoulders', labelKey: 'sport.category.shoulders' },
  { id: 'legs', labelKey: 'sport.category.legs' },
  // The user's own gym-slang term for their back/lats day — kept verbatim
  // rather than translated to "Back", it's their vocabulary.
  { id: 'back', labelKey: 'sport.category.back' },
]

export const CATEGORY_LABEL_KEYS = CATEGORIES.reduce((acc, c) => {
  acc[c.id] = c.labelKey
  return acc
}, {})

export const WORKOUT_SCHEDULE = {
  0: { type: 'rest', categories: [] }, // Monday
  1: { type: 'running', categories: [] }, // Tuesday
  2: { type: 'strength', categories: ['chest', 'biceps'] }, // Wednesday
  3: { type: 'strength', categories: ['legs', 'shoulders'] }, // Thursday
  4: { type: 'strength', categories: ['back', 'triceps'] }, // Friday
  5: { type: 'running', categories: [] }, // Saturday
  6: { type: 'strength', categories: ['legs', 'chest', 'shoulders', 'back'] }, // Sunday
}
