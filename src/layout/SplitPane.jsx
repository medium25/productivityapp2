import { Suspense, useCallback, useMemo, useReducer } from 'react'
import { Routes, parsePath, UNSAFE_NavigationContext as NavigationContext, UNSAFE_LocationContext as LocationContext, UNSAFE_RouteContext as RouteContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SECTIONS, getSectionTitle } from '../constants/sections'
import { useSettingsStore } from '../store/useSettingsStore'
import { SIDEBAR_ICONS, SideIconSettings } from './sidebarIcons'
import { pageRoutes } from './pageRoutes'

// The left half of the split window. It renders the same pages as the main
// router, but under its own little history, so links and back buttons inside it
// move only this half and leave the right half where it is.

const ROOT_ROUTE_CONTEXT = { outlet: null, matches: [], isDataRoute: false }

let keySeed = 0
const makeLocation = (to, state) => {
  const parsed = typeof to === 'string' ? parsePath(to) : to
  return { pathname: parsed.pathname || '/', search: parsed.search || '', hash: parsed.hash || '', state: state ?? null, key: 'p' + (keySeed++) }
}

// entries: pages visited in the left half; empty = the section chooser is shown.
function historyReducer(h, action) {
  switch (action.type) {
    case 'push': {
      const entries = [...h.entries.slice(0, h.index + 1), action.location]
      return { entries, index: entries.length - 1 }
    }
    case 'replace': {
      if (!h.entries.length) return { entries: [action.location], index: 0 }
      const entries = h.entries.slice()
      entries[h.index] = action.location
      return { entries, index: h.index }
    }
    case 'go': {
      const index = Math.min(Math.max(h.index + action.delta, 0), h.entries.length - 1)
      return { ...h, index }
    }
    case 'reset':
      return { entries: [], index: 0 }
    default:
      return h
  }
}

// What the chooser offers, in the sidebar's order plus the two Tasks cards.
function useChoices() {
  const { t } = useTranslation()
  const overrides = useSettingsStore((s) => s.sectionNameOverrides)
  return useMemo(() => {
    const byId = (id) => SECTIONS.find((s) => s.id === id)
    const fromSection = (id, route) => {
      const section = byId(id)
      return section ? { id, route: route || section.route, title: getSectionTitle(section, overrides, t), Icon: SIDEBAR_ICONS[id] || section.Icon } : null
    }
    return [
      fromSection('myFocus'),
      fromSection('myDay'),
      fromSection('referenceInfo'),
      fromSection('insights'),
      fromSection('principles'),
      fromSection('habits'),
      fromSection('tokovinin'),
      fromSection('sport'),
      fromSection('finance'),
      fromSection('qaydlar'),
      { id: 'settings', route: '/settings', title: t('nav.settings'), Icon: SideIconSettings },
    ].filter(Boolean)
  }, [overrides, t])
}

// Page title for the bar above a half, from its path (longest matching route).
export function usePaneTitle(pathname) {
  const choices = useChoices()
  const hit = choices
    .filter((c) => pathname === c.route || pathname.startsWith(c.route + '/'))
    .sort((a, b) => b.route.length - a.route.length)[0]
  return hit ? hit.title : ''
}

export function SplitPaneBar({ title, onChoose, children }) {
  const { t } = useTranslation()
  return (
    <div className="split-bar">
      {onChoose && (
        <button type="button" className="page-back" onClick={onChoose}>{t('splitView.sections')}</button>
      )}
      <span className="split-bar__title">{title}</span>
      {children}
    </div>
  )
}

export default function SplitPane() {
  const { t } = useTranslation()
  const choices = useChoices()
  const [history, dispatch] = useReducer(historyReducer, { entries: [], index: 0 })

  const navigator = useMemo(() => ({
    createHref: (to) => '#' + (typeof to === 'string' ? to : (to.pathname || '/') + (to.search || '') + (to.hash || '')),
    encodeLocation: (to) => {
      const p = typeof to === 'string' ? parsePath(to) : to
      return { pathname: p.pathname || '', search: p.search || '', hash: p.hash || '' }
    },
    push: (to, state) => dispatch({ type: 'push', location: makeLocation(to, state) }),
    replace: (to, state) => dispatch({ type: 'replace', location: makeLocation(to, state) }),
    go: (delta) => dispatch({ type: 'go', delta }),
  }), [])

  const navContext = useMemo(() => ({ basename: '/', navigator, static: false, future: {} }), [navigator])
  const location = history.entries[history.index]
  const locContext = useMemo(() => (location ? { location, navigationType: 'PUSH' } : null), [location])
  const choose = useCallback((route) => navigator.push(route), [navigator])
  const title = usePaneTitle(location ? location.pathname : '')

  return (
    <>
      <SplitPaneBar title={title} onChoose={location ? () => dispatch({ type: 'reset' }) : null} />
      <div className="page-content">
        {location ? (
          <NavigationContext.Provider value={navContext}>
            <LocationContext.Provider value={locContext}>
              <RouteContext.Provider value={ROOT_ROUTE_CONTEXT}>
                <Suspense fallback={null}><Routes>{pageRoutes}</Routes></Suspense>
              </RouteContext.Provider>
            </LocationContext.Provider>
          </NavigationContext.Provider>
        ) : (
          <div className="split-chooser">
            <p className="split-chooser__hint">{t('splitView.pick')}</p>
            <div className="split-chooser__grid">
              {choices.map(({ id, route, title: name, Icon }) => (
                <button key={id} type="button" className="split-chooser__tile" onClick={() => choose(route)}>
                  <Icon className="split-chooser__icon" />
                  <span>{name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
