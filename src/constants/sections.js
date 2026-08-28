// Configuration for the 6 top-level sections ("miry") of the app.
// `labelKey` is a react-i18next translation key (see src/i18n/*.json,
// `sections.*`) — resolve it with `t(section.labelKey)` wherever a section's
// display name is needed.
export const SECTIONS = [
  {
    id: 'focus',
    path: '/',
    labelKey: 'sections.focus',
  },
  {
    id: 'tasks',
    path: '/tasks',
    labelKey: 'sections.tasks',
  },
  {
    id: 'thoughts',
    path: '/thoughts',
    labelKey: 'sections.thoughts',
  },
  {
    id: 'habits',
    path: '/habits',
    labelKey: 'sections.habits',
  },
  {
    id: 'fitness',
    path: '/fitness',
    labelKey: 'sections.fitness',
  },
  {
    id: 'finance',
    path: '/finance',
    labelKey: 'sections.finance',
  },
]

export default SECTIONS
