import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/useTasksStore'
import { getProjectColor } from '../features/tasks/taskLogic'
import { useDragReorder } from '../features/tasks/useDragReorder'
import { PROJECT_COLORS } from '../constants/colorPalette'
import { IconBack, IconMoreVertical } from '../icons/Icons'

// "⋮" on a project card: rename / change color / delete (with confirm).
function ProjectCardMenu({ project }) {
  const { t } = useTranslation()
  const renameProject = useTasksStore((s) => s.renameProject)
  const setProjectColor = useTasksStore((s) => s.setProjectColor)
  const deleteProjectAndTasks = useTasksStore((s) => s.deleteProjectAndTasks)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('menu')
  const [name, setName] = useState(project.name)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = (e) => {
    e.stopPropagation()
    setMode('menu')
    setName(project.name)
    setOpen((v) => !v)
  }
  const saveName = () => {
    renameProject(project.id, name)
    setOpen(false)
  }

  return (
    <span className="projects-page__menu" ref={ref} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="projects-page__menu-btn" onClick={toggle} aria-label={t('tasks.projectActions')}>
        <IconMoreVertical size={16} />
      </button>
      {open && (
        <div className="projects-page__menu-pop">
          {mode === 'menu' && (
            <>
              <button type="button" onClick={() => setMode('rename')}>{t('tasks.renameProject')}</button>
              <button type="button" onClick={() => setMode('color')}>{t('projectsPage.changeColor')}</button>
              <button type="button" className="projects-page__menu-danger" onClick={() => setMode('delete')}>{t('tasks.deleteProject')}</button>
            </>
          )}
          {mode === 'rename' && (
            <div className="projects-page__menu-form">
              <input
                type="text"
                value={name}
                maxLength={48}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') setOpen(false)
                }}
              />
              <button type="button" className="projects-page__btn projects-page__btn--primary" onClick={saveName} disabled={!name.trim()}>{t('projectsPage.save')}</button>
            </div>
          )}
          {mode === 'color' && (
            <div className="projects-page__swatches projects-page__swatches--menu">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={'projects-page__swatch' + (c === project.color ? ' projects-page__swatch--active' : '')}
                  style={{ background: c }}
                  onClick={() => { setProjectColor(project.id, c); setOpen(false) }}
                  aria-label={c}
                />
              ))}
            </div>
          )}
          {mode === 'delete' && (
            <div className="projects-page__menu-form">
              <span className="projects-page__menu-confirm">{t('tasks.confirmDeleteProject')}</span>
              <div className="projects-page__create-actions">
                <button type="button" className="projects-page__btn projects-page__btn--danger" onClick={() => deleteProjectAndTasks(project.id)}>{t('tasks.yes')}</button>
                <button type="button" className="projects-page__btn" onClick={() => setOpen(false)}>{t('tasks.no')}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  )
}

// Projects section (per user request) — one card per project; clicking
// opens that project's split-screen page (ProjectFlowPage.jsx).
export default function ProjectsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const projects = useTasksStore((s) => s.projects)
  const tasks = useTasksStore((s) => s.tasks)
  const addProject = useTasksStore((s) => s.addProject)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])

  const submit = () => {
    if (!name.trim()) return
    addProject(name, color)
    setName('')
    setCreating(false)
  }

  const cards = useMemo(() => {
    const list = projects
      .filter((p) => p.status !== 'done')
      .map((p) => {
        const own = tasks.filter((tk) => tk.projectId === p.id && tk.status !== 'trashed')
        return { project: p, total: own.length, done: own.filter((tk) => tk.status === 'done').length }
      })
    // Pinned first, then the user's own (drag) order — the store's order.
    return list.sort((a, b) => (a.project.pinned ? 0 : 1) - (b.project.pinned ? 0 : 1))
  }, [projects, tasks])

  const reorderProjects = useTasksStore((s) => s.reorderProjects)
  const ids = useMemo(() => cards.map((c) => c.project.id), [cards])
  const { displayOrder, draggingId, bindHandle, dragGhost } = useDragReorder(ids, reorderProjects, { grid: true })
  const cardById = useMemo(() => new Map(cards.map((c) => [c.project.id, c])), [cards])
  const orderedCards = displayOrder.map((id) => cardById.get(id)).filter(Boolean)


  return (
    <div className="projects-page">
      <div className="tasks-hub__back">
        <button type="button" className="page-back" onClick={() => navigate('/upcoming')}>
          <IconBack size={14} /> {t('sections.upcoming.title')}
        </button>
      </div>
      <div className="projects-page__grid">
        {orderedCards.map(({ project, total, done }) => (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              className={'projects-page__card' + (draggingId === project.id ? ' projects-page__card--dragging' : '')}
              {...bindHandle(project.id, project.name)}
              onClick={() => navigate(`/projects/${project.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/projects/${project.id}`) }}
              style={{ '--project-color': getProjectColor(project) }}
            >
              <ProjectCardMenu project={project} />
              <span className="projects-page__card-text">
                <span className="projects-page__card-name">{project.name}</span>
                <span className="projects-page__card-meta">{t('projectsPage.taskCount', { count: total })}</span>
              </span>
              <span className="projects-page__card-bar">
                <span style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
              </span>
            </div>
          ))}
        {creating ? (
          <div className="projects-page__create">
            <input
              type="text"
              className="projects-page__create-input"
              placeholder={t('projectsPage.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); submit() }
                if (e.key === 'Escape') setCreating(false)
              }}
              maxLength={48}
              autoFocus
            />
            <div className="projects-page__swatches">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={'projects-page__swatch' + (c === color ? ' projects-page__swatch--active' : '')}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
            <div className="projects-page__create-actions">
              <button type="button" className="projects-page__btn projects-page__btn--primary" onClick={submit} disabled={!name.trim()}>{t('projectsPage.create')}</button>
              <button type="button" className="projects-page__btn" onClick={() => setCreating(false)}>{t('projectsPage.cancel')}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="projects-page__add" onClick={() => setCreating(true)}>
            <span className="projects-page__add-plus">+</span>
            {t('projectsPage.addProject')}
          </button>
        )}
      </div>
      {dragGhost}
      {cards.length === 0 && !creating && <p className="tasks-cards__empty">{t('projectsPage.empty')}</p>}
    </div>
  )
}
