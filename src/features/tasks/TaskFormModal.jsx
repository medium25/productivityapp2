import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addDays,
  getProjectColor,
  RECURRENCE_OPTIONS,
  STATE_OPTIONS,
  todayISO,
  WEEKDAYS,
} from './taskLogic'
import { IconChevronDown, IconFlag, IconInboxTray, IconRepeat } from '../../icons/Icons'
import DateCalendar from './DateCalendar'
import ModalClose from './ModalClose'

function deriveInitialState(task, initialProjectId) {
  if (!task) {
    return {
      title: '',
      description: '',
      tagsInput: '',
      projectChoice: initialProjectId || null,
      energy: 'none',
      // 'inbox' isn't one of STATE_OPTIONS' buttons (see its own comment) —
      // seeded here directly so a task added without ever touching the
      // State dropdown lands in Inbox only, undated, instead of silently
      // also landing in Tasks. stateButtonText's fallback (`|| 'stateInbox'`)
      // displays this correctly even with no matching option to highlight.
      stateKey: 'inbox',
      stage: 'inbox',
      deadlineDate: null,
      estimateMinutes: null,
      recurrence: 'none',
      recurrenceDays: [],
    }
  }
  const stateKey = task.projectId
    ? 'projects'
    : task.whenDate
      ? 'tasks'
      : (task.stage === 'inbox' ? 'inbox' : 'sometime')
  return {
    title: task.title,
    description: task.description || '',
    tagsInput: (task.tags || []).join(', '),
    projectChoice: task.projectId || 'none',
    energy: task.energy || 'none',
    stateKey,
    stage: task.stage || (task.whenDate ? 'tasks' : 'inbox'),
    deadlineDate: task.whenDate || null,
    estimateMinutes: task.estimateMinutes ?? null,
    recurrence: task.recurrence || 'none',
    recurrenceDays: task.recurrenceDays ? task.recurrenceDays.slice() : [],
  }
}

// Opened two ways: with no task (a bare "add new task" form) or with a task
// (the "Разбор"/inline edit button) — both render the exact same layout now.
// The old "5-min rule" wizard is gone (per user request), so Add/Edit only
// differ in initial state + button label.
export default function TaskFormModal({
  task,
  projects,
  initialProjectId,
  onSave,
  onClose,
  onCreateProject,
  // Delete now lives here (per user request — the row's own "⋮"/"×" was
  // removed everywhere) instead of a menu on the task row itself. Only
  // rendered while editing a real task, with an inline yes/no confirm
  // before it actually fires.
  onDelete,
  // Renders as a panel right under the task row that opened it (see
  // InboxPage/ActionColumnBoard/TaskSection) instead of a centered
  // overlay — per user request, editing shouldn't cover the whole screen.
  // Only used when editing an existing task; the "add new" flow (no task
  // row to attach under, e.g. GtdBoardPage's post-convert-to-project add)
  // keeps the centered overlay.
  inline = false,
}) {
  const { t } = useTranslation()
  const isEditing = !!task
  const [state, setState] = useState(() => deriveInitialState(task, initialProjectId))
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Which of the 5 right-column dropdowns is open, or null. `stateShowsProjects`
  // is a sub-view of the 'state' dropdown, not a separate dropdown of its own.
  const [openDropdown, setOpenDropdown] = useState(null)
  const [stateShowsProjects, setStateShowsProjects] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [error, setError] = useState('')
  const popoverRef = useRef(null)
  const titleRef = useRef(null)

  useEffect(() => {
    setState(deriveInitialState(task, initialProjectId))
    setOpenDropdown(null)
    setStateShowsProjects(false)
    setNewProjectOpen(false)
    setNewProjectName('')
    setError('')
  }, [task, initialProjectId])

  useEffect(() => {
    if (!openDropdown) return
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpenDropdown(null)
        setStateShowsProjects(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdown])

  const patch = (fields) => setState((s) => ({ ...s, ...fields }))

  const toggleDropdown = (key) => {
    setOpenDropdown((cur) => (cur === key ? null : key))
    if (key !== 'state') setStateShowsProjects(false)
  }

  const toggleRecurDay = (dow) => {
    setState((s) => ({
      ...s,
      recurrenceDays: s.recurrenceDays.includes(dow)
        ? s.recurrenceDays.filter((d) => d !== dow)
        : [...s.recurrenceDays, dow],
    }))
  }

  const selectedProject = state.projectChoice && state.projectChoice !== 'none'
    ? projects.find((p) => p.id === state.projectChoice)
    : null

  const handleCreateProject = () => {
    const name = newProjectName.trim()
    if (!name) return
    const project = onCreateProject(name)
    setNewProjectName('')
    setNewProjectOpen(false)
    if (project) {
      patch({ projectChoice: project.id, stateKey: 'projects' })
      setOpenDropdown(null)
      setStateShowsProjects(false)
    }
  }

  const selectState = (opt) => {
    if (opt.isProjectsOption) {
      setStateShowsProjects(true)
      return
    }
    const { stage, whenDate } = opt.patch(todayISO())
    // 'tasks' patch has no `whenDate` key at all (see STATE_OPTIONS) — an
    // existing due date carries over untouched; 'sometime' explicitly
    // patches whenDate:null to clear it, which still applies here since
    // `null !== undefined`.
    const nextDeadline = whenDate !== undefined ? whenDate : state.deadlineDate
    patch({ stateKey: opt.key, stage, deadlineDate: nextDeadline, projectChoice: null })
    // Moving into Tasks with no due date yet — per user request this must
    // be set explicitly, not silently default to today, so send the user
    // straight into the Due dropdown instead of just closing this one.
    setOpenDropdown(opt.key === 'tasks' && !nextDeadline ? 'due' : null)
    setStateShowsProjects(false)
  }

  const selectProjectForState = (projectId) => {
    patch({ projectChoice: projectId, stateKey: 'projects' })
    setOpenDropdown(null)
    setStateShowsProjects(false)
  }

  const handleTitleChange = (e) => {
    const value = e.target.value
    const lines = value.split('\n')
    patch({ title: lines.length > 10 ? lines.slice(0, 10).join('\n') : value })
  }

  const handleSave = () => {
    const title = state.title.trim()
    if (!title) { setError(t('tasks.errorTitleRequired')); return }

    const projectId = state.stateKey === 'projects' && state.projectChoice && state.projectChoice !== 'none'
      ? state.projectChoice
      : null
    if (state.stateKey === 'projects' && !projectId) { setError(t('tasks.errorProjectRequired')); return }
    // Tasks requires a real due date — per user request, moving a task here
    // must not go through without one (selectState already sends the user
    // straight into the Due dropdown when it's missing; this is the actual
    // save-time gate in case they closed it without picking anything).
    if (state.stateKey === 'tasks' && !state.deadlineDate) { setError(t('tasks.errorDueRequired')); return }

    // State and Due are independent dropdowns now — State sets `stage`
    // (via selectState's opt.patch) and seeds a default date, but the user
    // can still freely override the date afterward through the Due
    // dropdown regardless of which State is picked. Trust whatever the two
    // controls currently hold rather than re-deriving from stateKey alone.
    const stage = state.stage
    const whenDate = state.deadlineDate

    const tags = state.tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag, i, arr) => tag && arr.indexOf(tag) === i)

    onSave({
      title,
      description: state.description,
      tags,
      projectId,
      energy: state.energy,
      stage,
      whenDate,
      deadline: whenDate,
      estimateMinutes: state.estimateMinutes,
      recurrence: state.recurrence,
      recurrenceDays: state.recurrence === 'custom' ? state.recurrenceDays : null,
    })

    // Add flow only (not editing) — the caller may keep this form mounted
    // open for rapid-fire entry of several tasks in a row (per user
    // request: Enter shouldn't force reopening the form for every single
    // task), so this clears itself back to a blank form and refocuses the
    // title field instead of relying on a remount (task/initialProjectId
    // don't change between saves here, so the deriveInitialState effect
    // above wouldn't otherwise fire again).
    if (!isEditing) {
      setState(deriveInitialState(null, initialProjectId))
      setError('')
      titleRef.current?.focus()
    }
  }

  // Dropdown buttons show the field's own name (e.g. "Time") until the user
  // actually picks something, then swap to the chosen value itself — not
  // "Time: 30 minutes" — matching the reference screenshots' plain-word
  // buttons. State always has a real value (never truly unset), so it
  // always shows the value.
  const dueButtonText = state.deadlineDate || t('tasks.dueLabel')
  const stateButtonText = state.stateKey === 'projects' && selectedProject
    ? selectedProject.name
    : t(`tasks.${STATE_OPTIONS.find((o) => o.key === state.stateKey)?.labelKey || 'stateInbox'}`)
  const repeatButtonText = state.recurrence !== 'none'
    ? t(`tasks.${RECURRENCE_OPTIONS.find((o) => o.key === state.recurrence)?.labelKey || 'recurrenceNone'}`)
    : t('tasks.recurrenceLabel')

  const panel = (
    <div className={'task-modal task-modal--form' + (inline ? ' task-modal--inline' : '')} ref={popoverRef}>
      {!inline && <ModalClose onClick={onClose} />}
      <div className="task-modal__header">
        {isEditing ? t('tasks.editTaskTitle') : t('tasks.addDetailedTitle')}
      </div>

        <div className="task-modal__body task-modal__body--split">
          <div className="task-modal__main-col">
            <textarea
              ref={titleRef}
              className="task-modal__title-input"
              placeholder={t('tasks.titlePlaceholder')}
              value={state.title}
              onChange={handleTitleChange}
              onKeyDown={(e) => {
                // Enter saves, same as every other quick-add input in the
                // app (see TasksQuickAdd) — Shift+Enter still inserts a
                // newline for multi-line titles.
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
              }}
              rows={2}
              autoFocus
            />
            {error && <div className="task-modal__error">{error}</div>}
          </div>

          <div className="task-modal__side-col">
            {/* Due first in the same group as Time/State/Repeat (per user
                request — it was pulled out into its own top row, then put
                back here). Still the one field selectState actually cares
                about (see STATE_OPTIONS/handleSave's Tasks-requires-a-date
                gate). */}
            <div className="task-modal__dropdown">
              <button type="button" className="task-modal__dropdown-btn" onClick={() => toggleDropdown('due')}>
                <IconFlag size={16} className="task-modal__dropdown-icon" />
                <span className="task-modal__dropdown-text">{dueButtonText}</span>
                <IconChevronDown size={14} className="task-modal__dropdown-chevron" />
              </button>
              {openDropdown === 'due' && (
                <div className="task-modal__dropdown-panel task-modal__dropdown-panel--due">
                  {/* Quick presets above the calendar (per user request —
                      "удобнее выбор дедлайна") so the 3 most common picks
                      don't need paging through months. */}
                  <div className="task-modal__due-presets">
                    <button type="button" onClick={() => { patch({ deadlineDate: todayISO() }); setOpenDropdown(null) }}>
                      {t('tasks.today')}
                    </button>
                    <button type="button" onClick={() => { patch({ deadlineDate: addDays(todayISO(), 1) }); setOpenDropdown(null) }}>
                      {t('tasks.tomorrow')}
                    </button>
                    <button type="button" onClick={() => { patch({ deadlineDate: addDays(todayISO(), 7) }); setOpenDropdown(null) }}>
                      {t('tasks.nextWeek')}
                    </button>
                  </div>
                  <DateCalendar
                    value={state.deadlineDate}
                    onChange={(iso) => patch({ deadlineDate: iso })}
                  />
                  <div className="task-modal__due-actions">
                    <button type="button" onClick={() => setOpenDropdown(null)}>{t('tasks.closeButton')}</button>
                    <button type="button" onClick={() => { patch({ deadlineDate: null }); setOpenDropdown(null) }}>
                      {t('tasks.removeDate')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="task-modal__dropdown">
              <button type="button" className="task-modal__dropdown-btn" onClick={() => toggleDropdown('state')}>
                <IconInboxTray size={16} className="task-modal__dropdown-icon" />
                <span className="task-modal__dropdown-text">{stateButtonText}</span>
                <IconChevronDown size={14} className="task-modal__dropdown-chevron" />
              </button>
              {openDropdown === 'state' && (
                <div className="task-modal__dropdown-panel">
                  {!stateShowsProjects ? (
                    STATE_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={'task-modal__project-option' + (state.stateKey === opt.key ? ' active' : '')}
                        onClick={() => selectState(opt)}
                      >
                        {t(`tasks.${opt.labelKey}`)}
                      </button>
                    ))
                  ) : (
                    <>
                      {projects.filter((p) => p.status !== 'done').map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={'task-modal__project-option' + (state.projectChoice === p.id ? ' active' : '')}
                          onClick={() => selectProjectForState(p.id)}
                        >
                          <span className="task-modal__project-dot" style={{ '--dot-color': getProjectColor(p) }} />
                          {p.name}
                        </button>
                      ))}
                      {newProjectOpen ? (
                        <div className="task-modal__new-project-row">
                          <input
                            type="text"
                            placeholder={t('tasks.newProjectPlaceholder')}
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            autoFocus
                          />
                          <button type="button" onClick={handleCreateProject}>{t('tasks.addProjectButton')}</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="task-modal__project-option task-modal__project-option--create"
                          onClick={() => setNewProjectOpen(true)}
                        >
                          + {t('tasks.createProject')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="task-modal__dropdown">
              <button type="button" className="task-modal__dropdown-btn" onClick={() => toggleDropdown('repeat')}>
                <IconRepeat size={16} className="task-modal__dropdown-icon" />
                <span className="task-modal__dropdown-text">{repeatButtonText}</span>
                <IconChevronDown size={14} className="task-modal__dropdown-chevron" />
              </button>
              {openDropdown === 'repeat' && (
                <div className="task-modal__dropdown-panel">
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={'task-modal__project-option' + (state.recurrence === opt.key ? ' active' : '')}
                      onClick={() => {
                        patch({ recurrence: opt.key })
                        if (opt.key !== 'custom') setOpenDropdown(null)
                      }}
                    >
                      {t(`tasks.${opt.labelKey}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {state.recurrence === 'custom' && (
              <div className="task-modal__chip-group">
                {WEEKDAYS.map((w) => (
                  <button
                    key={w.dow}
                    type="button"
                    className={'task-modal__chip' + (state.recurrenceDays.includes(w.dow) ? ' active' : '')}
                    onClick={() => toggleRecurDay(w.dow)}
                  >
                    {t(`tasks.weekdayShort.${w.key}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      <div className="task-modal__footer">
        {isEditing && onDelete && (
          confirmingDelete ? (
            <button type="button" className="task-modal__delete-btn task-modal__delete-btn--confirm" onClick={() => onDelete(task.id)}>
              {t('tasks.yes')}
            </button>
          ) : (
            <button type="button" className="task-modal__delete-btn" onClick={() => setConfirmingDelete(true)}>
              {t('tasks.deleteTask')}
            </button>
          )
        )}
        <span className="task-modal__footer-spacer" />
        <button type="button" onClick={onClose}>{t('tasks.cancel')}</button>
        <button type="button" className="primary" onClick={handleSave}>
          {isEditing ? t('tasks.saveButton') : t('tasks.addButton')}
        </button>
      </div>
    </div>
  )

  if (inline) return panel

  return (
    <div className="task-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {panel}
    </div>
  )
}
