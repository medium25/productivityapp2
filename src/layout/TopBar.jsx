import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../store/settingsStore.js'

export default function TopBar() {
  const { t } = useTranslation()
  const theme = useSettingsStore((state) => state.theme)
  const toggleTheme = useSettingsStore((state) => state.toggleTheme)

  return (
    <header className="topbar">
      <span className="topbar-title">{t('app.title')}</span>
      <div className="topbar-controls">
        <button
          type="button"
          className="topbar-theme-toggle"
          onClick={toggleTheme}
          aria-label={t('topbar.toggleTheme')}
          title={t('topbar.toggleTheme')}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}
