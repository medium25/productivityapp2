import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

const MAX_PROJECTS = 20

export const useFocusStore = create(
  persist(
    (set, get) => ({
      projects: [],
      // `details` (per user request — creating a Focus project should ask
      // "how much time will this take, by when, and what does 'done' look
      // like"). estimatedHours is now REQUIRED (per user request: the
      // timer's whole countdown is now that many hours, not a Pomodoro
      // slot — see useFocusTimerStore.js) — the caller (FocusActivityTimer's
      // form) validates before calling, this just refuses a zero/missing
      // value defensively. deadline/expectedResult stay optional.
      // `spentSeconds` starts the running lifetime total this project's
      // remaining budget is computed from (estimatedHours*3600 -
      // spentSeconds) — see getProjectRemainingSeconds below.
      addProject: (name, color, details = {}) => {
        const activeCount = get().projects.filter((p) => !p.completed).length
        if (activeCount >= MAX_PROJECTS) return
        const trimmed = name.trim()
        if (!trimmed) return
        const { estimatedHours = null, deadline = null, expectedResult = '' } = details
        if (!estimatedHours || estimatedHours <= 0) return
        set((state) => ({
          projects: [
            ...state.projects,
            {
              id: crypto.randomUUID(),
              name: trimmed,
              color,
              completed: false,
              estimatedHours,
              deadline: deadline || null,
              expectedResult: expectedResult.trim(),
              spentSeconds: 0,
            },
          ],
        }))
      },
      setProjectEstimatedHours: (id, hours) => {
        const value = Number(hours)
        if (!value || value <= 0) return
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, estimatedHours: value } : p)),
        }))
      },
      // Fires once a second while a project's timer is running (see
      // useFocusTimerStore.js's _tick) — this is what makes the remaining
      // budget persist across sessions/days instead of resetting daily
      // (per user request): next time this project starts, its remaining
      // seconds already reflect everything spent so far, no separate
      // "commit at session end" step needed.
      addProjectSecond: (id) => set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, spentSeconds: (p.spentSeconds || 0) + 1 } : p)),
      })),
      removeProject: (id) => set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),
      renameProject: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
        }))
      },
      completeProject: (id) => set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, completed: true } : p)),
      })),
      reopenProject: (id) => set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, completed: false } : p)),
      })),
      // Reorders just the given ids relative to each other (drag-and-drop in
      // ProjectList, active projects only) — everything else (completed
      // projects) keeps its existing relative order, appended after.
      reorderActiveProjects: (orderedIds) => set((state) => {
        const byId = new Map(state.projects.map((p) => [p.id, p]))
        const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean)
        const rest = state.projects.filter((p) => !orderedIds.includes(p.id))
        return { projects: [...reordered, ...rest] }
      }),
    }),
    {
      name: 'productivity-hub-focus',
      storage: createFirestoreStorage('productivity-hub-focus'),
      skipHydration: true,
      partialize: (state) => ({ projects: state.projects }),
    }
  )
)

export const MAX_FOCUS_PROJECTS = MAX_PROJECTS

// How much of a project's declared budget is left to work — the number the
// timer's whole countdown is now built from (see useFocusTimerStore.js
// start()), not a Pomodoro slot. Missing estimatedHours (legacy projects
// from before this was required) reads as 0 remaining, not unlimited —
// TimerPanel gates Start on this and prompts to set it instead.
export function getProjectRemainingSeconds(project) {
  if (!project?.estimatedHours) return 0
  return Math.max(0, Math.round(project.estimatedHours * 3600) - (project.spentSeconds || 0))
}
