// Fixed set of fitness workout types. Pairs with the `fitness.types.*` i18n
// keys (see src/i18n/ru.json etc.) — consumers should map over this array
// and resolve labels via t(`fitness.types.${type}`).
export const WORKOUT_TYPES = ['run', 'walk', 'gym', 'cycling', 'swim', 'other']

export default WORKOUT_TYPES
