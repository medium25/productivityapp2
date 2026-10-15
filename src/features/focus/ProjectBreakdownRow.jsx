import { useTranslation } from 'react-i18next'
import { formatDuration } from './timeFormat'

export default function ProjectBreakdownRow({ project, seconds, sessions, metric = 'duration' }) {
  const { t } = useTranslation()
  const value = metric === 'sessions' ? t('focus.cyclesCount', { count: sessions || 0 }) : formatDuration(seconds || 0, t)
  return (
    <div className="project-breakdown__row" style={{ '--chip-color': project?.color || 'var(--text-muted)' }}>
      <span className="project-breakdown__name">
        <span className="project-row__dot" />
        {project ? project.name : t('focus.deletedProject')}
        {project?.completed && <span className="project-breakdown__tag">{t('focus.completedTag')}</span>}
      </span>
      <span className="project-breakdown__value">{value}</span>
    </div>
  )
}
