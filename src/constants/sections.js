// Configuration for the 6 top-level sections ("miry") of the app.
// `label` is a plain Russian string for now — task T3 (i18n) will replace
// this with translation keys resolved via react-i18next.
export const SECTIONS = [
  {
    id: 'focus',
    path: '/',
    label: 'Фокус',
  },
  {
    id: 'tasks',
    path: '/tasks',
    label: 'Задачи и цели',
  },
  {
    id: 'thoughts',
    path: '/thoughts',
    label: 'Мысли',
  },
  {
    id: 'habits',
    path: '/habits',
    label: 'Привычки',
  },
  {
    id: 'fitness',
    path: '/fitness',
    label: 'Фитнес',
  },
  {
    id: 'finance',
    path: '/finance',
    label: 'Финансовый учёт',
  },
]

export default SECTIONS
