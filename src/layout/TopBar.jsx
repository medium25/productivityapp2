import { useSettingsStore } from '../store/settingsStore.js'

export default function TopBar() {
  const theme = useSettingsStore((state) => state.theme)
  const toggleTheme = useSettingsStore((state) => state.toggleTheme)

  return (
    <header className="topbar">
      <span className="topbar-title">Productivity Hub</span>
      <div className="topbar-controls">
        <button
          type="button"
          className="topbar-theme-toggle"
          onClick={toggleTheme}
          aria-label="Переключить тему"
          title="Переключить тему"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}
