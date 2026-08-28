import { useTranslation } from 'react-i18next'

export default function Thoughts() {
  const { t } = useTranslation()
  return (
    <div className="page page-placeholder">
      <h1>{t('sections.thoughts')}</h1>
      <p>{t('common.inDevelopment')}</p>
    </div>
  )
}
