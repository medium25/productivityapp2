import { useEffect } from 'react'
import { useTasksStore } from './store/useTasksStore'
import { LEGACY_ROUTINE_TITLES } from './features/tasks/dailyRoutineTasks'
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { pageRoutes } from './layout/pageRoutes'
import { useTranslation } from 'react-i18next'
import Sidebar from './layout/Sidebar'
import TopBar from './layout/TopBar'
import SplitPane, { SplitPaneBar, usePaneTitle } from './layout/SplitPane'
import { useSplitViewStore } from './store/useSplitViewStore'
import AuthPage from './features/auth/AuthPage'
import ProjectCompletionPrompt from './features/tasks/ProjectCompletionPrompt'
import QuranAudioHost from './features/quran/QuranAudioHost'
import { useUndoShortcut } from './features/tasks/useUndoShortcut'
import { useSettingsStore } from './store/useSettingsStore'
import { useAuthStore } from './store/useAuthStore'

function Layout() {
  useUndoShortcut()
  const splitOpen = useSplitViewStore((s) => s.open)
  const { pathname } = useLocation()
  const rightTitle = usePaneTitle(pathname)
  // One-off rename of routine tasks whose title changed (silent — no undo step).
  const tasks = useTasksStore((s) => s.tasks)
  // Recurring tasks roll into Today at 0:00 (see rollRecurringToToday) —
  // idempotent, so also run whenever tasks load/change, plus a timer for the
  // next local midnight and a re-check when the window regains focus (the
  // laptop may have slept through midnight).
  useEffect(() => {
    useTasksStore.getState().rollRecurringToToday()
  }, [tasks])
  useEffect(() => {
    let timer
    const schedule = () => {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2)
      timer = setTimeout(() => { useTasksStore.getState().rollRecurringToToday(); schedule() }, next - now)
    }
    const recheck = () => { if (document.visibilityState !== 'hidden') useTasksStore.getState().rollRecurringToToday() }
    schedule()
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [])
  useEffect(() => {
    if (!tasks.some((tk) => LEGACY_ROUTINE_TITLES[tk.title])) return
    useTasksStore.setState((state) => ({
      tasks: state.tasks.map((tk) => (LEGACY_ROUTINE_TITLES[tk.title] ? { ...tk, title: LEGACY_ROUTINE_TITLES[tk.title] } : tk)),
    }))
  }, [tasks])
  return (
    <div className="app-shell">
      <div className="app-backdrop" aria-hidden="true" />
      <Sidebar />
      <div className="main-column">
        <TopBar />
        {splitOpen ? (
          <div className="split-view">
            <div className="split-col"><SplitPane /></div>
            <div className="split-col">
              <SplitPaneBar title={rightTitle} />
              <div className="page-content"><Outlet /></div>
            </div>
          </div>
        ) : (
          <div className="page-content">
            <Outlet />
          </div>
        )}
      </div>
      <ProjectCompletionPrompt />
      <QuranAudioHost />
    </div>
  )
}

function useAppliedTheme() {
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])
}

export default function App() {
  const { t, i18n } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const user = useAuthStore((s) => s.user)
  const authStatus = useAuthStore((s) => s.status)
  useAppliedTheme()

  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language)
    }
  }, [language, i18n])

  if (authStatus === 'loading') {
    return <div className="auth-loading">{t('auth.loading')}</div>
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/focus" replace />} />
          {pageRoutes}
        </Route>
      </Routes>
    </HashRouter>
  )
}
