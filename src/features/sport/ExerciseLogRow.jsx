import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkoutStore } from '../../store/useWorkoutStore'

// Stable reference for the "no entries yet" fallback — a fresh `[]`
// literal inside the selector would give useSyncExternalStore a new
// snapshot identity on every call and trip its infinite-loop guard.
const EMPTY_ENTRIES = []

function formatShortDate(iso, language) {
  try {
    return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(new Date(iso))
  }
}

// One exercise inside a category section — the "last time" line right
// above the input is the whole point of this feature (per user request:
// "вспомнить сколько поднимал в тот раз"), so it's not tucked into a
// details/history panel, it's always visible.
export default function ExerciseLogRow({ categoryId, exercise }) {
  const { t, i18n } = useTranslation()
  const entries = useWorkoutStore((s) => s.logs[categoryId]?.[exercise.id] || EMPTY_ENTRIES)
  const logExercise = useWorkoutStore((s) => s.logExercise)
  const deleteExercise = useWorkoutStore((s) => s.deleteExercise)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [sets, setSets] = useState('')

  // Append-only + always appended in chronological order (see
  // useWorkoutStore.js's logExercise) — the last array item is the most
  // recent entry, no sorting needed.
  const last = entries[entries.length - 1]

  const canSubmit = weight !== '' && reps !== '' && sets !== ''

  const submit = () => {
    if (!canSubmit) return
    logExercise(categoryId, exercise.id, { weight: Number(weight), reps: Number(reps), sets: Number(sets) })
    setWeight('')
    setReps('')
    setSets('')
  }

  return (
    <div className="sport-exercise-row">
      <div className="sport-exercise-row__header">
        <span className="sport-exercise-row__name">{exercise.name}</span>
        <button
          type="button"
          className="sport-exercise-row__delete"
          onClick={() => deleteExercise(categoryId, exercise.id)}
          aria-label={t('sport.deleteExercise')}
          title={t('sport.deleteExercise')}
        >
          ×
        </button>
      </div>
      <p className="sport-exercise-row__last">
        {last
          ? t('sport.lastTime', {
              weight: last.weight,
              reps: last.reps,
              sets: last.sets,
              date: formatShortDate(last.date, i18n.language),
            })
          : t('sport.noLastTime')}
      </p>
      <div className="sport-exercise-row__inputs">
        <input
          type="number"
          min="0"
          step="0.5"
          placeholder={t('sport.weightLabel')}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <input
          type="number"
          min="0"
          placeholder={t('sport.repsLabel')}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
        />
        <input
          type="number"
          min="0"
          placeholder={t('sport.setsLabel')}
          value={sets}
          onChange={(e) => setSets(e.target.value)}
        />
        <button
          type="button"
          className="inline-timer__btn inline-timer__btn--primary"
          onClick={submit}
          disabled={!canSubmit}
        >
          {t('sport.logButton')}
        </button>
      </div>
    </div>
  )
}
