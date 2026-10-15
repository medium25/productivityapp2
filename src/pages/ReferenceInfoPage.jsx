import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IconBack } from '../icons/Icons'
import InsightsChat from '../features/tasks/InsightsChat'
import { makeChatToTaskHandlers } from '../features/tasks/chatMessageToTask'
import { useReferenceInfoStore } from '../store/useReferenceInfoStore'
import { useTelegramPoll } from '../features/telegram/useTelegramPoll'

// Same shape as InsightsPage.jsx (per user request — "справочная
// информация" должна выглядеть точно как Insights) — just its own store
// passed into the shared InsightsChat component. Dragging a message onto a task-bucket
// sidebar link (Inbox / Vazifalar / Sometime) spins it off into a task
// (chatMessageToTask.js) — the message stays in the chat.
export default function ReferenceInfoPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  useTelegramPoll(useReferenceInfoStore)
  const taskDropHandlers = useMemo(() => makeChatToTaskHandlers(useReferenceInfoStore), [])

  return (
    <div className="tasks-page tasks-page--edge-to-edge">
      <div className="tasks-hub__back">
        <button type="button" className="page-back" onClick={() => navigate('/upcoming')}>
          <IconBack size={14} /> {t('sections.upcoming.title')}
        </button>
      </div>
      <div className="tasks-board tasks-board--fill">
        <div className="tasks-column tasks-column--insights">
          <InsightsChat useStore={useReferenceInfoStore} variant="reference" {...taskDropHandlers} />
        </div>
      </div>
    </div>
  )
}
