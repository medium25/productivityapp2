import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsChat from '../features/tasks/InsightsChat'
import { makeChatToTaskHandlers } from '../features/tasks/chatMessageToTask'
import { useInsightsStore } from '../store/useInsightsStore'
import { useTelegramPoll } from '../features/telegram/useTelegramPoll'

// Split out of the old 3-column Inbox page into its own top-level section
// per user request — InsightsChat is fully self-contained (own store), so
// this page is just the header + chat, full width. Boxed-card chrome for
// .tasks-board--fill columns was stripped globally (see index.css) — no
// per-page class needed here anymore.
export default function InsightsPage() {
  const { t } = useTranslation()
  useTelegramPoll(useInsightsStore)
  const taskDropHandlers = useMemo(() => makeChatToTaskHandlers(useInsightsStore), [])

  return (
    <div className="tasks-page tasks-page--edge-to-edge">
      <div className="tasks-board tasks-board--fill">
        <div className="tasks-column tasks-column--insights">
          <InsightsChat {...taskDropHandlers} />
        </div>
      </div>
    </div>
  )
}
