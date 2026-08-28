import { useTranslation } from 'react-i18next'

export default function Focus() {
  const { t } = useTranslation()
  return (
    <div className="page page-placeholder">
      <h1>{t('sections.focus')}</h1>
      <p>{t('common.inDevelopment')}</p>
    </div>
  )
}
