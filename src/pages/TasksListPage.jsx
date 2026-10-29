import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/useTasksStore'
import { useHabitsStore } from '../store/useHabitsStore'
import { useDragReorder } from '../features/tasks/useDragReorder'
import { getProjectColor, isoFromDate, todayISO } from '../features/tasks/taskLogic'
import { syncHabitForTask } from '../features/tasks/habitTaskSync'
import { ROW_PALETTE } from '../features/tasks/rowPalette'
import ProjectPickerModal from '../features/tasks/ProjectPickerModal'
import { SideIconMyDay, SideIconTasks } from '../layout/sidebarIcons'

// «Задачи»: every open task in one list, drawn like the rows of «Мой день» but
// without any time. Each row has a project pill (tap to change the project) and a
// «Мой день» button that puts the task into today's list (tap again to take it out).
// Adding a task asks for its project in a pop-up first.
const isRecurring = (task) => !!task.recurrence && task.recurrence !== 'none'
// Project colours in the app are deliberately dark (they carry white text elsewhere).
// The light theme writes the project name in that colour as it is; the dark theme
// (styles/neon.css) uses this lifted, saturated shade of the same hue instead, so the
// name stays readable on the dark rows. Greys stay grey.
// Bright shade of a project colour for dark rows: same perceived lightness for every hue
// (OKLCH), so green never looks brighter than red; yellows get a touch more.
function brightTagColor(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '')
  if (!m) return 'oklch(0.75 0.02 250)'
  const [r, g, b] = m.slice(1).map((h) => {
    const c = parseInt(h, 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const A = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s
  if (Math.hypot(A, B) < 0.04) return 'oklch(0.75 0.02 250)' // grey / near-grey
  const hue = Math.round(((Math.atan2(B, A) * 180) / Math.PI + 360) % 360)
  const light = hue > 80 && hue < 110 ? 0.78 : 0.75
  return `oklch(${light} 0.16 ${hue})`
}
const capitalizeAfterSpace = (v) => (/\s/.test(v) && v ? v.charAt(0).toUpperCase() + v.slice(1) : v)

const DragGrip = () => (
  <span className="drag-grip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
)

function TaskRow({ task, number, inMyDay, project, onToggleDone, onToggleMyDay, onPickProject, onSetTitle, onDelete, dragHandleProps, dragging }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const tagRef = useRef(null)
  useEffect(() => {
    if (!tagOpen) return undefined
    const close = (e) => { if (!tagRef.current?.contains(e.target)) setTagOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [tagOpen])
  const [value, setValue] = useState(task.title)
  const done = task.status === 'done'
  const color = ROW_PALETTE[(number - 1) % ROW_PALETTE.length]
  const stop = (e) => e.stopPropagation() // taps on buttons must not start a row drag

  const commit = () => {
    const title = value.trim()
    if (title && title !== task.title) onSetTitle(task, title)
    setEditing(false)
  }

  return (
    <div
      className={'timed-row timed-row--notime' + (done ? ' timed-row--done' : '') + (dragging ? ' timed-row--dragging' : '')}
      {...(editing ? null : dragHandleProps)}
    >
      <span className="timed-row__body" style={{ background: color.bg, color: color.text, '--h': color.hue, '--row-bg-light': color.bg }}>
        <DragGrip />
        <span className="timed-row__title">
          <span className="timed-row__num">{number}.</span>
          {editing ? (
            <>
              <input
                type="text"
                className="timed-inline timed-inline--title"
                value={value}
                autoFocus
                onChange={(e) => setValue(capitalizeAfterSpace(e.target.value))}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
                  if (e.key === 'Escape') { setValue(task.title); setEditing(false) }
                }}
              />
              <button
                type="button"
                className="task-row__delete"
                onPointerDown={stop}
                onMouseDown={(e) => e.preventDefault()} // keep focus so the click lands before blur-commit
                onClick={() => onDelete(task.id)}
                aria-label={t('tasksList.deleteTask')}
                title={t('tasksList.deleteTask')}
              >
                ×
              </button>
            </>
          ) : (
            <span className="timed-row__title-text" onDoubleClick={() => { setValue(task.title); setEditing(true) }}>{task.title}</span>
          )}
        </span>
        <button
          type="button"
          className={'task-myday' + (inMyDay ? ' task-myday--on' : '')}
          onPointerDown={stop}
          onClick={() => onToggleMyDay(task)}
          title={inMyDay ? t('tasksList.removeFromMyDay') : t('tasksList.addToMyDay')}
          aria-label={inMyDay ? t('tasksList.removeFromMyDay') : t('tasksList.addToMyDay')}
          aria-pressed={inMyDay}
        >
          {inMyDay ? (
            <SideIconMyDay size={16} />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
            </svg>
          )}
        </button>
        {/* Collapsed: just a coloured dot (long names ate the row). Tap = show the name; tap the name = change project. */}
        <span ref={tagRef} className="task-tag-wrap">
          {project && tagOpen ? (
            <button
              type="button"
              className="task-tag"
              style={{ '--tag-deep': getProjectColor(project), '--tag-bright': brightTagColor(getProjectColor(project)) }}
              onPointerDown={stop}
              onClick={() => { setTagOpen(false); onPickProject(task) }}
              title={t('tasksList.changeProject')}
              aria-label={t('tasksList.changeProject')}
            >
              <span className="task-tag__name">{project.name}</span>
            </button>
          ) : (
            <button
              type="button"
              className={'task-tag task-tag--dot' + (project ? '' : ' task-tag--none')}
              style={project ? { '--tag-deep': getProjectColor(project), '--tag-bright': brightTagColor(getProjectColor(project)) } : undefined}
              onPointerDown={stop}
              onClick={() => (project ? setTagOpen(true) : onPickProject(task))}
              title={project ? project.name : t('tasksList.project')}
              aria-label={project ? project.name : t('tasksList.project')}
            >
              {project ? null : '+'}
            </button>
          )}
        </span>
      </span>
      <span className="timed-row__actions">
        <button
          type="button"
          className={'timed-row__done-btn' + (done ? ' timed-row__done-btn--done' : '')}
          onClick={() => onToggleDone(task.id)}
          aria-label={done ? 'Выполнено' : 'Выполнить'}
        >
          {done ? '✓' : ''}
        </button>
      </span>
    </div>
  )
}

export default function TasksListPage() {
  const { t } = useTranslation()
  const tasks = useTasksStore((s) => s.tasks)
  const projects = useTasksStore((s) => s.projects)
  const addTask = useTasksStore((s) => s.addTask)
  const updateTask = useTasksStore((s) => s.updateTask)
  const deleteTask = useTasksStore((s) => s.deleteTask)
  const toggleTaskDone = useTasksStore((s) => s.toggleTaskDone)
  const addProject = useTasksStore((s) => s.addProject)
  const setProjectFlow = useTasksStore((s) => s.setProjectFlow)
  const reorderTasks = useTasksStore((s) => s.reorderTasks)
  const habits = useHabitsStore((s) => s.habits)
  const setHabitCompletion = useHabitsStore((s) => s.setCompletion)

  // Re-read the date on refocus / midnight so «Мой день» stays right overnight.
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const sync = () => setToday(todayISO())
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => { window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync) }
  }, [])

  // Open tasks plus those finished today (they leave at the day's end, like in
  // «Мой день»). Repeating tasks live in «Мой день» and «Привычки», not here.
  const rows = useMemo(() => tasks.filter((task) => {
    if (isRecurring(task)) return false
    if (task.status === 'done') return !!task.completedAt && isoFromDate(new Date(task.completedAt)) === today
    return task.status === 'active'
  }), [tasks, today])

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  // A project's task shows in «Мой день» only once it is on that project's map.
  const onMap = useMemo(() => new Set(projects.flatMap((p) => p.flow || [])), [projects])
  const inMyDay = (task) => {
    const iso = task.deadline || task.whenDate
    return !!iso && iso <= today && (!task.projectId || onMap.has(task.id))
  }

  const placeOnMap = (taskId, projectId) => {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const flow = project.flow || []
    if (!flow.includes(taskId)) setProjectFlow(projectId, [...flow, taskId])
  }
  const toggleMyDay = (task) => {
    if (inMyDay(task)) {
      updateTask(task.id, { whenDate: null, deadline: null })
    } else {
      updateTask(task.id, { whenDate: today, deadline: null })
      if (task.projectId) placeOnMap(task.id, task.projectId)
    }
  }
  const changeProject = (task, projectId) => {
    const wasInMyDay = inMyDay(task)
    const old = projectById.get(task.projectId)
    if (old && (old.flow || []).includes(task.id)) setProjectFlow(old.id, old.flow.filter((id) => id !== task.id))
    updateTask(task.id, { projectId })
    if (wasInMyDay && projectId) placeOnMap(task.id, projectId)
  }

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const draftRef = useRef(null)

  // Project pop-up: for a task being added (mode 'add', held until a project is
  // chosen) or for an existing one (mode 'change').
  const [picker, setPicker] = useState(null) // { mode: 'add', title } | { mode: 'change', task }
  const pick = (projectId) => {
    if (!picker) return
    if (picker.mode === 'add') {
      addTask({ title: picker.title, stage: 'tasks', projectId })
      setDraft('') // the typed row closes once the task exists; cancelling the pop-up keeps the text
      setAdding(false)
    } else {
      changeProject(picker.task, projectId)
    }
    setPicker(null)
  }
  const createAndPick = (name) => {
    const project = addProject(name)
    if (project) pick(project.id)
  }

  useEffect(() => { if (adding) draftRef.current?.focus() }, [adding])
  const submitDraft = () => {
    const title = draft.trim()
    if (!title) return
    setPicker({ mode: 'add', title })
  }
  const closePicker = () => setPicker(null)
  const finishAdd = () => { setDraft(''); setAdding(false) }

  const ids = rows.map((r) => r.id)
  const drag = useDragReorder(ids, reorderTasks)
  const ordered = drag.displayOrder.length === rows.length
    ? drag.displayOrder.map((id) => rows.find((r) => r.id === id)).filter(Boolean)
    : rows

  const onToggleDone = (id) => {
    const task = tasks.find((x) => x.id === id)
    toggleTaskDone(id)
    if (task) syncHabitForTask(task, task.status !== 'done', { habits, setCompletion: setHabitCompletion })
  }

  return (
    <>
      <div className="tasks-page tasks-page--edge-to-edge">
        <div className="tasks-board tasks-board--fill tasks-board--stacked">
          <div className="tasks-column tasks-column--bucket">
            <div className="tasks-column__header tasks-column__header--today">
              <span className="tasks-column__header-title tasks-column__header-title--center">
                <SideIconTasks size={15} />{t('tasksList.title')}
              </span>
            </div>
            <div className="timed-list">
              {ordered.length === 0 && !adding && <p className="tasks-cards__empty">{t('tasksList.empty')}</p>}
              {ordered.map((task, i) => (
                <div key={task.id}>
                  <TaskRow
                    task={task}
                    number={i + 1}
                    inMyDay={inMyDay(task)}
                    project={projectById.get(task.projectId)}
                    onToggleDone={onToggleDone}
                    onToggleMyDay={toggleMyDay}
                    onPickProject={(tk) => setPicker({ mode: 'change', task: tk })}
                    onSetTitle={(tk, title) => updateTask(tk.id, { title })}
                    onDelete={deleteTask}
                    dragHandleProps={drag.bindHandle(task.id, task.title)}
                    dragging={drag.draggingId === task.id}
                  />
                </div>
              ))}
              {adding ? (
                <div className="timed-row timed-ghost timed-ghost--simple">
                  <span className="timed-row__title">
                    <input
                      ref={draftRef}
                      type="text"
                      className="timed-ghost__title"
                      value={draft}
                      placeholder={t('tasks.gtd.inboxQuickAddPlaceholder')}
                      onChange={(e) => setDraft(capitalizeAfterSpace(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); submitDraft() }
                        if (e.key === 'Escape') finishAdd()
                      }}
                    />
                  </span>
                  <button type="button" className="timed-ghost__add timed-ghost__add--inline" disabled={!draft.trim()} onClick={submitDraft}>
                    {t('tasksActivity.addBtn')}
                  </button>
                  <button type="button" className="timed-ghost__cancel" onClick={finishAdd} aria-label={t('tasks.cancel')} title={t('tasks.cancel')}>×</button>
                </div>
              ) : (
                <button type="button" className="timed-add-slot" onClick={() => setAdding(true)}>
                  {t('tasksList.addTask')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {drag.dragGhost}
      <ProjectPickerModal
        open={!!picker}
        taskTitle={picker ? (picker.mode === 'add' ? picker.title : picker.task.title) : ''}
        projects={projects}
        currentProjectId={picker?.mode === 'change' ? picker.task.projectId : null}
        onPick={pick}
        onCreate={createAndPick}
        onCancel={closePicker}
      />
    </>
  )
}
