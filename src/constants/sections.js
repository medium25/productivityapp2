import { IconFocus, IconInboxTray, IconSomeday, IconThoughts, IconFlame, IconBarChart, IconStar, IconClock, IconDumbbell, IconNoteCard, IconWallet, IconCheckCircle } from '../icons/Icons'

// Intentionally just these two — the other four ("Мысли", "Привычки",
// "Фитнес", "Финансовый учёт") were never built beyond a placeholder page,
// and the user decided a multi-section app was more overhead than value.
// Their page files/routes were removed; re-add here + restore the deleted
// pages under src/pages/ if one of them gets picked up again later.
export const SECTIONS = [
  // A duplicate of the "tasks" section — same underlying store/data — just
  // a second, separately-named entry point into it, per user request.
  // Ordered before "tasks" per user request (sidebar order = array order).
  { id: 'inbox', route: '/inbox', Icon: IconInboxTray, titleKey: 'sections.inbox.title', descKey: 'sections.inbox.description' },
  // Insights used to be a column embedded on the Inbox page — split into
  // its own top-level section per user request, grouped with Inbox
  // (CAPTURE_IDS in Sidebar.jsx) rather than with the Actions group, since
  // both are "capture" entry points, not scheduling views.
  { id: 'insights', route: '/insights', Icon: IconThoughts, titleKey: 'sections.insights.title', descKey: 'sections.insights.description' },
  // Same card-notes shape as База знаний/Справочная информация, its own
  // store/section per user request — sits between the two.
  { id: 'principles', route: '/principles', Icon: IconStar, titleKey: 'sections.principles.title', descKey: 'sections.principles.description' },
  // Same card-notes shape as База знаний, separate store/section per user
  // request (facts/numbers to look up, not learnings to internalize).
  { id: 'referenceInfo', route: '/reference-info', Icon: IconBarChart, titleKey: 'sections.referenceInfo.title', descKey: 'sections.referenceInfo.description' },
  // Every open task in one list, drawn like «Мой день» rows but with a project pill
  // and a «Мой день» button instead of times (see TasksListPage.jsx). Sits between
  // Входящие and Мой день in the sidebar.
  { id: 'tasksList', route: '/tasks', Icon: IconCheckCircle, titleKey: 'sections.tasksList.title', descKey: 'sections.tasksList.description' },
  // The old single "Action" section (My day/Upcoming/Sometime/For Anki as
  // columns of one board, see former TasksGoalsPage.jsx) split into 3
  // separate top-level sections per user request; the "My day"/"Next"
  // section (today's tasks) was later merged back into Upcoming per user
  // request, so Upcoming's own bucketTasks (see ActionColumnBoard.jsx) now
  // covers both today's and future tasks.
  // A separate list from Tasks/Wishes — a habit repeats forever and tracks
  // a per-day done map (see useHabitsStore.js), not a single status, so it
  // doesn't fit the whenDate-based task model at all. Styled to match a
  // reference screenshot exactly per user request (see HabitsPage.jsx).
  // Ordered under Data/Tasks per user request (sidebar order = array order).
  // Today's list as its own sidebar button (it is also still a card on the Tasks hub).
  { id: 'myDay', route: '/upcoming/today', Icon: IconClock, titleKey: 'sections.myDay.title', descKey: 'sections.myDay.description' },
  { id: 'habits', route: '/habits', Icon: IconFlame, titleKey: 'sections.habits.title', descKey: 'sections.habits.description' },
  { id: 'sometime', route: '/sometime', Icon: IconSomeday, titleKey: 'sections.sometime.title', descKey: 'sections.sometime.description' },
  // A proper SECTIONS entry (not a special-cased sidebar widget) per user
  // request — "Projects" now behaves exactly like every other top-level
  // section (renamable, toggleable from Settings, same row styling). The
  // live list of the user's actual projects still renders right under it
  // (see Sidebar.jsx) as plain, always-visible sub-rows — no collapse
  // toggle anymore, and each one doubles as a drag-and-drop target for
  // assigning a task to that project from any task list in the app.
  // Moved back down next to Settings per user request, and back to a plain
  // icon ("без звездочек") instead of the colored star — Result &
  // Statistics reads as a utility page, not a nav highlight.
  { id: 'focus', route: '/focus', Icon: IconFocus, titleKey: 'sections.focus.title', descKey: 'sections.focus.description' },
  // The project-picker timer + Apple Screen-Time-style weekly chart (see
  // docs/superpowers/specs/2026-08-12-my-focus-activity-design.md) — a
  // separate entry from "Focus" above, not a replacement; that page's own
  // heatmap/streaks/rank content is unchanged.
  { id: 'myFocus', route: '/my-focus', Icon: IconClock, titleKey: 'sections.myFocus.title', descKey: 'sections.myFocus.description' },
  // Weekly workout schedule + per-exercise progression log, per user
  // request — see docs/superpowers/specs/2026-08-28-sport-tracker-design.md.
  { id: 'sport', route: '/sport', Icon: IconDumbbell, titleKey: 'sections.sport.title', descKey: 'sections.sport.description' },
  // Small pinnable title+text reference cards, per user request — a grid
  // (5-8 per row), not a chat feed like Data/Insights/Analysis. See
  // useQaydlarStore.js/QaydlarPage.jsx.
  { id: 'qaydlar', route: '/qaydlar', Icon: IconNoteCard, titleKey: 'sections.qaydlar.title', descKey: 'sections.qaydlar.description' },
  // Replaces the user's manual monthly Numbers-file budget tracking — see
  // docs/superpowers/specs/2026-10-05-finance-section-design.md.
  // Mikhail Tokovinin's channel as a reader with progress (see TokovininPage).
  { id: 'tokovinin', route: '/tokovinin', Icon: IconStar, titleKey: 'sections.tokovinin.title', descKey: 'sections.tokovinin.description' },
  { id: 'finance', route: '/finance', Icon: IconWallet, titleKey: 'sections.finance.title', descKey: 'sections.finance.description' },
]

export const DEFAULT_ENABLED_SECTIONS = SECTIONS.reduce((acc, s) => {
  acc[s.id] = true
  return acc
}, {})

// "focus" used to default to one of these before the Result & Statistics
// rename — an account that never actually renamed the section by hand can
// still have one of these saved as its override (the rename UI applies to
// any section, built-in or not, so even re-saving the same default text
// counts as a "custom" name). Treated as stale below so the new title
// actually takes effect instead of being silently shadowed forever.
const STALE_FOCUS_DEFAULTS = ['Фокус', 'Focus', 'Fokus']

// Same for "qaydlar": it was called "Заметки" before it became the "Данные"
// section holding Заметки and Знания.
const STALE_QAYDLAR_DEFAULTS = ['Заметки', 'Notes', 'Qaydlar']

// A user-set custom name (see useSettingsStore's sectionNameOverrides) wins
// over the built-in translated title — lets any section, not just the
// user-created duplicates, be renamed from the sidebar.
export function getSectionTitle(section, overrides, t) {
  const override = overrides?.[section.id]
  if (override && section.id === 'focus' && STALE_FOCUS_DEFAULTS.includes(override)) return t(section.titleKey)
  if (override && section.id === 'qaydlar' && STALE_QAYDLAR_DEFAULTS.includes(override)) return t(section.titleKey)
  return override || t(section.titleKey)
}
