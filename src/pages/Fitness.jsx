import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFitnessStore } from '../store/fitnessStore.js'
import { WORKOUT_TYPES } from '../constants/workoutTypes.js'

const EMPTY_FORM = {
  type: WORKOUT_TYPES[0],
  date: '',
  durationMin: '',
  calories: '',
  notes: '',
}

function todayISO() {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}

// Local-time midnight for an ISO 'YYYY-MM-DD' date string.
function parseISODate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function startOfWeek(date) {
  // Monday-start week.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay() // 0 = Sunday ... 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diffToMonday)
  return d
}

// Pure, easy to unit-test: totals for the current calendar week (Mon-Sun)
// and the current calendar month, based on each workout's `date`.
export function computeStats(workouts, now = new Date()) {
  const weekStart = startOfWeek(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const stats = {
    week: { count: 0, duration: 0, calories: 0 },
    month: { count: 0, duration: 0, calories: 0 },
  }

  for (const workout of workouts) {
    if (!workout.date) continue
    const workoutDate = parseISODate(workout.date)
    if (Number.isNaN(workoutDate.getTime())) continue

    const duration = Number(workout.durationMin) || 0
    const calories = Number(workout.calories) || 0

    if (workoutDate >= weekStart && workoutDate < weekEnd) {
      stats.week.count += 1
      stats.week.duration += duration
      stats.week.calories += calories
    }
    if (workoutDate >= monthStart && workoutDate < monthEnd) {
      stats.month.count += 1
      stats.month.duration += duration
      stats.month.calories += calories
    }
  }

  return stats
}

export default function Fitness() {
  const { t } = useTranslation()
  const workouts = useFitnessStore((state) => state.workouts)
  const addWorkout = useFitnessStore((state) => state.addWorkout)
  const updateWorkout = useFitnessStore((state) => state.updateWorkout)
  const deleteWorkout = useFitnessStore((state) => state.deleteWorkout)

  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, date: todayISO() }))
  const [editingId, setEditingId] = useState(null)

  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const stats = useMemo(() => computeStats(workouts), [workouts])

  const filteredWorkouts = useMemo(() => {
    return workouts
      .filter((workout) => typeFilter === 'all' || workout.type === typeFilter)
      .filter((workout) => !dateFrom || workout.date >= dateFrom)
      .filter((workout) => !dateTo || workout.date <= dateTo)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [workouts, typeFilter, dateFrom, dateTo])

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, date: todayISO() })
    setEditingId(null)
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const duration = Number(form.durationMin)
    const calories = Number(form.calories)
    if (!form.date || !Number.isFinite(duration) || duration < 0) return
    if (!Number.isFinite(calories) || calories < 0) return

    const entry = {
      type: form.type,
      date: form.date,
      durationMin: duration,
      calories,
      notes: form.notes.trim(),
    }

    if (editingId) {
      updateWorkout(editingId, entry)
    } else {
      addWorkout(entry)
    }
    resetForm()
  }

  const handleEdit = (workout) => {
    setEditingId(workout.id)
    setForm({
      type: workout.type,
      date: workout.date,
      durationMin: String(workout.durationMin),
      calories: String(workout.calories),
      notes: workout.notes || '',
    })
  }

  const handleDelete = (id) => {
    if (window.confirm(t('fitness.actions.deleteConfirm'))) {
      deleteWorkout(id)
      if (editingId === id) resetForm()
    }
  }

  return (
    <div className="page fitness-page">
      <h1>{t('fitness.heading')}</h1>

      <section className="fitness-stats">
        <div className="fitness-stat-card">
          <h3>{t('fitness.stats.thisWeek')}</h3>
          <dl>
            <div>
              <dt>{t('fitness.stats.totalWorkouts')}</dt>
              <dd>{stats.week.count}</dd>
            </div>
            <div>
              <dt>{t('fitness.stats.totalDuration')}</dt>
              <dd>{stats.week.duration}</dd>
            </div>
            <div>
              <dt>{t('fitness.stats.totalCalories')}</dt>
              <dd>{stats.week.calories}</dd>
            </div>
          </dl>
        </div>
        <div className="fitness-stat-card">
          <h3>{t('fitness.stats.thisMonth')}</h3>
          <dl>
            <div>
              <dt>{t('fitness.stats.totalWorkouts')}</dt>
              <dd>{stats.month.count}</dd>
            </div>
            <div>
              <dt>{t('fitness.stats.totalDuration')}</dt>
              <dd>{stats.month.duration}</dd>
            </div>
            <div>
              <dt>{t('fitness.stats.totalCalories')}</dt>
              <dd>{stats.month.calories}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="fitness-form-section">
        <form className="fitness-form" onSubmit={handleSubmit}>
          <div className="fitness-form-row">
            <label htmlFor="fitness-type">{t('fitness.form.type')}</label>
            <select
              id="fitness-type"
              value={form.type}
              onChange={handleFieldChange('type')}
            >
              {WORKOUT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`fitness.types.${type}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="fitness-form-row">
            <label htmlFor="fitness-date">{t('fitness.form.date')}</label>
            <input
              id="fitness-date"
              type="date"
              required
              value={form.date}
              onChange={handleFieldChange('date')}
            />
          </div>

          <div className="fitness-form-row">
            <label htmlFor="fitness-duration">{t('fitness.form.duration')}</label>
            <input
              id="fitness-duration"
              type="number"
              min="0"
              step="1"
              required
              value={form.durationMin}
              onChange={handleFieldChange('durationMin')}
            />
          </div>

          <div className="fitness-form-row">
            <label htmlFor="fitness-calories">{t('fitness.form.calories')}</label>
            <input
              id="fitness-calories"
              type="number"
              min="0"
              step="1"
              required
              value={form.calories}
              onChange={handleFieldChange('calories')}
            />
          </div>

          <div className="fitness-form-row fitness-form-row-notes">
            <label htmlFor="fitness-notes">{t('fitness.form.notes')}</label>
            <textarea
              id="fitness-notes"
              rows={2}
              value={form.notes}
              onChange={handleFieldChange('notes')}
            />
          </div>

          <div className="fitness-form-actions">
            <button type="submit">
              {editingId ? t('fitness.actions.save') : t('fitness.actions.add')}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm}>
                {t('fitness.actions.cancel')}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="fitness-filters">
        <h2>{t('fitness.filters.heading')}</h2>
        <div className="fitness-filters-row">
          <label htmlFor="fitness-filter-type">{t('fitness.filters.byType')}</label>
          <select
            id="fitness-filter-type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">{t('fitness.filters.all')}</option>
            {WORKOUT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`fitness.types.${type}`)}
              </option>
            ))}
          </select>

          <span className="fitness-filters-range-label">
            {t('fitness.filters.byDateRange')}
          </span>
          <label htmlFor="fitness-filter-from">{t('fitness.filters.from')}</label>
          <input
            id="fitness-filter-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <label htmlFor="fitness-filter-to">{t('fitness.filters.to')}</label>
          <input
            id="fitness-filter-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
      </section>

      <section className="fitness-table-wrapper">
        {filteredWorkouts.length === 0 ? (
          <p className="fitness-empty">{t('fitness.list.empty')}</p>
        ) : (
          <table className="fitness-table">
            <thead>
              <tr>
                <th>{t('fitness.table.type')}</th>
                <th>{t('fitness.table.date')}</th>
                <th>{t('fitness.table.duration')}</th>
                <th>{t('fitness.table.calories')}</th>
                <th>{t('fitness.table.notes')}</th>
                <th>{t('fitness.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkouts.map((workout) => (
                <tr key={workout.id}>
                  <td>{t(`fitness.types.${workout.type}`)}</td>
                  <td>{workout.date}</td>
                  <td>{workout.durationMin}</td>
                  <td>{workout.calories}</td>
                  <td>{workout.notes}</td>
                  <td className="fitness-actions-cell">
                    <button type="button" onClick={() => handleEdit(workout)}>
                      {t('fitness.actions.edit')}
                    </button>
                    <button type="button" onClick={() => handleDelete(workout.id)}>
                      {t('fitness.actions.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
