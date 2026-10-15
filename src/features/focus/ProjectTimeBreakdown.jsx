import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusHistoryStore, dateKey } from '../../store/useFocusHistoryStore'
import { useFocusStore } from '../../store/useFocusStore'
import { getRangeDates } from './dateRanges'
import SegmentedControl from '../../layout/SegmentedControl'
import ProjectBreakdownRow from './ProjectBreakdownRow'
import ProjectPieChart from './ProjectPieChart'

export default function ProjectTimeBreakdown() {
  const { t } = useTranslation()
  const byProject = useFocusHistoryStore((s) => s.byProject)
  const cyclesByDate = useFocusHistoryStore((s) => s.cyclesByDate)
  const projects = useFocusStore((s) => s.projects)
  const [range, setRange] = useState('week')
  const [metric, setMetric] = useState('duration') // duration | sessions

  const rows = useMemo(() => {
    const source = metric === 'sessions' ? cyclesByDate : byProject
    const totals = {}
    getRangeDates(range).forEach((d) => {
      const dayData = source[dateKey(d)]
      if (!dayData) return
      Object.entries(dayData).forEach(([projectId, value]) => {
        totals[projectId] = (totals[projectId] || 0) + value
      })
    })
    return Object.entries(totals)
      .map(([projectId, value]) => ({ projectId, value, project: projects.find((p) => p.id === projectId) }))
      .sort((a, b) => b.value - a.value)
  }, [range, metric, byProject, cyclesByDate, projects])

  const items = [
    { value: 'day', content: t('focus.today') },
    { value: 'week', content: t('focus.thisWeek') },
    { value: 'month', content: t('focus.thisMonth') },
    { value: 'year', content: t('focus.thisYear') },
  ]

  const metricItems = [
    { value: 'duration', content: t('focus.metricDuration') },
    { value: 'sessions', content: t('focus.metricSessions') },
  ]

  return (
    <div className="project-breakdown">
      <div className="project-breakdown__header">
        <h2 className="focus-stats__heading">{t('focus.timeByProject')}</h2>
        <SegmentedControl items={items} value={range} onChange={setRange} ariaLabel={t('focus.timeByProject')} />
      </div>
      <div className="project-breakdown__metric-toggle">
        <SegmentedControl
          items={metricItems}
          value={metric}
          onChange={setMetric}
          ariaLabel={t('focus.metricToggleLabel')}
        />
      </div>
      {rows.length === 0 ? (
        <p className="settings-hint">{t('focus.noDataForRange')}</p>
      ) : (
        <>
          <ProjectPieChart rows={rows} total={rows.reduce((sum, row) => sum + row.value, 0)} metric={metric} />
          <div className="project-breakdown__list">
            {rows.map((row) => (
              <ProjectBreakdownRow
                key={row.projectId}
                project={row.project}
                metric={metric}
                seconds={metric === 'duration' ? row.value : 0}
                sessions={metric === 'sessions' ? row.value : 0}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
