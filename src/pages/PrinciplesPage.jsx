import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsChat from '../features/tasks/InsightsChat'
import { makeChatToTaskHandlers } from '../features/tasks/chatMessageToTask'
import { usePrinciplesStore } from '../store/usePrinciplesStore'
import { useTelegramPoll } from '../features/telegram/useTelegramPoll'

// Same shape as ReferenceInfoPage.jsx (per user request — "Анализ" should
// look and behave exactly like Data's chat) — just its own store passed
// into the shared InsightsChat component. See usePrinciplesStore.js for how
// the old table-with-checkmarks data got migrated into this feed. Messages
// can be dragged onto a task-bucket sidebar link to spin off a task
// (chatMessageToTask.js).
export default function PrinciplesPage() {
  const { t } = useTranslation()
  useTelegramPoll(usePrinciplesStore)
  const taskDropHandlers = useMemo(() => makeChatToTaskHandlers(usePrinciplesStore), [])

  return (
    <div className="tasks-page tasks-page--edge-to-edge">
      <div className="tasks-board tasks-board--fill tasks-board--inbox">
        <div className="tasks-column tasks-column--insights">
          <InsightsChat useStore={usePrinciplesStore} variant="analysis" {...taskDropHandlers} />
        </div>
      </div>
    </div>
  )
}
