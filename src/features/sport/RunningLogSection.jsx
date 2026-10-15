import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkoutStore } from '../../store/useWorkoutStore'

function formatShortDate(iso, language) {
  try {
    return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(new Date(iso))
  }
}

// Running days (Tue/Sat, see workoutSchedule.js) have no exercise catalog
// — just one shared log of runs, distance/pace always required, the three
// heart-rate-zone minute fields optional (0 if left blank) since a manual
// entry without a watch in front of you might not have them.
//
// Note on the `runningLogs` selector below: unlike ExerciseCategorySection's
// `exercises[categoryId] || EMPTY_EXERCISES`, this reads `s.runningLogs`
// directly with no inline fallback, so it doesn't hit the Zustand v5
// useSyncExternalStore infinite-loop footgun Task 5 fixed (a fresh `|| []`
// literal getting a new reference every render) — `state.runningLogs` is
// always the same array reference until logRun actually mutates the store.
export default function RunningLogSection() {
  const { t, i18n } = useTranslation()
  const runningLogs = useWorkoutStore((s) => s.runningLogs)
  const logRun = useWorkoutStore((s) => s.logRun)
  const [distanceKm, setDistanceKm] = useState('')
  const [paceMinPerKm, setPaceMinPerKm] = useState('')
  const [zone1Min, setZone1Min] = useState('')
  const [zone2Min, setZone2Min] = useState('')
  const [zone3Min, setZone3Min] = useState('')

  const canSubmit = distanceKm !== '' && paceMinPerKm !== ''

  const submit = () => {
    if (!canSubmit) return
    logRun({
      distanceKm: Number(distanceKm),
      paceMinPerKm: Number(paceMinPerKm),
      zone1Min: Number(zone1Min) || 0,
      zone2Min: Number(zone2Min) || 0,
      zone3Min: Number(zone3Min) || 0,
    })
    setDistanceKm('')
    setPaceMinPerKm('')
    setZone1Min('')
    setZone2Min('')
    setZone3Min('')
  }

  // Newest first for the history list — the array itself stays append-only
  // chronological (see useWorkoutStore.js's logRun), this just reverses
  // for display.
  const sorted = [...runningLogs].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="sport-category">
      <div className="sport-exercise-row__inputs sport-running-inputs">
        <input
          type="number"
          min="0"
          step="0.1"
          placeholder={t('sport.distanceLabel')}
          value={distanceKm}
          onChange={(e) => setDistanceKm(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="0.1"
          placeholder={t('sport.paceLabel')}
          value={paceMinPerKm}
          onChange={(e) => setPaceMinPerKm(e.target.value)}
        />
        <input
          type="number"
          min="0"
          placeholder={t('sport.zone1Label')}
          value={zone1Min}
          onChange={(e) => setZone1Min(e.target.value)}
        />
        <input
          type="number"
          min="0"
          placeholder={t('sport.zone2Label')}
          value={zone2Min}
          onChange={(e) => setZone2Min(e.target.value)}
        />
        <input
          type="number"
          min="0"
          placeholder={t('sport.zone3Label')}
          value={zone3Min}
          onChange={(e) => setZone3Min(e.target.value)}
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
      <div className="sport-running-history">
        {sorted.length === 0 ? (
          <p className="settings-hint">{t('sport.runHistoryEmpty')}</p>
        ) : (
          sorted.map((run) => (
            <div key={run.id}>
              <p className="sport-running-history__row">
                {t('sport.runEntry', {
                  distance: run.distanceKm,
                  pace: run.paceMinPerKm,
                  date: formatShortDate(run.date, i18n.language),
                })}
              </p>
              {Boolean(run.zone1Min || run.zone2Min || run.zone3Min) && (
                <p className="sport-running-history__zones">
                  {t('sport.runZones', {
                    zone1: run.zone1Min,
                    zone2: run.zone2Min,
                    zone3: run.zone3Min,
                  })}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
