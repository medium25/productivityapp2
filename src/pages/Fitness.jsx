import { useTranslation } from 'react-i18next'

// Still the T1 placeholder — the real Fitness UI (form, list, stats,
// filters) is built in T5 using the `fitness.*` i18n keys defined in
// src/i18n/{ru,en,uz}.json.
export default function FitnessPlaceholder() {
  const { t } = useTranslation()
  return (
    <div className="page page-placeholder">
      <h1>{t('fitness.heading')}</h1>
      <p>{t('common.inDevelopment')}</p>
    </div>
  )
}
