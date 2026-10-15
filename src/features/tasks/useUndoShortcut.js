import { useEffect } from 'react'
import { useTasksStore } from '../../store/useTasksStore'

// True while focus is inside something that has its own native undo (a
// text input/textarea, or a contenteditable) — Cmd/Ctrl+Z there must keep
// doing the browser's own text-undo, not pop our app-level task/project
// history out from under whatever the user is typing.
function isEditableTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

// Cmd+Z (Mac) / Ctrl+Z (Windows/Linux) undoes the last task/project change
// — mounted once in Layout (see App.jsx), same pattern as
// ProjectCompletionPrompt/FloatingTimerWidget, so it works from any page.
// Scoped to useTasksStore's own undo() (tasks/projects) per user request —
// doesn't touch Settings, Insights, or the Focus timer.
export function useUndoShortcut() {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() !== 'z') return
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      useTasksStore.getState().undo()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
