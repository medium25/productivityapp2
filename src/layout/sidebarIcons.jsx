// Sidebar-only icons (picked by the user from a mockup): an outline plus a
// soft fill of the same colour inside the contour. They live here, not in
// icons/Icons.jsx, because the shared icons are also used on other screens
// (Tasks hub cards, the pomodoro button) that should keep their own look.
function Glyph({ className, size = 22, children }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

// Soft inner fill, no outline of its own (the outline is drawn separately).
const fillProps = { fill: 'currentColor', fillOpacity: 0.2, stroke: 'none' }
const dotProps = { fill: 'currentColor', stroke: 'none' }

// Мой день — sun
export function SideIconMyDay(props) {
  return (
    <Glyph {...props}>
      <circle {...fillProps} cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </Glyph>
  )
}

// Фокус — pomodoro timer
export function SideIconFocus(props) {
  return (
    <Glyph {...props}>
      <circle {...fillProps} cx="12" cy="13.5" r="7.5" />
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 10v4l2.6 1.5M9.5 3h5M12 3v3M19 6.5L17.5 8" />
    </Glyph>
  )
}

// Задачи — two stacked cards with a check
export function SideIconTasks(props) {
  return (
    <Glyph {...props}>
      <rect {...fillProps} x="4" y="8.5" width="12" height="12" rx="3" />
      <rect x="4" y="8.5" width="12" height="12" rx="3" />
      <path d="M7.7 14.8l2.2 2.2 3.8-4.2M8 8.5V6.5A2.5 2.5 0 0 1 10.5 4h7A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H16" />
    </Glyph>
  )
}

// Инсайты — light bulb
export function SideIconInsights(props) {
  return (
    <Glyph {...props}>
      <path {...fillProps} d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3zM9.5 19h5M10.5 21.5h3" />
    </Glyph>
  )
}

// Дневник — spiral notebook
export function SideIconDiary(props) {
  return (
    <Glyph {...props}>
      <rect {...fillProps} x="6.5" y="3.5" width="13" height="17" rx="2.5" />
      <rect x="6.5" y="3.5" width="13" height="17" rx="2.5" />
      <path d="M3.5 7.5h4M3.5 12h4M3.5 16.5h4M11 9h5M11 13h3" />
    </Glyph>
  )
}

// Привычки — sprout
export function SideIconHabits(props) {
  return (
    <Glyph {...props}>
      <path {...fillProps} d="M12 14c0-4.2 3-6.8 7.5-6.8 0 4.2-3 6.8-7.5 6.8z" />
      <path d="M12 21v-7M12 14c0-4.2 3-6.8 7.5-6.8 0 4.2-3 6.8-7.5 6.8zM12 16.5c0-3-2.5-5-6.5-5 0 3 2.5 5 6.5 5zM8 21h8" />
    </Glyph>
  )
}

// Спорт — kettlebell
export function SideIconSport(props) {
  return (
    <Glyph {...props}>
      <path {...fillProps} d="M7 20.5c-2-1-3.2-3-3-5.2.3-3 2.7-5.3 5.5-5.3h5c2.8 0 5.2 2.3 5.5 5.3.2 2.2-1 4.2-3 5.2z" />
      <path d="M7 20.5c-2-1-3.2-3-3-5.2.3-3 2.7-5.3 5.5-5.3h5c2.8 0 5.2 2.3 5.5 5.3.2 2.2-1 4.2-3 5.2zM9 10V8a3 3 0 0 1 6 0v2" />
    </Glyph>
  )
}

// Заметки — sticky note with a folded corner
export function SideIconNotes(props) {
  return (
    <Glyph {...props}>
      <path {...fillProps} d="M5.5 4h13A1.5 1.5 0 0 1 20 5.5V14l-6 6H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4z" />
      <path d="M5.5 4h13A1.5 1.5 0 0 1 20 5.5V14l-6 6H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4zM14 20v-4.5a1.5 1.5 0 0 1 1.5-1.5H20M8 9h8M8 12.5h4" />
    </Glyph>
  )
}

// Настройки — gear
export function SideIconSettings(props) {
  return (
    <Glyph {...props}>
      <path {...fillProps} d="M10.3 3.5h3.4l.5 2.3 1.6.9 2.2-.8 1.7 3-1.7 1.6v1.8l1.7 1.6-1.7 3-2.2-.8-1.6.9-.5 2.3h-3.4l-.5-2.3-1.6-.9-2.2.8-1.7-3 1.7-1.6v-1.8L4.3 9.4l1.7-3 2.2.8 1.6-.9z" />
      <path d="M10.3 3.5h3.4l.5 2.3 1.6.9 2.2-.8 1.7 3-1.7 1.6v1.8l1.7 1.6-1.7 3-2.2-.8-1.6.9-.5 2.3h-3.4l-.5-2.3-1.6-.9-2.2.8-1.7-3 1.7-1.6v-1.8L4.3 9.4l1.7-3 2.2.8 1.6-.9z" />
      <circle cx="12" cy="12" r="2.8" />
    </Glyph>
  )
}

// Знания — open book (used on the Данные hub card)
export function SideIconBook(props) {
  return (
    <Glyph {...props}>
      <path {...fillProps} d="M12 6c-2.2-1.5-5-2-8-1.6v13c3-.4 5.8.1 8 1.6 2.2-1.5 5-2 8-1.6v-13c-3-.4-5.8.1-8 1.6z" />
      <path d="M12 6c-2.2-1.5-5-2-8-1.6v13c3-.4 5.8.1 8 1.6 2.2-1.5 5-2 8-1.6v-13c-3-.4-5.8.1-8 1.6zM12 6v13" />
    </Glyph>
  )
}

export const SIDEBAR_ICONS = {
  myDay: SideIconMyDay,
  myFocus: SideIconFocus,
  upcoming: SideIconTasks,
  insights: SideIconInsights,
  principles: SideIconDiary,
  habits: SideIconHabits,
  sport: SideIconSport,
  qaydlar: SideIconNotes,
}
