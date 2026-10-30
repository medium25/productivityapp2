import { getProjectColor } from './taskLogic'

// «Превратить в проект»: the task keeps its place in the list as the project's parent row
// (task.parentOfProject = project id, project.parentTaskId = task id). Its tasks (projectId) share
// the project's colour and are joined to it by a line; the parent can only be checked off once all
// of them are done.

// Bright shade of a project colour for dark rows: same perceived lightness for every hue
// (OKLCH), so green never looks brighter than red; yellows get a touch more.
export function brightTagColor(hex) {
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
  if (Math.hypot(A, B) < 0.04) return 'oklch(0.75 0.02 250)'
  const hue = Math.round(((Math.atan2(B, A) * 180) / Math.PI + 360) % 360)
  const light = hue > 80 && hue < 110 ? 0.78 : 0.75
  return `oklch(${light} 0.16 ${hue})`
}

// Row colours of a project's rows, same shape as ROW_PALETTE entries.
export function projectRowColors(project) {
  const base = getProjectColor(project)
  return {
    bg: `color-mix(in srgb, ${base} 14%, #ffffff)`,
    border: base,
    text: `color-mix(in srgb, ${base} 70%, #000000)`,
    hue: brightTagColor(base),
    line: base,
  }
}

// What a task is in relation to a «project from a task»: its parent row, one of its tasks, or neither.
export function projectRole(task, tasks, projects) {
  if (task.parentOfProject) {
    const project = projects.find((p) => p.id === task.parentOfProject)
    if (!project) return null
    const kids = tasks.filter((x) => x.projectId === project.id && x.status !== 'trashed' && x.id !== task.id)
    const done = kids.filter((x) => x.status === 'done').length
    const ready = kids.length > 0 && done === kids.length
    return { kind: 'parent', project, done, total: kids.length, ready, locked: task.status !== 'done' && !ready }
  }
  if (task.projectId) {
    const project = projects.find((p) => p.id === task.projectId)
    if (project?.parentTaskId) return { kind: 'child', project }
  }
  return null
}

const groupKey = (task, projectIds) => {
  if (task.parentOfProject && projectIds.has(task.parentOfProject)) return task.parentOfProject
  if (task.projectId && projectIds.has(task.projectId)) return task.projectId
  return null
}

// Puts each project's rows together: the parent first, then its tasks (in the list's order).
export function groupProjectRows(rows, projects) {
  const projectIds = new Set(projects.filter((p) => p.parentTaskId).map((p) => p.id))
  if (projectIds.size === 0) return rows
  const parents = new Map() // project id -> parent row present in this list
  rows.forEach((r) => { if (r.parentOfProject && projectIds.has(r.parentOfProject)) parents.set(r.parentOfProject, r) })
  const kids = new Map()
  rows.forEach((r) => {
    if (r.projectId && projectIds.has(r.projectId) && parents.has(r.projectId)) {
      kids.set(r.projectId, [...(kids.get(r.projectId) || []), r])
    }
  })
  const out = []
  rows.forEach((r) => {
    if (r.projectId && projectIds.has(r.projectId) && parents.has(r.projectId)) return // placed behind its parent
    out.push(r)
    if (r.parentOfProject && projectIds.has(r.parentOfProject)) (kids.get(r.parentOfProject) || []).forEach((k) => out.push(k))
  })
  return out
}

// Which neighbours of each row belong to the same project (for the connecting line).
export function projectLinks(rows, projects) {
  const projectIds = new Set(projects.filter((p) => p.parentTaskId).map((p) => p.id))
  const keys = rows.map((r) => groupKey(r, projectIds))
  return rows.map((_, i) => ({
    prev: !!keys[i] && keys[i - 1] === keys[i],
    next: !!keys[i] && keys[i + 1] === keys[i],
  }))
}
