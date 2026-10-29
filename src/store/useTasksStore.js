import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'
import { COLOR_PALETTE } from '../constants/colorPalette'
import { addDays, nextOccurrenceDate, recursOnDate, seriesKey, todayISO } from '../features/tasks/taskLogic'

// Cmd/Ctrl+Z undo (see useUndoShortcut.js, mounted once in Layout) — kept
// outside the store's own state on purpose, same reasoning as the Pomodoro
// intervals in useFocusTimerStore: it's internal bookkeeping, not
// serializable app data, and must never round-trip through
// partialize/Firestore. Every mutating action snapshots {tasks, projects}
// here *before* applying its change; every array in this codebase is
// already replaced wholesale rather than mutated in place (map/filter/
// spread everywhere), so holding onto the old array references costs
// nothing extra and can't be invalidated by the change that follows.
const MAX_UNDO_STEPS = 50
let undoStack = []

// Called on sign-out (see rehydrateStores.js's resetAllStores) — an undo
// history from the previous account has no business surviving into the
// next one signed in on the same browser.
export function clearTasksUndoHistory() {
  undoStack = []
}

export const useTasksStore = create(
  persist(
    (set, get) => {
      const snapshotForUndo = () => {
        const { tasks, projects } = get()
        undoStack.push({ tasks, projects })
        if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift()
      }

      return {
        tasks: [],
        projects: [],
        // Set to a project id the instant its last remaining task gets
        // checked off — read by ProjectCompletionPrompt (mounted once in
        // Layout, see App.jsx) to ask "project done, or add another task?"
        // regardless of which page/card triggered the check. Not persisted
        // (absent from partialize below) — purely a same-session UI cue, a
        // reload shouldn't resurrect a stale prompt.
        pendingProjectPrompt: null,

        // Cmd/Ctrl+Z (see useUndoShortcut.js) — pops the last snapshot and
        // restores it wholesale. Deliberately doesn't push a "redo" entry;
        // the user only asked for undo, and a half-built undo/redo stack
        // that silently drops redo would be worse than not having it.
        undo: () => {
          const snapshot = undoStack.pop()
          if (!snapshot) return
          set({ tasks: snapshot.tasks, projects: snapshot.projects })
        },

        addTask: (task) => {
          snapshotForUndo()
          const newId = crypto.randomUUID()
          set((state) => ({
            // New tasks go to the back, not the front — per user request, a
            // freshly added task should show up below whichever tasks
            // already exist in the list it lands in (oldest-first, newest
            // at the bottom), not jump above them.
            tasks: [
              ...state.tasks,
              {
                id: newId,
                title: '',
                description: '',
                projectId: null,
                energy: 'none',
                // GTD triage stage — new tasks always start in the inbox and
                // get routed to 'later'/'tasks' by the GTD wizard (or directly,
                // for the detailed add/edit form's own stage picker).
                stage: 'inbox',
                whenDate: null,
                deadline: null,
                estimateMinutes: null,
                tags: [],
                recurrence: 'none',
                recurrenceDays: null,
                status: 'active',
                completedAt: null,
                createdAt: new Date().toISOString(),
                // Where it was made: 'myday' | 'tasks' (the «Задачи» list) | 'other'. Only tasks made in
                // «Мой день» (or old ones with no marker) can count as habits — see habitTaskSync.
                createdIn: 'other',
                ...task,
              },
            ],
          }))
          return newId
        },

        updateTask: (id, patch) => {
          snapshotForUndo()
          set((state) => ({
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          }))
        },

        // Soft-delete — moves the task into Трэш (see TrashPage.jsx) instead
        // of removing it outright, so an accidental delete is recoverable.
        // Every existing call site already just wires this straight to a
        // card's delete button, so the swap from hard- to soft-delete needed
        // no changes anywhere else.
        deleteTask: (id) => {
          snapshotForUndo()
          set((state) => ({
            tasks: state.tasks.map((t) => (
              t.id === id ? { ...t, status: 'trashed', deletedAt: new Date().toISOString() } : t
            )),
          }))
        },

        // Always restores to 'active', regardless of whether the task was
        // done or still active at the moment it got trashed — matches how
        // most trash bins behave (Восстановить just un-deletes, it doesn't
        // try to remember the exact prior status).
        restoreTask: (id) => {
          snapshotForUndo()
          set((state) => ({
            tasks: state.tasks.map((t) => (
              t.id === id ? { ...t, status: 'active', deletedAt: null } : t
            )),
          }))
        },

        permanentlyDeleteTask: (id) => {
          snapshotForUndo()
          set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id),
          }))
        },

        emptyTrash: () => {
          snapshotForUndo()
          set((state) => ({
            tasks: state.tasks.filter((t) => t.status !== 'trashed'),
          }))
        },

        // Completing a recurring task spawns the next occurrence immediately
        // (rather than waiting for some rollover pass) — same behavior as the
        // task-manager prototype this was ported from. Un-completing a task
        // never removes an already-spawned next occurrence; it's now its own
        // independent task, same as the prototype.
        //
        // A project task also drives the project-level completion check
        // (per user request: a project only counts as done once every one of
        // its tasks is checked off) — checking the last one sets
        // pendingProjectPrompt instead of silently marking the project done,
        // since the user still needs to say whether they're actually
        // finished or just want to add the next task. Un-checking a task
        // inside an already-completed project reopens it automatically (no
        // prompt needed that direction — it's obviously no longer "all done").
        toggleTaskDone: (id) => {
          const target = get().tasks.find((t) => t.id === id)
          if (!target) return

          const nowDone = target.status !== 'done'

          snapshotForUndo()
          set((state) => {
            let spawnedId = null
            const tasks = state.tasks.map((t) => (
              t.id === id
                ? { ...t, status: nowDone ? 'done' : 'active', completedAt: nowDone ? new Date().toISOString() : null }
                : t
            ))

            // No new occurrence while another live record of the same series
            // exists (it carries the series on, one instance a day).
            const seriesAlive = tasks.some((t) => t.id !== id && t.status === 'active' && seriesKey(t) === seriesKey(target))
            if (nowDone && target.recurrence && target.recurrence !== 'none' && !seriesAlive) {
              const nextDate = nextOccurrenceDate(target)
              if (nextDate) {
                let nextDeadline = null
                if (target.deadline) {
                  const base = target.whenDate || todayISO()
                  const deltaDays = Math.round(
                    (new Date(`${nextDate}T00:00:00`) - new Date(`${base}T00:00:00`)) / 86400000
                  )
                  nextDeadline = addDays(target.deadline, deltaDays)
                }
                // Slotted in right after the completed copy (not pushed to
                // the end) so the next occurrence keeps the same place — and
                // therefore the same number — in the day's list.
                const spawned = {
                  ...target,
                  id: crypto.randomUUID(),
                  whenDate: nextDate,
                  deadline: nextDeadline,
                  status: 'active',
                  completedAt: null,
                  createdAt: new Date().toISOString(),
                  // Result history for the cycle dots (last 7 occurrences).
                  cycleLog: [...(target.cycleLog || []), 'done'].slice(-7),
                  // The next occurrence starts without a time: it is allocated anew that day.
                  estimateMinutes: null,
                  startMinute: null,
                }
                tasks.splice(tasks.findIndex((t) => t.id === id) + 1, 0, spawned)
                spawnedId = spawned.id
              }
            }

            // A project task shows on the date board only while it is on the project's map, so the
            // next occurrence of a repeating one joins the map right behind the finished one.
            if (spawnedId && target.projectId) {
              const projects = state.projects.map((p) => (
                p.id === target.projectId && (p.flow || []).includes(id) ? { ...p, flow: [...p.flow, spawnedId] } : p
              ))
              return { tasks, projects }
            }
            return { tasks }
          })

          if (!target.projectId) return
          const siblings = get().tasks.filter((t) => t.projectId === target.projectId && t.status !== 'trashed')
          const allDone = siblings.length > 0 && siblings.every((t) => t.status === 'done')

          if (nowDone && allDone) {
            set({ pendingProjectPrompt: target.projectId })
          } else if (!nowDone) {
            const project = get().projects.find((p) => p.id === target.projectId)
            if (project?.status === 'done') get().reopenProject(project.id)
          }
        },

        // Midnight rollover for recurring tasks (per user request — a daily
        // task should show up in Today every day at 0:00 under the same
        // number). The live record of a series that wasn't finished is moved
        // forward to today if its pattern lands on today, instead of leaving
        // it overdue or creating a duplicate — same record, same list
        // position. Idempotent and silent (no undo step), so it's safe to run
        // on every change, on focus and from the midnight timer.
        rollRecurringToToday: () => {
          const today = todayISO()
          const due = (t) => t.status === 'active' && t.recurrence && t.recurrence !== 'none'
            && t.whenDate && t.whenDate < today && recursOnDate(t, today)
          // One-step tasks that were not finished simply stay in Today (the page
          // lists every unfinished one-step task dated before today, per user
          // request), so the rollover only drops a stale hand-set clock time.
          const dayOf = (t) => t.deadline || t.whenDate
          const stale = (t) => t.status === 'active' && dayOf(t) && dayOf(t) < today
          const dropTime = (t) => stale(t) && !t.copiedFromId && (!t.recurrence || t.recurrence === 'none') && t.startMinute != null
          // One live record per recurring series (per user request: a repeating
          // task shows up once a day, done or not, never piling up). Of several
          // active records of one series the one dated today wins, then the one
          // with the longest result history, then the newest; the others are
          // trashed and the survivor inherits the longest history.
          const isRecurring = (t) => t.status === 'active' && t.recurrence && t.recurrence !== 'none' && !t.projectId
          const groups = new Map()
          get().tasks.filter(isRecurring).forEach((t) => {
            const k = seriesKey(t)
            groups.set(k, [...(groups.get(k) || []), t])
          })
          const dupTrash = new Set()
          const inheritLog = new Map()
          groups.forEach((list) => {
            if (list.length < 2) return
            const ranked = [...list].sort((a, b) => (
              (Number(b.whenDate === today) - Number(a.whenDate === today))
              || ((b.cycleLog || []).length - (a.cycleLog || []).length)
              || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
            ))
            const longest = ranked.reduce((best, t) => ((t.cycleLog || []).length > best.length ? t.cycleLog : best), [])
            inheritLog.set(ranked[0].id, longest)
            ranked.slice(1).forEach((t) => dupTrash.add(t.id))
          })
          if (!get().tasks.some((t) => dupTrash.has(t.id) || due(t) || dropTime(t))) return
          const deletedAt = new Date().toISOString()
          set((state) => ({
            tasks: state.tasks.map((t) => {
              if (dupTrash.has(t.id)) return { ...t, status: 'trashed', deletedAt }
              if (inheritLog.has(t.id) && inheritLog.get(t.id).length > (t.cycleLog || []).length) t = { ...t, cycleLog: inheritLog.get(t.id) }
              if (dropTime(t)) return { ...t, startMinute: null }
              if (!due(t)) return t
              let deadline = t.deadline
              if (deadline) {
                const delta = Math.round((new Date(`${today}T00:00:00`) - new Date(`${t.whenDate}T00:00:00`)) / 86400000)
                deadline = addDays(deadline, delta)
              }
              // Every occurrence that passed unfinished counts as a miss in
              // the cycle dots.
              let missed = 0
              for (let d = t.whenDate, n = 0; d < today && n < 400; d = addDays(d, 1), n += 1) {
                if (recursOnDate(t, d)) missed += 1
              }
              const cycleLog = [...(t.cycleLog || []), ...Array(missed).fill('missed')].slice(-7)
              // A repeating task gets its time (minutes, start) fresh every day
              // (per user request), so yesterday's allocation is cleared.
              return { ...t, whenDate: today, deadline, cycleLog, estimateMinutes: null, startMinute: null }
            }),
          }))
        },

        // Drag-to-reorder (see useDragReorder.js) — `orderedIds` is the new
        // relative order for some *subset* of tasks (one project's list, one
        // date bucket, etc.), not the whole array. Reslots just that subset's
        // members back into the original positions they occupied, so tasks
        // outside the subset keep their place instead of getting shuffled.
        reorderTasks: (orderedIds) => {
          snapshotForUndo()
          set((state) => {
            const idSet = new Set(orderedIds)
            const positions = []
            state.tasks.forEach((t, i) => { if (idSet.has(t.id)) positions.push(i) })
            const byId = new Map(state.tasks.map((t) => [t.id, t]))
            const tasks = state.tasks.slice()
            // An explicit order wins over the «sent to the end of Мой день» rank (dayRank).
            positions.forEach((pos, i) => {
              const t = byId.get(orderedIds[i])
              tasks[pos] = t.dayRank != null ? { ...t, dayRank: null } : t
            })
            return { tasks }
          })
        },

        // Same reslot-a-subset behavior as reorderTasks above, not a
        // wholesale replace — ActionColumnBoard.jsx now drags project rows
        // too (per user request), and its own `orderedIds` there is just
        // the current column's bucket of projects, not every project in
        // the app. A naive `projects: orderedIds.map(...)` would silently
        // drop every project outside that bucket.
        reorderProjects: (orderedIds) => {
          snapshotForUndo()
          set((state) => {
            const idSet = new Set(orderedIds)
            const positions = []
            state.projects.forEach((p, i) => { if (idSet.has(p.id)) positions.push(i) })
            const byId = new Map(state.projects.map((p) => [p.id, p]))
            const projects = state.projects.slice()
            positions.forEach((pos, i) => { projects[pos] = byId.get(orderedIds[i]) })
            return { projects }
          })
        },

        addProject: (name, color) => {
          const trimmed = name.trim()
          if (!trimmed) return null
          let project
          snapshotForUndo()
          set((state) => {
            // Explicit color wins (the Projects tab's create form). Falls
            // back to cycling through the shared palette Focus's projects
            // use — kept for the inline "new project" quick-add inside
            // TaskFormModal, which has no room for a color picker.
            const resolvedColor = color || COLOR_PALETTE[state.projects.length % COLOR_PALETTE.length]
            project = { id: crypto.randomUUID(), name: trimmed, color: resolvedColor, status: 'active', completedAt: null, lastReviewedDate: null, deadline: null }
            return { projects: [...state.projects, project] }
          })
          return project
        },

        // A project's own due date — lets it slot into the Tasks board's
        // Today/Future columns the same way a task's deadline does (see
        // classifyProjectColumn in taskLogic.js); a project with none stays
        // in Wishes, per user request.
        setProjectDeadline: (id, deadline) => {
          snapshotForUndo()
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? { ...p, deadline: deadline || null } : p)),
          }))
        },

        // The daily "reviewed" checkmark (see ProjectsPage.jsx) — per user
        // request, Projects' sidebar count can't mean "waiting task without
        // a deadline" the way Inbox/Insights' does, since a project task
        // sitting there with no date is normal, not something urgent. This
        // gives Projects its own daily ritual instead: check each project
        // off once you've looked it over today; the sidebar count becomes
        // "how many still need a look today" and naturally empties itself
        // every day just by comparing lastReviewedDate to today, no reset
        // job needed. Toggling lets an accidental tap be undone the same
        // day; the date rolling over is what actually "empties" it.
        toggleProjectReviewed: (id) => {
          const today = todayISO()
          set((state) => ({
            projects: state.projects.map((p) => (
              p.id === id ? { ...p, lastReviewedDate: p.lastReviewedDate === today ? null : today } : p
            )),
          }))
        },

        setProjectColor: (id, color) => {
          snapshotForUndo()
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? { ...p, color } : p)),
          }))
        },

        renameProject: (id, name) => {
          const trimmed = name.trim()
          if (!trimmed) return
          snapshotForUndo()
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
          }))
        },

        // Pin a project to the top of the Vazifalar panel's project list
        // (per user request). Just a boolean on the project; the panel sorts
        // pinned ones first. Not undo-tracked — a display preference, not
        // task data.
        // Ordered task ids of a project's "completion map" (ProjectFlowPage.jsx)
        // — a display arrangement, not app data semantics, so no undo snapshot.
        setProjectFlow: (id, flow) => set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, flow } : p)),
        })),
        toggleProjectPinned: (id) => set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)),
        })),

        // The "да, проект выполнен" answer to pendingProjectPrompt — moves the
        // project into Завершённые (see CompletedPage.jsx), out of the
        // regular Projects list. Also directly callable to mark a project
        // done without going through the prompt (not currently exposed in
        // the UI that way, but kept general).
        completeProject: (id) => {
          snapshotForUndo()
          set((state) => ({
            projects: state.projects.map((p) => (
              p.id === id ? { ...p, status: 'done', completedAt: new Date().toISOString() } : p
            )),
            pendingProjectPrompt: state.pendingProjectPrompt === id ? null : state.pendingProjectPrompt,
          }))
        },

        // Restores a completed project back to the regular Projects list —
        // used by CompletedPage's "Восстановить" and automatically by
        // toggleTaskDone when one of its tasks gets un-checked.
        reopenProject: (id) => {
          snapshotForUndo()
          set((state) => ({
            projects: state.projects.map((p) => (
              p.id === id ? { ...p, status: 'active', completedAt: null } : p
            )),
          }))
        },

        // The "нет, добавлю ещё задачу" answer — the project was never
        // actually marked done, so this just clears the prompt. Not
        // undo-tracked — it changes no task/project data, only ephemeral UI.
        dismissProjectPrompt: () => set({ pendingProjectPrompt: null }),

        // Deleting a project doesn't delete its tasks — they fall back to
        // "Неразобранные" (no project) instead of keeping a dangling
        // projectId that would no longer resolve to anything.
        deleteProject: (id) => {
          snapshotForUndo()
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
            tasks: state.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
          }))
        },

        // Project + everything in it, in one go (the Vazifalar panel's
        // project-card delete — per user request). Tasks are soft-deleted
        // to Трэш like deleteTask does, not wiped, so it's recoverable
        // (and the whole thing is one undo step via snapshotForUndo).
        deleteProjectAndTasks: (id) => {
          snapshotForUndo()
          const deletedAt = new Date().toISOString()
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
            tasks: state.tasks.map((t) => (
              t.projectId === id && t.status !== 'trashed'
                ? { ...t, status: 'trashed', deletedAt }
                : t
            )),
          }))
        },
      }
    },
    {
      name: 'productivity-hub-tasks',
      storage: createFirestoreStorage('productivity-hub-tasks'),
      skipHydration: true,
      partialize: (state) => ({ tasks: state.tasks, projects: state.projects }),
    }
  )
)
