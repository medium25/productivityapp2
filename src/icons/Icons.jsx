const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ size = 20, children, ...props }) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      {children}
    </svg>
  )
}

export function IconFocus(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.6" />
    </Svg>
  )
}

export function IconInboxTray(props) {
  return (
    <Svg {...props}>
      <path d="M4 12.5h4.2l1.6 2.5h4.4l1.6-2.5H20" />
      <path d="M5.5 6.5A1.5 1.5 0 0 1 7 5h10a1.5 1.5 0 0 1 1.5 1.5l0.5 6.5v4A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5v-4Z" />
    </Svg>
  )
}

export function IconStar(props) {
  return (
    <Svg {...props} fill="currentColor" stroke="currentColor" strokeWidth={1}>
      <path d="M12 3.2l2.7 5.7 6.1.7-4.5 4.2 1.2 6.1L12 16.9l-5.5 3 1.2-6.1-4.5-4.2 6.1-.7z" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconChevronsRight(props) {
  return (
    <Svg {...props}>
      <path d="M8 5l6.5 7L8 19" />
      <path d="M13.5 5L20 12l-6.5 7" />
    </Svg>
  )
}

export function IconSomeday(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </Svg>
  )
}

export function IconTasks(props) {
  return (
    <Svg {...props}>
      <path d="M4.5 6l1.2 1.2L8 4.8" />
      <path d="M11 6h9" />
      <path d="M4.5 12l1.2 1.2L8 10.8" />
      <path d="M11 12h9" />
      <path d="M4.5 18l1.2 1.2L8 16.8" />
      <path d="M11 18h9" />
    </Svg>
  )
}

export function IconThoughts(props) {
  return (
    <Svg {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H10l-4 4v-4H6.5A2.5 2.5 0 0 1 4 12.5v-7Z" />
    </Svg>
  )
}

export function IconHabits(props) {
  return (
    <Svg {...props}>
      <path d="M17 2l4 4-4 4" />
      <path d="M21 6H8a5 5 0 0 0-5 5v1" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M3 18h13a5 5 0 0 0 5-5v-1" />
    </Svg>
  )
}

export function IconFitness(props) {
  return (
    <Svg {...props}>
      <path d="M4 10v4" />
      <path d="M20 10v4" />
      <path d="M6.5 7v10" />
      <path d="M17.5 7v10" />
      <path d="M6.5 12h11" />
    </Svg>
  )
}

export function IconFinance(props) {
  return (
    <Svg {...props}>
      <path d="M4 15l5-5 4 4 7-8" />
      <path d="M15 6h5v5" />
    </Svg>
  )
}

export function IconPalette(props) {
  return (
    <Svg {...props}>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-.8.7-1.5 1.5-1.5H16a4 4 0 0 0 4-4c0-4.4-3.6-8-8-8Z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconSettings(props) {
  return (
    <Svg {...props}>
      <path d="M4 6h9" />
      <circle cx="16" cy="6" r="2" />
      <path d="M4 12h3" />
      <circle cx="10" cy="12" r="2" />
      <path d="M13 12h7" />
      <path d="M4 18h9" />
      <circle cx="16" cy="18" r="2" />
    </Svg>
  )
}

export function IconExport(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v11" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4.5 19h15" />
    </Svg>
  )
}

export function IconSun(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.55 1.55M17.85 17.85l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.55-1.55M17.85 6.15l1.55-1.55" />
    </Svg>
  )
}

export function IconMoon(props) {
  return (
    <Svg {...props}>
      <path d="M20 14.2A8 8 0 1 1 9.8 4a6.4 6.4 0 0 0 10.2 10.2Z" />
    </Svg>
  )
}

export function IconMonitor(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16.5v3.5" />
    </Svg>
  )
}

export function IconBack(props) {
  return (
    <Svg {...props}>
      <path d="M14.5 5L7.5 12l7 7" />
    </Svg>
  )
}

export function IconFolder(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h3.5l1.8 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5Z" />
    </Svg>
  )
}

export function IconTags(props) {
  return (
    <Svg {...props}>
      <path d="M11.7 3.5h5.3a1.5 1.5 0 0 1 1.5 1.5v5.3a1.5 1.5 0 0 1-.44 1.06l-8 8a1.5 1.5 0 0 1-2.12 0l-5.3-5.3a1.5 1.5 0 0 1 0-2.12l8-8a1.5 1.5 0 0 1 1.06-.44Z" />
      <circle cx="15" cy="8" r="1.3" />
    </Svg>
  )
}

export function IconClock(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v4.8l3.2 1.9" />
    </Svg>
  )
}

export function IconBarChart(props) {
  return (
    <Svg {...props}>
      <path d="M5 19V11" />
      <path d="M12 19V5" />
      <path d="M19 19v-7" />
    </Svg>
  )
}

export function IconFlag(props) {
  return (
    <Svg {...props}>
      <path d="M6 3.5v17" />
      <path d="M6 4.5h9.5l-2 3.5 2 3.5H6" />
    </Svg>
  )
}

export function IconRepeat(props) {
  return (
    <Svg {...props}>
      <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5" />
      <path d="M20 4.5v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.66 5.66L4 15.5" />
      <path d="M4 19.5v-4h4" />
    </Svg>
  )
}

export function IconCalendar(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v4M16 3v4" />
    </Svg>
  )
}

export function IconArchive(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.2" />
      <path d="M4.5 9v8.5A1.5 1.5 0 0 0 6 19h12a1.5 1.5 0 0 0 1.5-1.5V9" />
      <path d="M10 13h4" />
    </Svg>
  )
}

export function IconCheckCircle(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.3l2.3 2.3 4.7-4.9" />
    </Svg>
  )
}

export function IconTrash(props) {
  return (
    <Svg {...props}>
      <path d="M5 7h14" />
      <path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
      <path d="M7 7l1 12.5A1.5 1.5 0 0 0 9.5 21h5a1.5 1.5 0 0 0 1.5-1.5L17 7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  )
}

export function IconChevronDown(props) {
  return (
    <Svg {...props}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  )
}

// Full shaft-and-head arrow, not just a chevron — see UpcomingPage.jsx's
// task-card lane-move buttons ("move to next/prev lane" reads more like
// an actual move than a mere "expand/more" chevron would), mirrored via
// CSS transform for the "previous lane" direction.
export function IconArrowRight(props) {
  return (
    <Svg {...props}>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </Svg>
  )
}

// Comment/notes button (see UpcomingPage.jsx's task-card toolbar) — opens
// the task's own edit form, same place its description field already
// lives; not a separate threaded-comments feature.
export function IconMessageCircle(props) {
  return (
    <Svg {...props}>
      <path d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1.3-3.5A7.96 7.96 0 0 1 4 12z" />
    </Svg>
  )
}

export function IconMenu(props) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  )
}

export function IconSidebar(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
    </Svg>
  )
}

export function IconUserPlus(props) {
  return (
    <Svg {...props}>
      <circle cx="9.5" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M18.5 8.5v5M16 11h5" />
    </Svg>
  )
}

export function IconPencil(props) {
  return (
    <Svg {...props}>
      <path d="M15.5 4.5l4 4L8 20H4v-4z" />
      <path d="M13.5 6.5l4 4" />
    </Svg>
  )
}

export function IconCopy(props) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </Svg>
  )
}

export function IconPip(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="14" rx="2" />
      <rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconGrip(props) {
  return (
    <Svg {...props} strokeWidth={0} fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </Svg>
  )
}

export function IconMoreVertical(props) {
  return (
    <Svg {...props} strokeWidth={0} fill="currentColor">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </Svg>
  )
}

export function IconMoreHorizontal(props) {
  return (
    <Svg {...props} strokeWidth={0} fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </Svg>
  )
}

export function IconRewind10(props) {
  return (
    <Svg {...props}>
      <path d="M12 5a7 7 0 1 1-6.32 4" />
      <path d="M5 3.5V9h5.5" />
    </Svg>
  )
}

export function IconForward10(props) {
  return (
    <Svg {...props}>
      <path d="M12 5a7 7 0 1 0 6.32 4" />
      <path d="M19 3.5V9h-5.5" />
    </Svg>
  )
}

export function IconInfo(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth={2.4} />
    </Svg>
  )
}

export function IconPaperclip(props) {
  return (
    <Svg {...props}>
      <path d="M17.5 8.5 9.9 16.1a3 3 0 1 1-4.24-4.24l8.49-8.49a4.5 4.5 0 1 1 6.36 6.36l-8.5 8.49a2 2 0 1 1-2.82-2.83l7.07-7.07" />
    </Svg>
  )
}

export function IconMic(props) {
  return (
    <Svg {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8.5 21h7" />
    </Svg>
  )
}

// Filled (not outline) like most play/pause glyphs — overrides the shared
// outline defaults via props, see VoicePlayer.jsx.
export function IconPlay(props) {
  return (
    <Svg fill="currentColor" stroke="none" {...props}>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
    </Svg>
  )
}

export function IconPause(props) {
  return (
    <Svg fill="currentColor" stroke="none" {...props}>
      <rect x="6.5" y="5" width="4" height="14" rx="1" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" />
    </Svg>
  )
}

// "All done" empty-state centerpiece (see EmptyStateCelebration.jsx) — a
// checkmark with a couple sparkle accents, drawn in the app's own line-icon
// style instead of a 🎉/🎆 emoji sticker, per user request ("не стикер, а
// что-то красивое и логичное").
export function IconAllDone(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M8.7 13.2l2.1 2.1 4.3-4.5" />
      <path d="M18.5 3.5l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9z" />
      <path d="M4.2 5.5v2.2M3.1 6.6h2.2" />
    </Svg>
  )
}

// Habit streak indicator (see HabitsPage.jsx) — a line-style flame instead
// of the 🔥 emoji, per user request, so it matches the rest of the app's
// icon set instead of clashing with it.
// "База знаний" nav icon (see sections.js) — an open book, distinct from
// Insights' speech-bubble so the two read as different kinds of content
// (chronological capture vs. a written reference).
export function IconBook(props) {
  return (
    <Svg {...props}>
      <path d="M12 5.5c-1.6-1.2-3.6-1.8-6-1.8v14c2.4 0 4.4.6 6 1.8" />
      <path d="M12 5.5c1.6-1.2 3.6-1.8 6-1.8v14c-2.4 0-4.4.6-6 1.8z" />
      <path d="M12 5.5v13.8" />
    </Svg>
  )
}

export function IconFlame(props) {
  return (
    <Svg {...props}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  )
}

export function IconDumbbell(props) {
  return (
    <Svg {...props}>
      <path d="M6 9v6M4 10.5v3M20 9v6M18.5 10.5v3M8 12h8" />
    </Svg>
  )
}

// A small index card with a headline + two lines of body text — Qaydlar's
// nav icon, distinct from IconBook (used elsewhere for longer reading).
export function IconNoteCard(props) {
  return (
    <Svg {...props}>
      <rect x="4" y="4.5" width="16" height="15" rx="2.2" />
      <path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h5.5" />
    </Svg>
  )
}

// A drawing-pin / pushpin — used for the pin/unpin toggle on a Qaydlar card.
export function IconPin(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v4.2M9 7.2h6l1.2 4.6-3 1.7V17l-.7 3-.7-3v-3.5l-3-1.7z" />
    </Svg>
  )
}

// A wallet — Finance's nav icon.
export function IconWallet(props) {
  return (
    <Svg {...props}>
      <path d="M4 7.5a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v2" />
      <rect x="4" y="7.5" width="16" height="11" rx="2" />
      <circle cx="16" cy="13" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconClose(props) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  )
}

export function IconImage(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4.5 17l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4" />
    </Svg>
  )
}
