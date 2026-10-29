import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { IconBack } from '../../icons/Icons'
import { useTasksStore } from '../../store/useTasksStore'
import { useFocusTimerStore } from '../../store/useFocusTimerStore'
import TaskCard from './TaskCard'
import TaskFormModal from './TaskFormModal'
import { useDragReorder } from './useDragReorder'
import { useAutoGrowTextarea } from './useAutoGrowTextarea'
import MyDayTimer from '../focus/MyDayTimer'
import {
  addDays, classifyActionColumn, classifyProjectColumn,
  getTaskStage, isOverdue, todayISO,
} from './taskLogic'
import { useSectionDropDateGate } from './useSectionDropDateGate'
import DueRequiredPrompt from './DueRequiredPrompt'
import ProjectAssignPrompt from './ProjectAssignPrompt'
import EmptyStateCelebration from './EmptyStateCelebration'

// Same bottom quick-add pattern as Projects/Insights/the old standalone
// Inbox page (see InboxPage.jsx's own InboxQuickAdd) — title-only, Enter to
// submit. TasksInboxPage.jsx (columnKey 'sometime') is the only caller that
// turns this on (see TaskColumn's `quickAdd` prop below): per user report,
// after Inbox moved off the sidebar and became this hub card, there was no
// way left anywhere in the app to actually capture a brand new task.
export function QuickAdd({ onAdd }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const textareaRef = useAutoGrowTextarea(title)

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setTitle('')
  }

  return (
    <div className="tasks-column__quick-add tasks-column__quick-add--bottom">
      <textarea
        ref={textareaRef}
        className="tasks-column__quick-add-input"
        placeholder={t('tasks.gtd.inboxQuickAddPlaceholder')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        rows={1}
      />
      <button type="button" className="tasks-column__quick-add-btn" onClick={submit}>
        +
      </button>
    </div>
  )
}

// A project as a row inside a task column (see matchingProjects below) —
// pixel-identical to TaskCard (per user request: "выглядели один в один
// задачи") by reusing its exact classes (.task-card/__row/__checkbox/
// __title/__badge/__details) instead of a separate look. The checkbox spot
// stays a plain empty circle (per user request — a project has no
// done/undone toggle, but the row should still line up with real task
// rows); the project's color moved to a left accent border instead (see
// .project-card--accent), same treatment as .task-card--today's. No more
// inline deadline control here (removed per user request) — a project's
// deadline is edited from its own detail page now.
//
// Expanding the project's own unscheduled tasks (rendered via the column's
// renderTaskRow, passed down from TaskColumn) used to need a dedicated
// chevron button — per user request that's gone now, the whole card
// toggles it (same click-anywhere-to-open pattern HabitsPage's own rows
// use). The title used to be a Link straight to the project's detail page
// (stopping the click from bubbling so tapping the name navigated instead
// of toggling) — per user report that read as "opens a separate window"
// when the actual expectation was always the inline expand, so it's a
// plain span now; the whole row (title included) only ever toggles.
function ProjectCard({ project, taskList, expanded, onToggleExpand, renderTaskRow }) {
  const { t } = useTranslation()
  return (
    <div
      className="task-card project-card--accent"
      onClick={onToggleExpand}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand() } }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`${project.name} — ${t('tasks.toggleProjectTasks')}`}
    >
      <div className="task-card__row">
        <span className="task-card__checkbox" aria-hidden="true" />
        <span className="task-card__title">{project.name}</span>
        {taskList.length > 0 && <span className="task-card__badge">{taskList.length}</span>}
      </div>
      {expanded && (
        <div className="task-card__details project-card__tasks" onClick={(e) => e.stopPropagation()}>
          {taskList.length === 0 ? (
            <p className="project-card__empty">{t('tasks.emptyGeneric')}</p>
          ) : (
            taskList.map((task, i) => renderTaskRow(task, i + 1, false, true))
          )}
        </div>
      )}
    </div>
  )
}

// Sentinel group key (not a real ISO date) for tasks with an actually
// overdue deadline (see isOverdue in taskLogic.js) — they accumulate here
// instead of each opening its own group under a stale past date. Per user
// report, a task with no deadline (or one that isn't overdue yet) must NOT
// land here just because its whenDate happens to be in the past — only a
// genuinely overdue deadline earns the Overdue label; everything else with
// a stale whenDate just collapses into today's group instead (see below).
const OVERDUE_GROUP_KEY = '_overdue'

// Whether a recurring task's pattern lands on `iso` too — used to preview a
// recurring task under every day it recurs (per user request), not just the
// one day its single live record's whenDate happens to point at. Weekly/
// monthly match against the record's own whenDate as the pattern's anchor
// (which weekday/day-of-month it recurs on) rather than "on or after" it —
// an overdue daily/weekly habit should preview into every day regardless of
// how stale its whenDate has gotten since it was last completed.
function recursOnDate(task, iso) {
  if (!task.recurrence || task.recurrence === 'none' || !task.whenDate) return false
  if (task.recurrence === 'daily') return true
  const anchor = new Date(`${task.whenDate}T00:00:00`)
  const d = new Date(`${iso}T00:00:00`)
  if (task.recurrence === 'weekly' && task.recurrenceDays?.length) return task.recurrenceDays.includes(d.getDay())
  if (task.recurrence === 'monthly' && task.recurrenceDays?.length) {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return d.getDate() === Math.min(task.recurrenceDays[0], last)
  }
  if (task.recurrence === 'weekly') return anchor.getDay() === d.getDay()
  if (task.recurrence === 'monthly') return anchor.getDate() === d.getDate()
  if (task.recurrence === 'custom') return (task.recurrenceDays || []).includes(d.getDay())
  return false
}

// Upcoming's per-date group header — went through a boxed-header, a
// timeline-with-dots, a per-card-chip version, and colored per-group flags
// (all per user request) before landing back on plain group headers: bold
// "Today"/"Tomorrow"/short weekday, no box/dot/line/flag, just a thin rule
// underneath.
function formatGroupHeader(iso, t, language, today = todayISO()) {
  if (iso === OVERDUE_GROUP_KEY) return t('tasks.overdueGroupLabel')
  if (iso === today) return t('tasks.today')
  if (iso === addDays(today, 1)) return t('tasks.tomorrow')
  const d = new Date(`${iso}T00:00:00`)
  try {
    return new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
  } catch {
    return new Intl.DateTimeFormat('ru', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
  }
}

// Shared by Upcoming/Sometime (see UpcomingPage.jsx/SometimePage.jsx) —
// each used to be one column of a single "Action" board (former
// TasksGoalsPage.jsx), split into its own top-level section/route per user
// request. Pure view/triage of already-existing tasks — no quick-add and no
// Projects section here (both dropped per user request; Projects still
// lives on the Inbox section). Cross-column drag-and-drop doesn't carry
// over now that the buckets aren't on screen together — moving a task to a
// different bucket is done by editing its date in TaskFormModal instead.
//
// "My day"/"Next" used to be its own third section (today's tasks only,
// with the timer feature) — merged into Upcoming per user request, so
// Upcoming now also includes today's tasks (see bucketTasks below) and the
// timer popup (see openTimerTask) that used to be My day-only. Its title is
// "Now" here (was "Action") — the Tasks hub's own "Action" card (see
// UpcomingPage.jsx) is what carries that name now, this is just one of its
// 2 windows (see TasksActionPage.jsx).
const TITLE_KEYS = {
  upcoming: 'tasks.gtd.columnUpcoming',
  future: 'tasks.gtd.columnFuture',
  sometime: 'tasks.gtd.columnSometime',
  wishes: 'tasks.gtd.hubWishes',
}

// One column's worth of logic + markup (bucketing, drag-reorder, date
// groups, the column div itself and its popups) — factored out of the
// default export below so it can be reused as: the Tasks hub's Inbox page
// (columnKey 'sometime', undated tasks only — see TasksInboxPage.jsx), the
// Action page's own Now + Future windows side by side (columnKeys
// 'upcoming'/'future' — see TasksActionPage.jsx), and Sometime/Wishes' own
// legacy standalone sidebar destination (SometimePage.jsx, also
// columnKey 'sometime').
//
// `backTo` — optional, swaps the plain title for a clickable back link
// (same pattern as ProjectDetailPage.jsx's own header) back to the Tasks
// hub. `titleKey` — optional, overrides TITLE_KEYS[columnKey] for the
// header text; used by TasksInboxPage.jsx so a 'sometime' column reads as
// "Inbox" there instead of SometimePage.jsx's own "Wishes" (same bucket,
// different page identity).
export function TaskColumn({ columnKey, backTo, titleKey, quickAdd, hideProjects }) {
  const { t, i18n } = useTranslation()
  const tasks = useTasksStore((s) => s.tasks)
  const projects = useTasksStore((s) => s.projects)
  const addTask = useTasksStore((s) => s.addTask)
  const updateTask = useTasksStore((s) => s.updateTask)
  const deleteTask = useTasksStore((s) => s.deleteTask)
  const toggleTaskDone = useTasksStore((s) => s.toggleTaskDone)
  const addProject = useTasksStore((s) => s.addProject)
  const setProjectDeadline = useTasksStore((s) => s.setProjectDeadline)
  const permanentlyDeleteTask = useTasksStore((s) => s.permanentlyDeleteTask)
  const reorderTasks = useTasksStore((s) => s.reorderTasks)
  const reorderProjects = useTasksStore((s) => s.reorderProjects)
  const runningTaskId = useFocusTimerStore((s) => s.projectId)
  const runningSourceType = useFocusTimerStore((s) => s.sourceType)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  // Upcoming only — which task's timer popup is currently open (see
  // MyDayTimer below). Set by tapping a card (TaskCard's onSelectForTimer);
  // closed by clicking outside it. Not pinned anywhere — the timer only
  // shows up (in its own popup) when a card is actually clicked.
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  // A task just dropped on "Projects" (see the cross-drop handler below) —
  // ProjectAssignPrompt asks whether it should join one of the existing
  // projects or become a new one, instead of always silently doing the
  // latter (per user report there was no way to pick an existing project).
  const [pendingProjectAssignTask, setPendingProjectAssignTask] = useState(null)

  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects]
  )

  // Ordered by deadline proximity, soonest at the top (per user request) —
  // 'YYYY-MM-DD' strings sort correctly with plain comparison. Sometime's
  // (Inbox's) tasks have no whenDate at all, so they all compare equal and
  // keep their existing (insertion) order via the stable sort.
  //
  // Sometime excludes project-assigned tasks — an unscheduled project task
  // already shows under its own project (see ProjectsTab), so it must not
  // also show here (a task belongs to exactly one place, per user report of
  // seeing the same task duplicated in both Projects and Sometime). Upcoming
  // and Future both keep including project tasks though — once "Разобрать"
  // gives one a date, it's meant to show in both its scheduled column and
  // its project (that duplication is intentional, see ProjectsTab's own
  // comment on this).
  //
  // Upcoming ('Now', inside the Action page — see TasksActionPage.jsx)
  // absorbed what used to be the separate "My day"/"Next" section (today's
  // tasks) — classifyActionColumn still tells today's tasks apart as
  // 'myday' internally. Future (the Action page's other window) holds
  // 'upcoming' — dated, grouped by date, same as before.
  const bucketTasks = useMemo(
    () => tasks.filter((t2) => {
      if (t2.status !== 'active') return false
      // 'wishes' (see TasksWishesPage.jsx) is a distinct GTD stage — Someday/
      // Maybe, deliberately deferred (see patchForSectionMove's 'wishes'
      // branch) — not the plain "no date yet" 'tasks' stage every other
      // branch here filters on, so it's checked before the getTaskStage
      // guard below excludes it.
      if (columnKey === 'wishes') return getTaskStage(t2) === 'later'
      if (getTaskStage(t2) !== 'tasks') return false
      const taskBucket = classifyActionColumn(t2)
      if (columnKey === 'upcoming') return taskBucket === 'myday'
      if (columnKey === 'future') return taskBucket === 'upcoming'
      // columnKey === 'sometime' — Inbox (TasksInboxPage.jsx) and
      // Wishes/SometimePage.jsx's own legacy standalone page.
      return taskBucket === columnKey && !t2.projectId
    }).sort((a, b) => (a.whenDate || '').localeCompare(b.whenDate || '')),
    [tasks, columnKey]
  )

  // Projects live inside these same columns too, keyed off their own
  // deadline field (see classifyProjectColumn) — one due today/overdue
  // moves to Now, one due later moves to Future, one with no deadline at
  // all moves to Inbox. Projects have no Someday/Maybe concept of their
  // own (classifyProjectColumn only knows myday/upcoming/sometime) — Wishes
  // never shows any.
  const matchingProjects = useMemo(() => {
    // 'wishes' never shows projects (classifyProjectColumn has no Someday/
    // Maybe concept of its own). `hideProjects` is Inbox-specific (see
    // TasksInboxPage.jsx) — per user request Inbox is tasks only now,
    // undated projects are reachable from the Projects page instead;
    // SometimePage.jsx's own legacy standalone page (same columnKey
    // 'sometime') still shows them.
    if (columnKey === 'wishes' || hideProjects) return []
    return projects.filter((p) => {
      if (p.status === 'done') return false
      const projectBucket = classifyProjectColumn(p)
      if (columnKey === 'upcoming') return projectBucket === 'myday'
      if (columnKey === 'future') return projectBucket === 'upcoming'
      // columnKey === 'sometime' — Wishes' own legacy page (SometimePage.jsx).
      return projectBucket === 'sometime'
    })
  }, [projects, columnKey, hideProjects])

  // Feeds each ProjectCard's own expandable task list (see below) — same
  // "unscheduled, or done" rule as before (an already-scheduled task shows
  // in its date column instead, not duplicated inside the project card).
  const projectTasksById = useMemo(() => {
    const byProject = {}
    tasks.forEach((t2) => {
      if (!t2.projectId || t2.status === 'trashed') return
      if (t2.status !== 'done' && t2.whenDate) return
      ;(byProject[t2.projectId] ||= []).push(t2)
    })
    return byProject
  }, [tasks])

  // Which project cards are currently unfolded (see ProjectCard's toggle) —
  // collapsed by default, same as the sidebar's own Projects list.
  const [expandedProjectIds, setExpandedProjectIds] = useState(() => new Set())
  const toggleProjectExpanded = (id) => setExpandedProjectIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // Tasks completed today stay visible, same as the old My day section.
  const doneToday = useMemo(() => {
    if (columnKey !== 'upcoming') return []
    const today = todayISO()
    return tasks.filter((t2) => t2.status === 'done' && t2.completedAt && t2.completedAt.slice(0, 10) === today)
  }, [tasks, columnKey])

  // Drag-to-reorder (see useDragReorder.js) — only meaningfully persists
  // for cards that end up with the same sort key (same date, or no date at
  // all in Sometime), since the deadline sort above always wins on the
  // next render otherwise; done items aren't reorderable.
  const bucketTaskIds = bucketTasks.map((t2) => t2.id)
  // Dropping an undated task onto Tasks no longer silently defaults its
  // date to tomorrow (per user request) — see useSectionDropDateGate.js.
  const { handleDropSection, handleDropProject, pendingTask, confirmPendingDate, cancelPending } =
    useSectionDropDateGate(tasks, updateTask)
  // Dropped on a project row in the sidebar → assigns to that project.
  // Dropped on "Projects" itself → opens ProjectAssignPrompt to pick an
  // existing project or make the task a new one (see
  // pendingProjectAssignTask above). Dropped on Inbox/Next/Upcoming/
  // Sometime's own sidebar link → moves the task into that section. Works
  // from My day/Upcoming/Sometime the same as it does from Inbox.
  const { displayOrder: bucketOrder, draggingId: draggingTaskId, bindHandle: bindTaskHandle, dragGhost } =
    useDragReorder(bucketTaskIds, reorderTasks, {
      onCrossDrop: handleDropProject,
      onCrossDropNewProject: (taskId) => {
        const task = tasks.find((t2) => t2.id === taskId)
        if (!task) return
        setPendingProjectAssignTask(task)
      },
      onCrossDropSection: handleDropSection,
    })
  const assignPendingTaskToProject = (projectId) => {
    updateTask(pendingProjectAssignTask.id, { projectId, stage: 'tasks' })
    setPendingProjectAssignTask(null)
  }
  const createProjectFromPendingTask = () => {
    addProject(pendingProjectAssignTask.title)
    permanentlyDeleteTask(pendingProjectAssignTask.id)
    setPendingProjectAssignTask(null)
  }
  const orderedBucketTasks = bucketOrder.map((id) => bucketTasks.find((t2) => t2.id === id)).filter(Boolean)

  // Same drag-anywhere-to-sort per user request, now for project rows too
  // (see matchingProjects/ProjectCard below) — a project has no `stage`,
  // just its own `deadline` field, so this reads the drop-zone's section
  // key directly instead of going through useSectionDropDateGate.js's
  // task-shaped patchForSectionMove. "upcoming" (Future) defaults straight
  // to tomorrow rather than opening DueRequiredPrompt (that flow is
  // task-specific) — good enough to land it in the right bucket; the exact
  // date is still editable from the project's own detail page after.
  // "wishes" has no project equivalent (classifyProjectColumn only knows
  // myday/upcoming/sometime) — dropped there, nothing happens.
  const handleDropProjectSection = (projectId, sectionKey) => {
    if (sectionKey === 'now') setProjectDeadline(projectId, todayISO())
    else if (sectionKey === 'upcoming') setProjectDeadline(projectId, addDays(todayISO(), 1))
    else if (sectionKey === 'sometime') setProjectDeadline(projectId, null)
  }
  const matchingProjectIds = matchingProjects.map((p) => p.id)
  const { draggingId: draggingProjectId, bindHandle: bindProjectHandle, dragGhost: projectDragGhost } =
    useDragReorder(matchingProjectIds, reorderProjects, { onCrossDropSection: handleDropProjectSection })

  const displayTasks = columnKey === 'upcoming' ? [...orderedBucketTasks, ...doneToday] : orderedBucketTasks

  // Upcoming groups its list under one header per date instead of a badge
  // on every card — keyed by a Map (not just "same date as the previous
  // task") so the done-today tasks appended after orderedBucketTasks still
  // land inside the existing "Today" group instead of opening a duplicate
  // one at the end of the list. A done task's real whenDate might be stale
  // or missing entirely — it's grouped under today's date regardless, same
  // as the old My day section showing it there regardless of its date. A
  // still-active task with a genuinely overdue deadline (see isOverdue)
  // piles up in the shared OVERDUE_GROUP_KEY bucket instead of opening one
  // group per stale date; a task whose whenDate is merely stale but has no
  // overdue deadline (no deadline at all, or a recurring habit) just
  // collapses into today's group instead — per user report, only an actual
  // overdue deadline earns the Overdue label.
  //
  // A second pass then previews every recurring task (see recursOnDate)
  // into each non-Overdue day group it also lands on, not just whichever
  // one its single live record's whenDate puts it in — per user request, a
  // daily/weekly/monthly/custom habit should read as showing up "every day"
  // it recurs, not disappear from the rest of the list. Only the group its
  // real record already lives in is skipped (no duplicate); these extras
  // are marked `preview` (see TaskCard's `preview` prop) since there's
  // still only one actual completable record behind all of them. Overdue
  // itself is skipped here too — it's for genuinely overdue tasks only.
  const dateGroups = useMemo(() => {
    if (columnKey !== 'upcoming' && columnKey !== 'future') return null
    const today = todayISO()
    const groups = []
    const byDate = new Map()
    for (const task of displayTasks) {
      const date = task.status === 'done'
        ? today
        : (isOverdue(task) ? OVERDUE_GROUP_KEY : (task.whenDate < today ? today : task.whenDate))
      let group = byDate.get(date)
      if (!group) {
        group = { date, tasks: [] }
        byDate.set(date, group)
        groups.push(group)
      }
      group.tasks.push(task)
    }
    const recurringTasks = orderedBucketTasks.filter((t2) => t2.recurrence && t2.recurrence !== 'none')
    for (const group of groups) {
      if (group.date === OVERDUE_GROUP_KEY) continue
      for (const rt of recurringTasks) {
        if (group.tasks.some((x) => x.id === rt.id)) continue
        if (recursOnDate(rt, group.date)) group.tasks.push({ ...rt, __preview: true })
      }
    }
    // Chronological order, not insertion order (per user report) — a group
    // was otherwise created wherever its first task happened to appear in
    // `displayTasks`, and doneToday is appended at the very end of that
    // array (see above), so Today would jump to the bottom the moment its
    // last task got checked off and only doneToday entries were left in it.
    groups.sort((a, b) => {
      if (a.date === OVERDUE_GROUP_KEY) return -1
      if (b.date === OVERDUE_GROUP_KEY) return 1
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    })
    return groups
  }, [columnKey, displayTasks, orderedBucketTasks])

  // Whichever task is actually running (via the store, see TaskCard's
  // in-card countdown) — independent of the popup below, so the right
  // card keeps showing its live countdown even after the popup is closed.
  const activeTask = runningSourceType === 'task'
    ? [...orderedBucketTasks, ...doneToday].find((t2) => t2.id === runningTaskId)
    : undefined
  // The task whose timer popup is open (see onSelectForTimer below) — unlike
  // activeTask this is nothing at all until a card is actually clicked.
  const openTimerTask = columnKey === 'upcoming'
    ? [...orderedBucketTasks, ...doneToday].find((t2) => t2.id === selectedTaskId)
    : undefined
  const closeTimerPopup = () => setSelectedTaskId(null)

  // Opens the "5-min rule" triage wizard (TaskFormModal) — Sometime only
  // (see the "Разбор" button below), for tasks that haven't really been
  // scheduled yet. Plain editing (rename/deadline/recurrence/estimate)
  // happens inline right on the card now — see TaskCard's own edit state.
  // A second click on the same task while its form is already open closes
  // it instead of re-opening (per user request — toggle, not a no-op).
  const openWizard = (task) => {
    if (modalOpen && editingTask?.id === task.id) { setModalOpen(false); return }
    setEditingTask(task)
    setModalOpen(true)
  }
  const closeModal = () => setModalOpen(false)

  // No add flow left in this column (the "+ Добавить" button was removed
  // per user request — new tasks are created in Inbox instead), so this
  // only ever fires for an existing editingTask.
  const handleSave = (fields) => {
    updateTask(editingTask.id, fields)
    setModalOpen(false)
  }

  const cardHandlers = {
    onToggleDone: toggleTaskDone,
    onDelete: deleteTask,
    onUpdate: updateTask,
    // Every column now — clicking a card's title (or its "⋮" menu's Edit
    // item, see TaskCard) opens the full detailed form; there's no lighter
    // inline editor left to fall back to.
    onProcess: openWizard,
    // Upcoming only — tapping a card opens its timer in a popup instead of
    // opening inline text editing there (see TaskCard).
    onSelectForTimer: columnKey === 'upcoming' ? (task) => setSelectedTaskId(task.id) : undefined,
  }

  // Numbers restart at 1 within each date group (per user request) — plain
  // index+1 within whichever array the caller hands in, so Upcoming's
  // per-day groups and My day/Sometime's single flat list both just number
  // their own items independently.
  const renderTaskRow = (task, number, isToday = false, hideProjectLabel = false) => {
    const preview = !!task.__preview
    return (
      <div
        key={task.id}
        {...(!preview && task.status === 'active' ? bindTaskHandle(task.id, task.title) : null)}
        className={draggingTaskId === task.id ? 'task-card-reorder--dragging' : undefined}
      >
        <TaskCard
          task={task}
          number={number}
          showNumber={hideProjectLabel}
          preview={preview}
          isToday={isToday}
          project={hideProjectLabel || !task.projectId ? null : projectsById[task.projectId]}
          showDateBadge={false}
          showFocusFooter={columnKey === 'upcoming' && !preview}
          isSelectedForTimer={columnKey === 'upcoming' && !activeTask && openTimerTask?.id === task.id}
          {...cardHandlers}
        />
        {!preview && modalOpen && editingTask?.id === task.id && (
          <TaskFormModal
            inline
            task={editingTask}
            projects={projects}
            onSave={handleSave}
            onClose={closeModal}
            onCreateProject={addProject}
          />
        )}
      </div>
    )
  }

  return (
    <>
      <div className={'tasks-column tasks-column--' + columnKey}>
        <div className="tasks-column__header">
          {backTo ? (
            <Link to={backTo} className="tasks-column__back">
              <IconBack size={16} />
              {t(titleKey || TITLE_KEYS[columnKey])}
            </Link>
          ) : (
            <span>{t(titleKey || TITLE_KEYS[columnKey])}</span>
          )}
          {(displayTasks.length + matchingProjects.length) > 0 && (
            <span className="tasks-column__count">{displayTasks.length + matchingProjects.length}</span>
          )}
        </div>
        <div className="tasks-column__list">
          {displayTasks.length === 0 && matchingProjects.length === 0 ? (
            <EmptyStateCelebration message={t('tasks.emptyGeneric')} />
          ) : (
            <>
              {dateGroups ? (
                dateGroups.map((group) => (
                  <div className="tasks-date-group" key={group.date}>
                    <div className={'tasks-date-group__header' + (group.date === OVERDUE_GROUP_KEY ? ' tasks-date-group__header--overdue' : '')}>
                      {formatGroupHeader(group.date, t, i18n.language)}
                    </div>
                    {group.tasks.map((task, i) => renderTaskRow(task, i + 1, group.date === todayISO()))}
                  </div>
                ))
              ) : (
                displayTasks.map((task, i) => renderTaskRow(task, i + 1))
              )}
              {matchingProjects.map((project) => (
                <div
                  key={project.id}
                  data-drop-project-id={project.id}
                  {...bindProjectHandle(project.id, project.name)}
                  className={draggingProjectId === project.id ? 'task-card-reorder--dragging' : undefined}
                >
                  <ProjectCard
                    project={project}
                    taskList={projectTasksById[project.id] || []}
                    expanded={expandedProjectIds.has(project.id)}
                    onToggleExpand={() => toggleProjectExpanded(project.id)}
                    renderTaskRow={renderTaskRow}
                  />
                </div>
              ))}
            </>
          )}
        </div>
        {quickAdd && <QuickAdd onAdd={(title) => addTask({ title, stage: 'tasks' })} />}
      </div>
      {openTimerTask && (
        <div className="task-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeTimerPopup() }}>
          <MyDayTimer task={openTimerTask} onClose={closeTimerPopup} />
        </div>
      )}
      <DueRequiredPrompt task={pendingTask} onConfirm={confirmPendingDate} onCancel={cancelPending} />
      <ProjectAssignPrompt
        task={pendingProjectAssignTask}
        projects={projects}
        onAssignExisting={assignPendingTaskToProject}
        onCreateNew={createProjectFromPendingTask}
        onCancel={() => setPendingProjectAssignTask(null)}
      />
      {dragGhost}
      {projectDragGhost}
    </>
  )
}

// Single full-page column — Sometime/Wishes' own standalone sidebar
// destination, plus (per user request) the Tasks hub's Inbox card
// (columnKey 'sometime' again, titled differently — see TasksInboxPage.jsx)
// and its own layout used twice side by side for the Action page's Now +
// Future windows (see TasksActionPage.jsx).
export default function ActionColumnBoard({ columnKey, backTo, titleKey }) {
  return (
    <div className="tasks-page tasks-page--edge-to-edge">
      <div className="tasks-board tasks-board--fill">
        <TaskColumn columnKey={columnKey} backTo={backTo} titleKey={titleKey} />
      </div>
    </div>
  )
}
