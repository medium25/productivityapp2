import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/useTasksStore'
import { useHabitsStore } from '../store/useHabitsStore'
import { useDragReorder } from '../features/tasks/useDragReorder'
import { getProjectColor, todayISO, nextRecurringDate } from '../features/tasks/taskLogic'
import { syncHabitForTask, spawnHabitForTask } from '../features/tasks/habitTaskSync'
import { ROW_PALETTE } from '../features/tasks/rowPalette'
import { brightTagColor, projectRowColors, projectRole, groupProjectRows, projectLinks } from '../features/tasks/projectParent'
import ProjectPickerModal from '../features/tasks/ProjectPickerModal'
import ProjectPathModal from '../features/tasks/ProjectPathModal'
import ModalClose from '../features/tasks/ModalClose'
import { CYCLE_ICON, CyclePicker } from '../features/tasks/CyclePicker'
import { SideIconMyDay, SideIconTasks } from '../layout/sidebarIcons'

// «Задачи»: every open task in one list, drawn like the rows of «Мой день» but
// without any time. Each row has a project pill (tap to change the project) and a
// «Мой день» button that puts the task into today's list (tap again to take it out).
// Adding a task asks for its project in a pop-up first.
const isRecurring = (task) => !!task.recurrence && task.recurrence !== 'none'
const capitalizeAfterSpace = (v) => (/\s/.test(v) && v ? v.charAt(0).toUpperCase() + v.slice(1) : v)

const DragGrip = () => (
  <span className="drag-grip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
)

function TaskRow({ task, number, role, links, onConvert, inMyDay, project, onToggleDone, onToggleMyDay, onPickProject, onOpenPath, onSetTitle, onSetCycle, onDelete, selecting, selected, onSelect, dragHandleProps, dragging }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [cycleOpen, setCycleOpen] = useState(false)
  const closeCycle = useCallback(() => setCycleOpen(false), [])
  const [value, setValue] = useState(task.title)
  const done = task.status === 'done'
  const color = role ? projectRowColors(role.project) : ROW_PALETTE[(number - 1) % ROW_PALETTE.length]
  const stop = (e) => e.stopPropagation() // taps on buttons must not start a row drag

  const commit = () => {
    const title = value.trim()
    if (title && title !== task.title) onSetTitle(task, title)
    setEditing(false)
  }

  return (
    <>
    <div
      className={'timed-row timed-row--notime' + (done ? ' timed-row--done' : '') + (dragging ? ' timed-row--dragging' : '') + (selecting ? ' timed-row--selecting' : '') + (selected ? ' timed-row--selected' : '') + (links?.prev ? ' timed-row--plink-prev' : '') + (links?.next ? ' timed-row--plink-next' : '')}
      style={role ? { '--proj-line': color.line } : undefined}
      {...(editing || selecting ? null : dragHandleProps)}
      onClick={selecting ? () => onSelect(task.id) : undefined}
    >
      <span className="timed-row__body" style={{ background: color.bg, color: color.text, '--h': color.hue, '--row-bg-light': color.bg }}>
        {selecting ? (
          <span className={'task-sel' + (selected ? ' task-sel--on' : '')} aria-hidden="true">
            {selected && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
          </span>
        ) : <DragGrip />}
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
        {role?.kind === 'parent' && <span className="proj-pill">{t('tasksList.projectPill')}</span>}
        {!role && !task.projectId && !done && (
          <button
            type="button"
            className="proj-btn"
            onPointerDown={stop}
            onClick={() => onConvert(task)}
            title={t('tasksList.convertToProject')}
            aria-label={t('tasksList.convertToProject')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM12 11v5M9.5 13.5h5" /></svg>
          </button>
        )}
        <button
          type="button"
          className={'cycle-sign task-cycle' + (isRecurring(task) ? ' cycle-sign--on' : '')}
          data-cycle-trigger
          onPointerDown={stop}
          onClick={() => setCycleOpen((v) => !v)}
          title={t('tasksHub.cycleTitle')}
          aria-label={t('tasksHub.cycleTitle')}
        >
          {CYCLE_ICON}
        </button>
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
        {/* Just a coloured dot (long names ate the row): tap = the project's path window; «+» when there is no project. */}
        <span className="task-tag-wrap">
          <button
            type="button"
            className={'task-tag task-tag--dot' + (project ? '' : ' task-tag--none')}
            style={project ? { '--tag-deep': getProjectColor(project), '--tag-bright': brightTagColor(getProjectColor(project)) } : undefined}
            onPointerDown={stop}
            onClick={() => (project ? onOpenPath(task) : onPickProject(task))}
            title={project ? project.name : t('tasksList.project')}
            aria-label={project ? project.name : t('tasksList.project')}
          >
            {project ? null : '+'}
          </button>
        </span>
      </span>
      <span className="timed-row__actions">
        {role?.kind === 'parent' && role.locked ? (
          <button
            type="button"
            className="timed-row__done-btn timed-row__done-btn--lock"
            disabled
            title={t('tasksList.projectLocked', { done: role.done, total: role.total })}
            aria-label={t('tasksList.projectLocked', { done: role.done, total: role.total })}
          >
            {role.done}/{role.total}
          </button>
        ) : (
          <button
            type="button"
            className={'timed-row__done-btn' + (done ? ' timed-row__done-btn--done' : '') + (role?.kind === 'parent' && !done ? ' timed-row__done-btn--ready' : '')}
            onClick={() => onToggleDone(task.id)}
            aria-label={done ? 'Выполнено' : 'Выполнить'}
            title={role?.kind === 'parent' && !done ? t('tasksList.projectReady') : undefined}
          >
            {done ? '✓' : ''}
          </button>
        )}
      </span>
    </div>
    {cycleOpen && <CyclePicker task={task} t={t} onSet={(rec, d) => onSetCycle(task, rec, d)} onClose={closeCycle} />}
    </>
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
  const deleteProject = useTasksStore((s) => s.deleteProject)
  const convertToProject = useTasksStore((s) => s.convertToProject)
  const setProjectFlow = useTasksStore((s) => s.setProjectFlow)
  const reorderTasks = useTasksStore((s) => s.reorderTasks)
  const habits = useHabitsStore((s) => s.habits)
  const addHabit = useHabitsStore((s) => s.addHabit)
  const setHabitCompletion = useHabitsStore((s) => s.setCompletion)

  // Re-read the date on refocus / midnight so «Мой день» stays right overnight.
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const sync = () => setToday(todayISO())
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => { window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync) }
  }, [])

  // Open tasks plus every finished one — done tasks stay here until the user presses
  // «Убрать выполненные» (which stamps listClearedAt). Repeating tasks live in
  // «Мой день» and «Привычки», not here.
  const rows = useMemo(() => tasks.filter((task) => {
    if (task.createdIn === 'myday') return false // made straight in «Мой день» — stays there, not in this list
    if (isRecurring(task) && task.stage !== 'tasks') return false // repeating tasks made elsewhere live in «Мой день» / «Привычки»
    if (task.status === 'done') return !!task.completedAt && (!task.listClearedAt || task.completedAt > task.listClearedAt)
    return task.status === 'active'
  }), [tasks])
  const doneRows = rows.filter((r) => r.status === 'done')
  const [confirmClear, setConfirmClear] = useState(false)
  useEffect(() => {
    if (!confirmClear) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setConfirmClear(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmClear])
  const clearDone = () => {
    setConfirmClear(false)
    const stamp = new Date().toISOString()
    doneRows.forEach((r) => updateTask(r.id, { listClearedAt: stamp }))
  }

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
      updateTask(task.id, { whenDate: null, deadline: null, dayRank: null })
    } else {
      // dayRank sends it to the END of «Мой день» without moving it in this list.
      updateTask(task.id, { whenDate: today, deadline: null, dayRank: Date.now() })
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

  const setCycle = (task, recurrence, recurrenceDays) => {
    const patch = { recurrence, recurrenceDays }
    // Weekly / monthly with a chosen day: the task shows up on the next such day.
    if ((recurrence === 'weekly' || recurrence === 'monthly') && recurrenceDays?.length) {
      const next = nextRecurringDate({ ...task, ...patch }, todayISO())
      if (next) { patch.whenDate = next; patch.deadline = null }
    }
    updateTask(task.id, patch)
    spawnHabitForTask({ ...task, recurrence, recurrenceDays }, { habits, addHabit })
  }

  const [pathTaskId, setPathTaskId] = useState(null) // the task whose project path window is open
  const pathTask = pathTaskId ? tasks.find((x) => x.id === pathTaskId) : null
  const pathProject = pathTask ? projectById.get(pathTask.projectId) : null

  // Group mode: pick several tasks and delete them in one go (to Трэш, like a single delete).
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [confirmDel, setConfirmDel] = useState(false)
  const exitSelect = () => { setSelecting(false); setSelected(new Set()); setConfirmDel(false) }
  const toggleSelected = (id) => {
    setConfirmDel(false)
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  useEffect(() => {
    if (!selecting) return undefined
    const onKey = (e) => { if (e.key === 'Escape') exitSelect() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selecting])

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const draftRef = useRef(null)

  // Project pop-up for an existing task (opened from its «+» / project dot).
  const [picker, setPicker] = useState(null) // { task }
  const pick = (projectId) => {
    if (!picker) return
    changeProject(picker.task, projectId)
    setPicker(null)
  }
  const createAndPick = (name) => {
    const project = addProject(name)
    if (project) pick(project.id)
  }

  useEffect(() => { if (adding) draftRef.current?.focus() }, [adding])
  // Quick add: Enter creates the task at once (no project) and keeps the field open for the next one.
  const submitDraft = () => {
    const title = draft.trim()
    if (!title) return
    addTask({ title, stage: 'tasks', projectId: null, createdIn: 'tasks' })
    setDraft('')
    draftRef.current?.focus()
  }
  const closePicker = () => setPicker(null)
  const finishAdd = () => { setDraft(''); setAdding(false) }

  const ids = rows.map((r) => r.id)
  const drag = useDragReorder(ids, reorderTasks)
  const orderedRaw = drag.displayOrder.length === rows.length
    ? drag.displayOrder.map((id) => rows.find((r) => r.id === id)).filter(Boolean)
    : rows
  // Each project made from a task is shown together: the parent row, then its tasks.
  const ordered = useMemo(() => groupProjectRows(orderedRaw, projects), [orderedRaw, projects])
  const rowLinks = useMemo(() => projectLinks(ordered, projects), [ordered, projects])

  const onToggleDone = (id) => {
    const task = tasks.find((x) => x.id === id)
    toggleTaskDone(id)
    if (task) syncHabitForTask(task, task.status !== 'done', { habits, setCompletion: setHabitCompletion })
  }

  const allSelected = ordered.length > 0 && ordered.every((r) => selected.has(r.id))
  const deleteSelected = () => {
    ordered.filter((r) => selected.has(r.id)).forEach((r) => deleteTask(r.id))
    exitSelect()
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
              {doneRows.length > 0 && !selecting && (
                <button type="button" className="tasks-clear-done" onClick={() => setConfirmClear(true)} title={t('tasksList.clearDone')} aria-label={t('tasksList.clearDone')}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h10M4 12h6M4 17h10M15 15l2.5 2.5L22 12" /></svg>
                  <span className="tasks-clear-done__n">{doneRows.length}</span>
                </button>
              )}
              {ordered.length > 0 && (
                <button type="button" className={'tasks-select-btn' + (selecting ? ' tasks-select-btn--on' : '')} onClick={() => (selecting ? exitSelect() : setSelecting(true))} title={selecting ? t('tasksList.selectDone') : t('tasksList.select')} aria-label={selecting ? t('tasksList.selectDone') : t('tasksList.select')}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
                    <path d="M8 12.3l2.8 2.8L16.3 9.5" />
                  </svg>
                </button>
              )}
            </div>
            {selecting && (
              <div className="tasks-select-bar">
                <span className="tasks-select-bar__count">{t('tasksList.selectedCount', { n: selected.size })}</span>
                <button type="button" onClick={() => { setConfirmDel(false); setSelected(allSelected ? new Set() : new Set(ordered.map((r) => r.id))) }}>
                  {allSelected ? t('tasksList.selectNone') : t('tasksList.selectAll')}
                </button>
                {confirmDel ? (
                  <>
                    <span className="tasks-select-bar__ask">{t('tasksList.deleteSelectedConfirm', { n: selected.size })}</span>
                    <button type="button" className="tasks-select-bar__danger" onClick={deleteSelected}>{t('tasksList.deleteSelectedYes')}</button>
                    <button type="button" onClick={() => setConfirmDel(false)}>{t('tasks.cancel')}</button>
                  </>
                ) : (
                  <button type="button" className="tasks-select-bar__danger" disabled={selected.size === 0} onClick={() => setConfirmDel(true)}>
                    {t('tasksList.deleteSelected')}{selected.size ? ` (${selected.size})` : ''}
                  </button>
                )}
              </div>
            )}
            <div className="timed-list">
              {ordered.length === 0 && !adding && <p className="tasks-cards__empty">{t('tasksList.empty')}</p>}
              {ordered.map((task, i) => (
                <div key={task.id} className={i < ordered.length - 1 ? 'task-row-gap' : undefined}>
                  <TaskRow
                    task={task}
                    number={i + 1}
                    role={projectRole(task, tasks, projects)}
                    links={rowLinks[i]}
                    onConvert={(tk) => convertToProject(tk.id)}
                    inMyDay={inMyDay(task)}
                    project={projectById.get(task.projectId)}
                    onToggleDone={onToggleDone}
                    onToggleMyDay={toggleMyDay}
                    onPickProject={(tk) => setPicker({ task: tk })}
                    onOpenPath={(tk) => setPathTaskId(tk.id)}
                    onSetTitle={(tk, title) => updateTask(tk.id, { title })}
                    onSetCycle={setCycle}
                    onDelete={deleteTask}
                    selecting={selecting}
                    selected={selected.has(task.id)}
                    onSelect={toggleSelected}
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
      {confirmClear && (
        <div className="task-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmClear(false) }}>
          <div className="task-modal" role="alertdialog" aria-modal="true">
            <ModalClose onClick={() => setConfirmClear(false)} />
            <div className="task-modal__header">{t('tasksList.clearDone')}</div>
            <div className="task-modal__body">
              <p className="task-modal__due-required-text">{t('tasksList.clearDoneConfirm', { n: doneRows.length })}</p>
            </div>
            <div className="task-modal__footer">
              <button type="button" onClick={() => setConfirmClear(false)}>{t('tasks.cancel')}</button>
              <span className="task-modal__footer-spacer" />
              <button type="button" className="primary" onClick={clearDone}>{t('tasksList.clearDoneYes')}</button>
            </div>
          </div>
        </div>
      )}
      <ProjectPathModal
        open={!!pathProject}
        project={pathProject}
        color={pathProject ? { deep: getProjectColor(pathProject), bright: brightTagColor(getProjectColor(pathProject)) } : { deep: '#888', bright: '#aaa' }}
        tasks={tasks}
        onClose={() => setPathTaskId(null)}
        onChangeProject={() => { setPathTaskId(null); if (pathTask) setPicker({ task: pathTask }) }}
      />
      <ProjectPickerModal
        open={!!picker}
        taskTitle={picker ? picker.task.title : ''}
        projects={projects}
        currentProjectId={picker ? picker.task.projectId : null}
        onPick={pick}
        onCreate={createAndPick}
        onDelete={deleteProject}
        onCancel={closePicker}
      />
    </>
  )
}
