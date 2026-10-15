import i18n from '../../i18n'
import { useTasksStore } from '../../store/useTasksStore'
import { patchForSectionMove } from './taskLogic'

// Turns a chat message (Insights / Reference Info / Principles — anything on
// the shared InsightsChat component) into a task when it's dragged out of
// the chat and dropped on a task target, using the same useDragReorder
// cross-drop mechanism tasks use. The message itself stays in the chat —
// this only adds a task. First line of the message becomes the task title,
// the rest its description.
//
// Returns the { onCrossDropSection, onCrossDrop } pair to spread onto
// <InsightsChat>:
//   - onCrossDropSection: dropped on a bucket (Inbox / Vazifalar / Sometime
//     sidebar link, or the panel's "One-step tasks" card) — see
//     patchForSectionMove.
//   - onCrossDrop: dropped on a specific project card / sidebar project row
//     — the task is created inside that project.
export function makeChatToTaskHandlers(useStore) {
  const parse = (messageId) => {
    const msg = useStore.getState().messages.find((m) => m.id === messageId)
    if (!msg) return null
    const text = (msg.text || '').trim()
    const [firstLine, ...rest] = text.split('\n')
    return {
      title: (firstLine || '').trim() || i18n.t(`insights.type${msg.type}`),
      description: rest.join('\n').trim(),
    }
  }

  return {
    onCrossDropSection: (messageId, sectionKey) => {
      const fields = parse(messageId)
      if (!fields) return
      useTasksStore.getState().addTask({ ...fields, ...patchForSectionMove(sectionKey) })
    },
    onCrossDrop: (messageId, projectId) => {
      const fields = parse(messageId)
      if (!fields) return
      useTasksStore.getState().addTask({ ...fields, projectId, stage: 'tasks' })
    },
  }
}
