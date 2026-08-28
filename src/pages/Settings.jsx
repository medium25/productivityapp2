import { SECTIONS } from '../constants/sections.js'
import { useSettingsStore } from '../store/settingsStore.js'

export default function Settings() {
  const theme = useSettingsStore((state) => state.theme)
  const toggleTheme = useSettingsStore((state) => state.toggleTheme)
  const visibleSections = useSettingsStore((state) => state.visibleSections)
  const toggleSectionVisibility = useSettingsStore(
    (state) => state.toggleSectionVisibility,
  )

  return (
    <div className="page">
      <h1>Настройки</h1>

      <section className="settings-section">
        <h2>Тема</h2>
        <button type="button" className="topbar-theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️ Светлая тема' : '🌙 Тёмная тема'}
        </button>
      </section>

      <section className="settings-section">
        <h2>Видимые разделы</h2>
        <ul className="settings-checkbox-list">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <label>
                <input
                  type="checkbox"
                  checked={visibleSections[section.id] !== false}
                  onChange={() => toggleSectionVisibility(section.id)}
                />
                {section.label}
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/*
        Placeholder: language switcher goes here (T3 — react-i18next wiring,
        writes to useSettingsStore's `language`/`setLanguage`).
      */}

      {/*
        Placeholder: per-section export controls go here (T6 — PDF/Word/
        Excel export buttons per section, e.g. Fitness export via
        src/export/fitness.js).
      */}
    </div>
  )
}
