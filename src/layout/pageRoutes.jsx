import { Route } from 'react-router-dom'
import { lazy } from 'react'

// Pages load on demand (one small chunk each) so the first screen doesn't pay for
// every section; preloadPages() fetches the rest in the background once idle.
const loaders = {
  FocusPage: () => import('../pages/FocusPage'),
  MyFocusPage: () => import('../pages/MyFocusPage'),
  SportPage: () => import('../pages/SportPage'),
  SportDayPage: () => import('../pages/SportDayPage'),
  UpcomingPage: () => import('../pages/UpcomingPage'),
  SometimePage: () => import('../pages/SometimePage'),
  HabitsPage: () => import('../pages/HabitsPage'),
  InboxPage: () => import('../pages/InboxPage'),
  InsightsPage: () => import('../pages/InsightsPage'),
  ReferenceInfoPage: () => import('../pages/ReferenceInfoPage'),
  QaydlarHubPage: () => import('../pages/QaydlarHubPage'),
  QaydlarPage: () => import('../pages/QaydlarPage'),
  PrinciplesPage: () => import('../pages/PrinciplesPage'),
  GtdBoardPage: () => import('../pages/GtdBoardPage'),
  ProjectsPage: () => import('../pages/ProjectsPage'),
  QaydlarNotePage: () => import('../pages/QaydlarNotePage'),
  FinancePage: () => import('../pages/FinancePage'),
  ProjectFlowPage: () => import('../pages/ProjectFlowPage'),
  CompletedPage: () => import('../pages/CompletedPage'),
  TrashPage: () => import('../pages/TrashPage'),
  SettingsPage: () => import('../pages/SettingsPage'),
  TokovininPage: () => import('../pages/TokovininPage'),
  TasksListPage: () => import('../pages/TasksListPage'),
}
const FocusPage = lazy(loaders.FocusPage)
const MyFocusPage = lazy(loaders.MyFocusPage)
const SportPage = lazy(loaders.SportPage)
const SportDayPage = lazy(loaders.SportDayPage)
const UpcomingPage = lazy(loaders.UpcomingPage)
const SometimePage = lazy(loaders.SometimePage)
const HabitsPage = lazy(loaders.HabitsPage)
const InboxPage = lazy(loaders.InboxPage)
const InsightsPage = lazy(loaders.InsightsPage)
const ReferenceInfoPage = lazy(loaders.ReferenceInfoPage)
const QaydlarHubPage = lazy(loaders.QaydlarHubPage)
const QaydlarPage = lazy(loaders.QaydlarPage)
const PrinciplesPage = lazy(loaders.PrinciplesPage)
const GtdBoardPage = lazy(loaders.GtdBoardPage)
const ProjectsPage = lazy(loaders.ProjectsPage)
const QaydlarNotePage = lazy(loaders.QaydlarNotePage)
const FinancePage = lazy(loaders.FinancePage)
const ProjectFlowPage = lazy(loaders.ProjectFlowPage)
const CompletedPage = lazy(loaders.CompletedPage)
const TrashPage = lazy(loaders.TrashPage)
const SettingsPage = lazy(loaders.SettingsPage)
const TokovininPage = lazy(loaders.TokovininPage)
const TasksListPage = lazy(loaders.TasksListPage)

export function preloadPages() {
  Object.values(loaders).forEach((load) => load().catch(() => {}))
}

// The app's page routes, shared by the main router (App.jsx) and the left
// half of the split window (SplitPane.jsx), which renders the same pages
// under its own location.
export const pageRoutes = (
  <>
      <Route path="/focus" element={<FocusPage />} />
      <Route path="/my-focus" element={<MyFocusPage />} />
      <Route path="/sport" element={<SportPage />} />
      <Route path="/qaydlar" element={<QaydlarHubPage />} />
      <Route path="/qaydlar/notes" element={<QaydlarPage collection="notes" />} />
      <Route path="/qaydlar/notes/:cardId" element={<QaydlarNotePage collection="notes" />} />
      <Route path="/qaydlar/knowledge" element={<QaydlarPage collection="knowledge" />} />
      <Route path="/qaydlar/knowledge/:cardId" element={<QaydlarNotePage collection="knowledge" />} />
      <Route path="/finance" element={<FinancePage />} />
      <Route path="/sport/:dayIndex" element={<SportDayPage />} />
      <Route path="/upcoming" element={<UpcomingPage />} />
      <Route path="/upcoming/:view" element={<UpcomingPage />} />
      <Route path="/sometime" element={<SometimePage />} />
      <Route path="/habits" element={<HabitsPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:projectId" element={<ProjectFlowPage />} />
      <Route path="/inbox" element={<InboxPage />} />
      <Route path="/insights" element={<InsightsPage />} />
      <Route path="/principles" element={<PrinciplesPage />} />
      <Route path="/reference-info" element={<ReferenceInfoPage />} />
      <Route path="/custom/:sectionId" element={<GtdBoardPage />} />
      <Route path="/completed" element={<CompletedPage />} />
      <Route path="/trash" element={<TrashPage />} />
      <Route path="/tokovinin" element={<TokovininPage />} />
      <Route path="/tasks" element={<TasksListPage />} />
      <Route path="/settings" element={<SettingsPage />} />
  </>
)
