import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NOTE_STORES } from '../store/useQaydlarStore'
import { IconBack, IconPin } from '../icons/Icons'
import { stripImages } from '../features/qaydlar/noteBlocks'

function Card({ card, onOpen, onTogglePinned }) {
  const { t } = useTranslation()
  const pinLabel = t(card.pinned ? 'qaydlar.unpin' : 'qaydlar.pin')
  return (
    <div className="qaydlar-card" onClick={() => onOpen(card)}>
      <button
        type="button"
        className={'qaydlar-card__pin' + (card.pinned ? ' qaydlar-card__pin--active' : '')}
        onClick={(e) => { e.stopPropagation(); onTogglePinned(card.id) }}
        aria-label={pinLabel}
        title={pinLabel}
      >
        <IconPin size={14} />
      </button>
      <div className="qaydlar-card__title">{card.title}</div>
      {stripImages(card.text) && <div className="qaydlar-card__text">{stripImages(card.text)}</div>}
    </div>
  )
}

// Qaydlar — small pinnable title+text reference cards in a grid (per user
// request: distinct from Data/Insights/Analysis, all chat feeds elsewhere
// in the app). Pinned cards float to the front of the grid; everything
// else keeps insertion order. See useQaydlarStore.js for the data side,
// index.css's own .qaydlar-* rules (search "Qaydlar") for the grid sizing
// (targets 5-8 cards per row, per user request — auto-fill/minmax so it
// stays responsive instead of a hardcoded column count).
export default function QaydlarPage({ collection = 'notes' }) {
  const { t } = useTranslation()
  const useStore = NOTE_STORES[collection]
  const base = `/qaydlar/${collection}`
  const cards = useStore((s) => s.cards)
  const togglePinned = useStore((s) => s.togglePinned)
  const navigate = useNavigate()

  const pinned = cards.filter((c) => c.pinned)
  const unpinned = cards.filter((c) => !c.pinned)
  const ordered = [...pinned, ...unpinned]

  return (
    <div className="qaydlar-page">
      <div className="tasks-hub__back">
        <button type="button" className="page-back" onClick={() => navigate('/qaydlar')}>
          <IconBack size={14} /> {t('sections.qaydlar.title')}
        </button>
        <span className="qaydlar-page__title">{t(collection === 'notes' ? 'qaydlar.hubNotes' : 'qaydlar.hubKnowledge')}</span>
      </div>
      {ordered.length === 0 && (
        <p className="tasks-cards__empty">{t('qaydlar.empty')}</p>
      )}
      {/* Same window as the Projects page (per user request): a plain card
          grid, no title bar, and the "new" tile trailing the cards. */}
      <div className="qaydlar-grid">
        {ordered.map((card) => (
          <Card key={card.id} card={card} onOpen={(c) => navigate(`${base}/${c.id}`)} onTogglePinned={togglePinned} />
        ))}
        <button type="button" className="projects-page__add" onClick={() => navigate(`${base}/new`)}>
          <span className="projects-page__add-plus">+</span>
          {t('qaydlar.addCard')}
        </button>
      </div>
    </div>
  )
}
