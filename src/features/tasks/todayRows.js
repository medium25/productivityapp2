import { isoFromDate } from './taskLogic'
import { isHabitTask } from './habitTaskSync'
import { groupProjectRows } from './projectParent'

const isRecurring = (task) => !!task.recurrence && task.recurrence !== 'none'

// The tasks of «Мой день» for `today`, in the order the page shows them. Shared by the page
// itself and by «Привычки», which mirrors that list.
export function buildTodayRows(tasks, projects, today) {
  const todayList = []
  // A project task is scheduled only once it's on that project's map.
  const onMap = new Set(projects.flatMap((p) => p.flow || []))
  tasks.forEach((task) => {
    if (task.projectId && !onMap.has(task.id)) return
    // Done tasks stay until the day rolls over: only those completed today remain visible.
    if (task.status === 'done') {
      if (!task.completedAt || isoFromDate(new Date(task.completedAt)) !== today) return
    } else if (task.status !== 'active') return
    const iso = task.deadline || task.whenDate
    if (!iso) return
    if (iso === today) {
      todayList.push(task)
    } else if (iso < today && !isRecurring(task)) {
      // A one-step task stays in Today day after day until it is done or deleted.
      todayList.push(task)
    }
  })
  // Repeating tasks first, then the one-step ones; tasks just sent over from «Задачи»
  // (dayRank) go to the end, oldest first, until the list is reordered by hand.
  const oneStep = todayList.filter((task) => !isRecurring(task))
  // Rows of a project made from a task stay together: the parent row, then its tasks.
  return groupProjectRows([
    ...todayList.filter(isRecurring),
    ...oneStep.filter((task) => task.dayRank == null),
    ...oneStep.filter((task) => task.dayRank != null).sort((a, b) => a.dayRank - b.dayRank),
  ], projects)
}

// «Привычки» shows (1) the habits whose task is in «Мой день» today, in that list's order, then
// (2) the habits made in the «Привычки» section itself. A habit that came from a «Мой день» task
// and isn't in today's list stays hidden. A habit made in the section itself always goes in the
// second group, even though it also puts a task into «Мой день». Habits with no origin (old ones)
// join the first group when their task is in the list, otherwise they count as the section's own.
export function splitHabits(habits, todayRows) {
  const used = new Set()
  const linked = []
  const rowIndex = new Map() // habit id → its task's position in «Мой день» (drives the shared row colour)
  todayRows.forEach((task, idx) => {
    if (!isHabitTask(task)) return
    const habit = habits.find((h) => h.origin !== 'habits' && h.title === task.title && !used.has(h.id))
    if (habit) { used.add(habit.id); linked.push(habit); rowIndex.set(habit.id, idx) }
  })
  const own = habits.filter((h) => !used.has(h.id) && h.origin !== 'myday')
  return { linked, own, rowIndex }
}
