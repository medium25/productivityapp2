import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { CATEGORY_LABEL_KEYS } from '../../constants/workoutSchedule'
import ExerciseLogRow from './ExerciseLogRow'

// Stable reference for the "no exercises yet" fallback — a fresh `[]`
// literal inside the selector would give useSyncExternalStore a new
// snapshot identity on every call and trip its infinite-loop guard.
const EMPTY_EXERCISES = []

// One muscle-group section inside SportDayPage — the exercise catalog
// for this category (added once, reused every week, see
// useWorkoutStore.js's addExercise) plus each exercise's own log row.
export default function ExerciseCategorySection({ categoryId }) {
  const { t } = useTranslation()
  const exercises = useWorkoutStore((s) => s.exercises[categoryId] || EMPTY_EXERCISES)
  const addExercise = useWorkoutStore((s) => s.addExercise)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const submit = () => {
    if (!name.trim()) return
    addExercise(categoryId, name)
    setName('')
    setAdding(false)
  }

  return (
    <div className="sport-category">
      <h3 className="sport-category__title">{t(CATEGORY_LABEL_KEYS[categoryId])}</h3>
      {exercises.map((exercise) => (
        <ExerciseLogRow key={exercise.id} categoryId={categoryId} exercise={exercise} />
      ))}
      {adding ? (
        <div className="sport-category__add-row">
          <input
            type="text"
            className="focus-activity-add__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('sport.exerciseNamePlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') setAdding(false)
            }}
            autoFocus
          />
          <button type="button" className="inline-timer__btn inline-timer__btn--primary" onClick={submit}>
            {t('focus.save')}
          </button>
        </div>
      ) : (
        <button type="button" className="sport-category__add-btn" onClick={() => setAdding(true)}>
          {t('sport.addExercise')}
        </button>
      )}
    </div>
  )
}
