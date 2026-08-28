import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SECTIONS } from '../constants/sections.js'
import { useSettingsStore } from '../store/settingsStore.js'

export default function Sidebar() {
  const { t } = useTranslation()
  const visibleSections = useSettingsStore((state) => state.visibleSections)
  // Hidden sections (toggled off in Settings) are dropped from the nav,
  // but their routes stay registered in App.jsx and still work if visited
  // directly.
  const visibleNavSections = SECTIONS.filter(
    (section) => visibleSections[section.id] !== false,
  )

  return (
    <nav className="sidebar" aria-label={t('sidebar.ariaLabel')}>
      <ul className="sidebar-list">
        {visibleNavSections.map((section) => (
          <li key={section.id}>
            <NavLink
              to={section.path}
              end={section.path === '/'}
              className={({ isActive }) =>
                isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link'
              }
            >
              <span className="sidebar-link-dot" aria-hidden="true" />
              <span className="sidebar-link-label">{t(section.labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
