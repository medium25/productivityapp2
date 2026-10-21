import { Route } from 'react-router-dom'
import FocusPage from '../pages/FocusPage'
import MyFocusPage from '../pages/MyFocusPage'
import SportPage from '../pages/SportPage'
import SportDayPage from '../pages/SportDayPage'
import UpcomingPage from '../pages/UpcomingPage'
import SometimePage from '../pages/SometimePage'
import HabitsPage from '../pages/HabitsPage'
import InboxPage from '../pages/InboxPage'
import InsightsPage from '../pages/InsightsPage'
import ReferenceInfoPage from '../pages/ReferenceInfoPage'
import QaydlarHubPage from '../pages/QaydlarHubPage'
import QaydlarPage from '../pages/QaydlarPage'
import PrinciplesPage from '../pages/PrinciplesPage'
import GtdBoardPage from '../pages/GtdBoardPage'
import ProjectsPage from '../pages/ProjectsPage'
import QaydlarNotePage from '../pages/QaydlarNotePage'
import FinancePage from '../pages/FinancePage'
import ProjectFlowPage from '../pages/ProjectFlowPage'
import CompletedPage from '../pages/CompletedPage'
import TrashPage from '../pages/TrashPage'
import SettingsPage from '../pages/SettingsPage'
import TokovininPage from '../pages/TokovininPage'

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
      <Route path="/settings" element={<SettingsPage />} />
  </>
)
