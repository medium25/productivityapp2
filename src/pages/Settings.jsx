import { useTranslation } from 'react-i18next'
import { SECTIONS } from '../constants/sections.js'
import { useSettingsStore } from '../store/settingsStore.js'

const LANGUAGES = ['ru', 'en', 'uz']

export default function Settings() {
  const { t, i18n } = useTranslation()
  const theme = useSettingsStore((state) => state.theme)
  const toggleTheme = useSettingsStore((state) => state.toggleTheme)
  const visibleSections = useSettingsStore((state) => state.visibleSections)
  const toggleSectionVisibility = useSettingsStore(
    (state) => state.toggleSectionVisibility,
  )
  const language = useSettingsStore((state) => state.language)
  const setLanguage = useSettingsStore((state) => state.setLanguage)

  const handleLanguageChange = (lang) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <div className="page">
      <h1>{t('settings.heading')}</h1>

      <section className="settings-section">
        <h2>{t('settings.theme.heading')}</h2>
        <button type="button" className="topbar-theme-toggle" onClick={toggleTheme}>
          {theme === 'dark'
            ? `☀️ ${t('settings.theme.toLight')}`
            : `🌙 ${t('settings.theme.toDark')}`}
        </button>
      </section>

      <section className="settings-section">
        <h2>{t('settings.visibleSections.heading')}</h2>
        <ul className="settings-checkbox-list">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <label>
                <input
                  type="checkbox"
                  checked={visibleSections[section.id] !== false}
                  onChange={() => toggleSectionVisibility(section.id)}
                />
                {t(section.labelKey)}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <h2>{t('settings.language.heading')}</h2>
        <ul className="settings-checkbox-list">
          {LANGUAGES.map((lang) => (
            <li key={lang}>
              <label>
                <input
                  type="radio"
                  name="language"
                  checked={language === lang}
                  onChange={() => handleLanguageChange(lang)}
                />
                {t(`settings.language.${lang}`)}
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
