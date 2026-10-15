import { useTasksStore } from '../store/useTasksStore'

function collectTasksRecords(t) {
  const { tasks, projects } = useTasksStore.getState()
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]))
  return tasks
    .filter((task) => task.status === 'active')
    .map((task) => ({
      [t('tasks.titlePlaceholder')]: task.title,
      [t('tasks.descriptionLabel')]: task.description || '—',
      [t('tasks.projectLabel')]: task.projectId ? (projectsById[task.projectId]?.name || '—') : t('tasks.noProject'),
      [t('tasks.energyLabel')]: t(`tasks.energy${(task.energy || 'none').charAt(0).toUpperCase()}${(task.energy || 'none').slice(1)}`),
      [t('tasks.deadlineLabel')]: task.whenDate || '—',
      [t('tasks.tagsLabel')]: (task.tags || []).join(', ') || '—',
    }))
}

// Gathers export-ready data for a single section.
// Stage 1: sections have no data yet, so records is empty.
// Stage 2: once a section gets its own store, read its records here.
export function collectSectionData(section, t) {
  let records = []
  if (section.id === 'tasks') records = collectTasksRecords(t)

  return {
    id: section.id,
    title: t(section.titleKey),
    records,
  }
}
