import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Big section cards (Tasks hub, Data hub): light theme tinted with a solid icon
// badge, dark theme graphite with a coloured glow. Each item:
// { key, to, name, meta, progress, Icon, color (dark), colorLight }.
export default function HubCards({ items }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <div className="hub-grid">
      {items.map((h) => (
        <div
          key={h.key}
          role="button"
          tabIndex={0}
          className="hub-card"
          style={{ '--hub-dark': h.color, '--hub-light': h.colorLight }}
          onClick={() => navigate(h.to)}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate(h.to) }}
        >
          <span className="hub-card__tile"><h.Icon size={26} /></span>
          <span className="hub-card__name">{h.name}</span>
          <span className="hub-card__meta">{h.meta}</span>
          <span className="hub-card__foot">
            <span className="hub-card__bar"><span style={{ width: `${h.progress || 0}%` }} /></span>
            <span className="hub-card__go">{t('tasksHub.open')} →</span>
            <span className="hub-card__arrow" aria-hidden="true">→</span>
          </span>
        </div>
      ))}
    </div>
  )
}
