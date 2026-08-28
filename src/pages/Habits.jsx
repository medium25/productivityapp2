import { useTranslation } from 'react-i18next'

export default function Habits() {
  const { t } = useTranslation()
  return (
    <div className="page page-placeholder">
      <h1>{t('sections.habits')}</h1>
      <p>{t('common.inDevelopment')}</p>
    </div>
  )
}
