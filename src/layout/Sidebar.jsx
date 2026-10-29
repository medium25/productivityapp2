import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SECTIONS, getSectionTitle } from '../constants/sections'
import { useSettingsStore } from '../store/useSettingsStore'
import { useCustomSectionsStore } from '../store/useCustomSectionsStore'
import { useDragReorder } from '../features/tasks/useDragReorder'
import { IconTasks } from '../icons/Icons'
import { SIDEBAR_ICONS, SideIconSettings } from './sidebarIcons'


// Which built-in SECTIONS ids render in the sidebar — per user request,
// Inbox no longer has a row here at all (still reachable from the Tasks
// hub, and its /inbox route still works — just no sidebar link). "projects"
// isn't in here either — it's not a sidebar destination at all anymore (per
// earlier user request: only reachable from the Tasks hub's own Projects
// card now — see UpcomingPage.jsx).
const ACTIONS_IDS = ['referenceInfo', 'tasksList', 'myDay', 'habits', 'tokovinin']

// Which sections a task can be dragged onto to move it there (see
// useDragReorder.js's onCrossDropSection, taskLogic.js's
// patchForSectionMove) — per user request, any task should be draggable
// into any of these from anywhere in the app. Insights/Focus/Settings/etc.
// aren't task buckets, so they're not drop targets.
const DRAG_TARGET_SECTION_IDS = ['inbox', 'sometime']

// Per-item icon color per user request ("иконки сделать точно такими как
// на фото") — the reference keeps each nav icon its own fixed color
// (blue chevrons, green calendar, pink someday) rather than the flat
// currentColor every other icon in the app uses, so this is scoped to just
// these ids instead of a global icon-color change. Focus/Result &
// Statistics deliberately isn't in here anymore ("без звездочек" per user
// request) — it now sits with Settings using the same plain muted icon.
const SECTION_ICON_CLASS = {
  upcoming: 'sidebar__icon--scheduled',
  sometime: 'sidebar__icon--someday',
  // Habits keeps its icon a fixed color regardless of active/inactive state
  // (per user request) — every other nav icon goes gray when not the
  // current route; this one shouldn't. Orange to match the flame shape
  // (see IconFlame in sections.js) picked for it per later user request.
  habits: 'sidebar__icon--flame',
  // Per user request ("окрась иконки 2 нижних разделов в цвета") — same
  // fixed-color pattern as upcoming/sometime above.
  principles: 'sidebar__icon--principles',
  referenceInfo: 'sidebar__icon--reference',
  insights: 'sidebar__icon--insights',
  myFocus: 'sidebar__icon--myfocus',
}

// Each top-level section has its own colour for the round icon (per user
// pick, variant E) — the active row fills the circle with it.
const SECTION_HUE = {
  myFocus: '#5b8def',
  referenceInfo: '#e0564a',
  tokovinin: '#6c7bd6',
  myDay: '#f0a23a',
  tasksList: '#3d8bff',
  insights: '#e56fa8',
  principles: '#e8a93a',
  habits: '#ee7b52',
  sport: '#3fbf86',
  finance: '#35b6c9',
  qaydlar: '#9aa3b5',
  settings: '#9aa3b5',
}

// Any nav section — built-in (Focus/Action) or a user-created duplicate —
// renders through here so both get the same double-click-to-rename UX.
// `onDelete` is only passed for user-created duplicates; built-in sections
// have no delete affordance, only rename.
function RenamableNavLink({ to, Icon, iconClassName, hue, name, onRename, onDelete, renameHint, count, countAlert, countCornerNeutral, trailing, dropNewProject, dropSectionKey, dragHandleProps, dragging }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const startEditing = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setValue(name)
    setEditing(true)
  }

  const save = () => {
    onRename(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="sidebar__link sidebar__link--editing">
        <Icon className={'sidebar__icon' + (iconClassName ? ` ${iconClassName}` : '')} />
        <input
          ref={inputRef}
          type="text"
          className="sidebar__custom-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={save}
          maxLength={30}
          autoFocus
        />
      </div>
    )
  }

  return (
    <div
      className={'sidebar__custom-row' + (dragging ? ' task-card-reorder--dragging' : '')}
      {...dragHandleProps}
    >
      <NavLink
        to={to}
        className={({ isActive }) => 'sidebar__link' + (hue ? ' sidebar__link--hue' : '') + (isActive ? ' active' : '')}
        style={hue ? { '--h': hue } : undefined}
        onDoubleClick={startEditing}
        title={renameHint}
        {...(dropNewProject ? { 'data-drop-new-project': 'true' } : null)}
        {...(dropSectionKey ? { 'data-drop-section': dropSectionKey } : null)}
      >
        {hue
          ? <span className="sidebar__ic"><Icon className={'sidebar__icon' + (iconClassName ? ` ${iconClassName}` : '')} /></span>
          : <Icon className={'sidebar__icon' + (iconClassName ? ` ${iconClassName}` : '')} />}
        <span className="sidebar__label">{name}</span>
        {count > 0 && !countAlert && !countCornerNeutral && <span className="sidebar__count">{count}</span>}
        {/* Notification-style badge pinned to the row's own top-right corner
            (per user request) instead of an inline pill — only for the
            "alert" counts (Inbox/Insights/Projects/Habits/Tasks); everything
            else keeps the plain inline pill above. Anchors to
            .sidebar__custom-row (nearest positioned ancestor), not this
            link, so it sits at the far right regardless of where in the row
            it's declared. Always rendered (not just when count > 0) — an
            empty section turns it green with a checkmark instead of hiding
            it, per user request. */}
        {countAlert && (
          count > 0
            ? <span className="sidebar__count-badge">{count > 99 ? '99+' : count}</span>
            : <span className="sidebar__count-badge sidebar__count-badge--clear">✓</span>
        )}
        {/* Same corner spot, but plain grey and only shown when nonzero — no
            red/green swap (per user request — Wishes, unlike the alert
            ones, isn't "waiting on you"). */}
        {countCornerNeutral && count > 0 && (
          <span className="sidebar__count-badge sidebar__count-badge--neutral">{count > 99 ? '99+' : count}</span>
        )}
      </NavLink>
      {trailing}
      {onDelete && (
        confirmingDelete ? (
          <span className="sidebar__custom-confirm" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={onDelete}>{t('tasks.yes')}</button>
            <button type="button" onClick={() => setConfirmingDelete(false)}>{t('tasks.no')}</button>
          </span>
        ) : (
          <button
            type="button"
            className="sidebar__custom-remove"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(true) }}
            aria-label={t('nav.removeSection')}
            title={t('nav.removeSection')}
          >
            ×
          </button>
        )
      )}
    </div>
  )
}

export default function Sidebar() {
  const { t } = useTranslation()
  const enabledSections = useSettingsStore((s) => s.enabledSections)
  const sectionNameOverrides = useSettingsStore((s) => s.sectionNameOverrides)
  const setSectionName = useSettingsStore((s) => s.setSectionName)
  const customSections = useCustomSectionsStore((s) => s.sections)
  const renameCustomSection = useCustomSectionsStore((s) => s.renameSection)
  const removeCustomSection = useCustomSectionsStore((s) => s.removeSection)
  const myFocusSection = SECTIONS.find((s) => s.id === 'myFocus')
  const sportSection = SECTIONS.find((s) => s.id === 'sport')
  // Pulled back out of the Info hub into its own row per later user
  // request — no count badge, same as before it ever joined that hub.
  // Insights/Principles pulled back out of the shared "Info" hub into their
  // own direct rows per later user request — clicking either now opens that
  // page straight away instead of a card hub in between (InfoPage.jsx and
  // its /info route are gone entirely; see git history if that hub pattern
  // is ever wanted back).
  const insightsSection = SECTIONS.find((s) => s.id === 'insights')
  const principlesSection = SECTIONS.find((s) => s.id === 'principles')
  const qaydlarSection = SECTIONS.find((s) => s.id === 'qaydlar')
  const financeSection = SECTIONS.find((s) => s.id === 'finance')
  const actionSections = SECTIONS.filter((s) => ACTIONS_IDS.includes(s.id) && enabledSections[s.id] !== false)

  // The main nav list (everything between the top and the Focus/Settings/
  // Completed/Trash utility group below), unified into one array + one
  // drag-reorder instance instead of each row being its own hardcoded JSX
  // block — per user request ("дай возможность перестановки пунктов по
  // своему усмотрению"). Built in the same default order the old hardcoded
  // blocks rendered in (Analysis, Data, Tasks, Habits, My Focus, Sport,
  // Qaydlar, Insights), so an account that's never dragged anything sees
  // no change at all; sidebarOrder (see useSettingsStore.js) only kicks in
  // once the user actually reorders something. Custom duplicate sections
  // (see GtdBoardPage.jsx) stay a separate, always-trailing group — they're
  // user-created and already independently orderable by nothing more than
  // creation order, and mixing two different "kind of section" concepts
  // into one persisted order array isn't worth the complexity here.
  const orderableSections = useMemo(() => {
    const defs = []
    if (principlesSection && enabledSections.principles !== false) {
      defs.push({ id: principlesSection.id, section: principlesSection })
    }
    // The inbox (referenceInfo) is a card in the Tasks section now, not a sidebar row.
    // No count badges anywhere in this nav list anymore (per user request,
    // "убери все уведомления из всех" — first just Tasks/Habits, then
    // widened to every row). RenamableNavLink still supports count/
    // countAlert/countCornerNeutral (just nothing here passes them) if a
    // badge is ever wanted back on some row.
    actionSections.forEach((s) => {
      defs.push({
        id: s.id, section: s,
        dropSectionKey: DRAG_TARGET_SECTION_IDS.includes(s.id) ? s.id : undefined,
      })
    })
    if (myFocusSection && enabledSections.myFocus !== false) {
      defs.push({ id: myFocusSection.id, section: myFocusSection })
    }
    if (sportSection && enabledSections.sport !== false) {
      defs.push({ id: sportSection.id, section: sportSection })
    }
    if (qaydlarSection && enabledSections.qaydlar !== false) {
      defs.push({ id: qaydlarSection.id, section: qaydlarSection })
    }
    if (financeSection && enabledSections.finance !== false) {
      defs.push({ id: financeSection.id, section: financeSection })
    }
    if (insightsSection && enabledSections.insights !== false) {
      defs.push({ id: insightsSection.id, section: insightsSection })
    }
    return defs
  }, [principlesSection, actionSections, myFocusSection, sportSection, qaydlarSection, financeSection, insightsSection, enabledSections])

  const sidebarOrder = useSettingsStore((s) => s.sidebarOrder)
  const setSidebarOrder = useSettingsStore((s) => s.setSidebarOrder)

  // Applies the saved order on top of the default one above: every id the
  // user has actually dragged keeps its saved position, in the order
  // dragged; anything not in sidebarOrder yet (never touched, or a section
  // added since) falls in after, at its normal default spot.
  const orderedSections = useMemo(() => {
    const remaining = new Map(orderableSections.map((d) => [d.id, d]))
    const ordered = []
    sidebarOrder.forEach((id) => {
      const def = remaining.get(id)
      if (def) { ordered.push(def); remaining.delete(id) }
    })
    // A section added after the user saved their order (e.g. myDay) goes
    // right before the next default-order neighbour already placed, not at
    // the far end of the list.
    orderableSections.forEach((d, i) => {
      if (!remaining.has(d.id)) return
      const nextId = orderableSections.slice(i + 1).map((x) => x.id).find((id) => ordered.some((o) => o.id === id))
      const at = nextId ? ordered.findIndex((o) => o.id === nextId) : ordered.length
      ordered.splice(at, 0, d)
    })
    return ordered
  }, [orderableSections, sidebarOrder])

  const orderedIds = orderedSections.map((d) => d.id)
  const { displayOrder: navDisplayOrder, draggingId: draggingNavId, bindHandle: bindNavHandle, dragGhost: navDragGhost } =
    useDragReorder(orderedIds, setSidebarOrder)
  const navRows = navDisplayOrder
    .map((id) => orderedSections.find((d) => d.id === id))
    .filter(Boolean)

  const renameHint = t('nav.renameSectionHint')

  return (
    <aside className="sidebar">
      <nav className="sidebar__nav">
        {/* No more group-label headers (per user request) and no Inbox row
            (per user request — its /inbox route still works, just nothing
            links to it from here anymore). Projects isn't a sidebar
            destination at all anymore either (per earlier user request) —
            it's a card on the Tasks hub instead (see UpcomingPage.jsx). */}
        {/* One row per orderableSections entry, in navRows' order (the
            saved sidebarOrder applied over the default order — see above).
            Drag any row (grab anywhere, same as a task card — see
            useDragReorder.jsx) to reorder; a plain click still navigates
            normally. */}
        {navRows.map((row) => (
          <RenamableNavLink
            key={row.id}
            to={row.section.route}
            Icon={SIDEBAR_ICONS[row.id] || row.section.Icon}
            iconClassName={SECTION_ICON_CLASS[row.id]}
            hue={SECTION_HUE[row.id]}
            name={getSectionTitle(row.section, sectionNameOverrides, t)}
            onRename={(name) => setSectionName(row.id, name)}
            renameHint={renameHint}
            count={row.count}
            countAlert={row.countAlert}
            countCornerNeutral={row.countCornerNeutral}
            dropSectionKey={row.dropSectionKey}
            dragHandleProps={bindNavHandle(row.id, getSectionTitle(row.section, sectionNameOverrides, t))}
            dragging={draggingNavId === row.id}
          />
        ))}
        {customSections.map((section) => (
          <RenamableNavLink
            key={section.id}
            to={`/custom/${section.id}`}
            Icon={IconTasks}
            name={section.name}
            onRename={(name) => renameCustomSection(section.id, name)}
            onDelete={() => removeCustomSection(section.id)}
            renameHint={renameHint}
          />
        ))}
      </nav>
      {navDragGhost}
      <div className="sidebar__bottom-group">
        <div className="sidebar__divider" />
        {/* Result & Statistics/Completed/Trash moved inside Settings itself
            (per user request, "3 кнопки кроме settings надо убрать с
            главной и засунуть в settings") — Settings is the only row left
            down here; the other three are still real, full pages (routes
            unchanged), just linked from inside SettingsPage.jsx now
            instead of getting their own sidebar row each. */}
        <div className="sidebar__custom-row">
          <NavLink to="/settings" className={({ isActive }) => 'sidebar__link sidebar__link--hue' + (isActive ? ' active' : '')} style={{ '--h': SECTION_HUE.settings }}>
            <span className="sidebar__ic"><SideIconSettings className="sidebar__icon" /></span>
            <span className="sidebar__label">{t('nav.settings')}</span>
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
