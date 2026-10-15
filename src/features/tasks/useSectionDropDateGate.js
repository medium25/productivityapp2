import { useState } from 'react'
import { patchForSectionMove } from './taskLogic'

// Dropping a task onto the "Tasks" sidebar link, or onto a project (either
// its own row or "Projects" itself's row-list — see the call sites below)
// used to silently default/clear its date. Per user request neither is
// fine any more: every Inbox/Projects -> Tasks move *and* every drop onto
// a project now opens this gate's prompt (see DueRequiredPrompt.jsx),
// pre-filled with the task's existing whenDate/estimateMinutes if it has
// them, and the move only actually happens once the user confirms a date +
// estimate. Dropping onto Inbox/Sometime is intentionally excluded — both
// clear the date outright, so there's nothing meaningful to confirm.
export function useSectionDropDateGate(tasks, updateTask) {
  // { task, apply(iso, estimateMinutes) } — `apply` closes over whichever
  // target (section vs. project) triggered the prompt, so confirmPendingDate
  // stays a single generic entry point regardless of drop kind.
  const [pending, setPending] = useState(null)

  const handleDropSection = (taskId, sectionKey) => {
    if (sectionKey === 'upcoming') {
      const task = tasks.find((t2) => t2.id === taskId)
      if (task) {
        setPending({
          task,
          apply: (iso, estimateMinutes) =>
            updateTask(taskId, { ...patchForSectionMove('upcoming'), whenDate: iso, estimateMinutes }),
        })
        return
      }
    }
    updateTask(taskId, patchForSectionMove(sectionKey))
  }

  const handleDropProject = (taskId, projectId) => {
    const task = tasks.find((t2) => t2.id === taskId)
    if (!task) return
    setPending({
      task,
      apply: (iso, estimateMinutes) =>
        updateTask(taskId, { projectId, stage: 'tasks', whenDate: iso, estimateMinutes }),
    })
  }

  const confirmPendingDate = (iso, estimateMinutes) => {
    if (!pending) return
    pending.apply(iso, estimateMinutes)
    setPending(null)
  }

  const cancelPending = () => setPending(null)

  return { handleDropSection, handleDropProject, pendingTask: pending?.task || null, confirmPendingDate, cancelPending }
}
