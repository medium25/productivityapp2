import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Sidebar from './layout/Sidebar.jsx'
import TopBar from './layout/TopBar.jsx'
import Focus from './pages/Focus.jsx'
import Tasks from './pages/Tasks.jsx'
import Thoughts from './pages/Thoughts.jsx'
import Habits from './pages/Habits.jsx'
import Fitness from './pages/Fitness.jsx'
import Finance from './pages/Finance.jsx'
import Settings from './pages/Settings.jsx'
import { useSettingsStore } from './store/settingsStore.js'

export default function App() {
  const { i18n } = useTranslation()
  const theme = useSettingsStore((state) => state.theme)
  const language = useSettingsStore((state) => state.language)

  // Reflect the current theme on the root element so CSS (see index.css)
  // can style the whole app via `:root[data-theme="dark"]`.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Sync i18next's active language with the persisted settings store value
  // (covers both the initial load and any language change made elsewhere).
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language)
    }
  }, [language, i18n])

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Focus />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/thoughts" element={<Thoughts />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/fitness" element={<Fitness />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
