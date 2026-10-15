import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDragReorder } from '../features/tasks/useDragReorder'
import { useAutoGrowTextarea } from '../features/tasks/useAutoGrowTextarea'

function formatCardDate(iso, language) {
  try {
    return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return ''
  }
}

// Bottom quick-add — same position/logic as Projects/Insights/Inbox (per
// user request, "одна логика во всех отделах"). Multi-line since a
// knowledge card is a note, not a one-line title.
function CardQuickAdd({ onAdd, placeholder }) {
  const [text, setText] = useState('')
  const textareaRef = useAutoGrowTextarea(text)

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setText('')
  }

  return (
    <div className="tasks-column__quick-add tasks-column__quick-add--bottom">
      <textarea
        ref={textareaRef}
        className="tasks-column__quick-add-input"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        rows={1}
      />
      <button type="button" className="tasks-column__quick-add-btn" onClick={submit}>
        +
      </button>
    </div>
  )
}

// Generic free-form card list, parameterized by store/labels so a
// card-notes section can reuse it instead of duplicating the component.
// Cards are plain text (no separate title field) — click one to open it in
// an edit/delete modal, same interaction as HabitsPage's own row modal.
export default function CardNotesPage({ useStore, titleKey, emptyKey, placeholderKey }) {
  const { t, i18n } = useTranslation()
  const cards = useStore((s) => s.cards)
  const addCard = useStore((s) => s.addCard)
  const updateCard = useStore((s) => s.updateCard)
  const deleteCard = useStore((s) => s.deleteCard)
  const reorderCards = useStore((s) => s.reorderCards)

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards])
  const { displayOrder: cardOrder, draggingId: draggingCardId, bindHandle: bindCardHandle, dragGhost } =
    useDragReorder(cardIds, reorderCards)
  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])

  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const startEdit = (card) => {
    setEditingId(card.id)
    setEditText(card.text)
    setConfirmingDelete(false)
  }
  const cancelEdit = () => { setEditingId(null); setConfirmingDelete(false) }
  const saveEdit = () => {
    if (!editText.trim()) return
    updateCard(editingId, editText)
    setEditingId(null)
  }
  const confirmDelete = () => {
    deleteCard(editingId)
    setEditingId(null)
    setConfirmingDelete(false)
  }

  return (
    <div className="tasks-page tasks-page--edge-to-edge">
      <div className="tasks-board tasks-board--fill">
        <div className="tasks-column">
          <div className="tasks-column__list">
            {cards.length === 0 ? (
              <p className="task-section__empty">{t(emptyKey)}</p>
            ) : (
              cardOrder.map((id) => {
                const card = cardsById.get(id)
                if (!card) return null
                return (
                  <div
                    key={card.id}
                    {...bindCardHandle(card.id, card.text.slice(0, 40))}
                    className={'card-note' + (draggingCardId === card.id ? ' card-note--dragging' : '')}
                    onClick={() => startEdit(card)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startEdit(card) }}
                    role="button"
                    tabIndex={0}
                  >
                    <p className="card-note__text">{card.text}</p>
                    <span className="card-note__date">{formatCardDate(card.updatedAt || card.createdAt, i18n.language)}</span>
                  </div>
                )
              })
            )}
          </div>
          {dragGhost}
          <CardQuickAdd onAdd={addCard} placeholder={t(placeholderKey)} />
        </div>
      </div>

      {editingId && (
        <div className="habits-modal-backdrop" onClick={cancelEdit}>
          <div className="habits-modal" onClick={(e) => e.stopPropagation()}>
            <textarea
              className="tasks-column__quick-add-input card-note-modal__textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              rows={6}
            />
            <div className="habits-modal-actions">
              {confirmingDelete ? (
                <span className="project-row__confirm">
                  <span>{t('tasks.confirmDeleteTask')}</span>
                  <button type="button" onClick={confirmDelete}>{t('tasks.yes')}</button>
                  <button type="button" onClick={() => setConfirmingDelete(false)}>{t('tasks.no')}</button>
                </span>
              ) : (
                <button type="button" className="project-row__menu-danger habits-modal-delete" onClick={() => setConfirmingDelete(true)}>
                  {t('tasks.deleteTask')}
                </button>
              )}
              <span className="habits-modal-actions__right">
                <button type="button" className="habits-edit-cancel" onClick={cancelEdit}>{t('tasks.cancel')}</button>
                <button type="button" className="card-note-modal__save" onClick={saveEdit}>{t('tasks.save')}</button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
