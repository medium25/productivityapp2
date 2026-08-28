import { useTranslation } from 'react-i18next'

export default function Tasks() {
  const { t } = useTranslation()
  return (
    <div className="page page-placeholder">
      <h1>{t('sections.tasks')}</h1>
      <p>{t('common.inDevelopment')}</p>
    </div>
  )
}
