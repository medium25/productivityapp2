import { NavLink } from 'react-router-dom'
import { SECTIONS } from '../constants/sections.js'

export default function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Разделы">
      <ul className="sidebar-list">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <NavLink
              to={section.path}
              end={section.path === '/'}
              className={({ isActive }) =>
                isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link'
              }
            >
              <span className="sidebar-link-dot" aria-hidden="true" />
              <span className="sidebar-link-label">{section.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
