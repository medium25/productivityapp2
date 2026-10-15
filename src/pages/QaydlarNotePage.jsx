import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NOTE_STORES } from '../store/useQaydlarStore'
import { IconBack, IconImage, IconPin } from '../icons/Icons'
import NoteEditor from '../features/qaydlar/NoteEditor'
import { parseBlocks, serializeBlocks, imageIds, stripHeadings } from '../features/qaydlar/noteBlocks'
import { deleteLocalMedia } from '../storage/localMedia'

// A note as its own page (per user request — not a modal), so the sidebar
// stays reachable: leave to copy something from another section and come
// back. Everything autosaves (debounced, and again on unmount), so nothing
// is lost when navigating away. "/qaydlar/new" starts an empty note that is
// created on the first keystroke.
export default function QaydlarNotePage({ collection = 'notes' }) {
  const useStore = NOTE_STORES[collection]
  const base = `/qaydlar/${collection}`
  const listLabelKey = collection === 'notes' ? 'qaydlar.hubNotes' : 'qaydlar.hubKnowledge'
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cardId } = useParams()
  const cards = useStore((s) => s.cards)
  const addCard = useStore((s) => s.addCard)
  const updateCard = useStore((s) => s.updateCard)
  const deleteCard = useStore((s) => s.deleteCard)
  const togglePinned = useStore((s) => s.togglePinned)
  const closeNote = () => navigate(base)

  const existing = cardId !== 'new' ? cards.find((c) => c.id === cardId) : null
  const idRef = useRef(existing ? existing.id : null)
  const [title, setTitle] = useState(existing?.title || '')
  const [blocks, setBlocks] = useState(() => parseBlocks(existing?.text || ''))
  const text = serializeBlocks(blocks)
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const latest = useRef({ title, text })
  latest.current = { title, text }
  const lastSaved = useRef({ title: existing?.title || '', text: existing?.text || '' })

  const save = (replaceRoute) => {
    const { title: tt, text: body } = latest.current
    if (tt === lastSaved.current.title && body === lastSaved.current.text) return
    lastSaved.current = { title: tt, text: body }
    const finalTitle = tt.trim() || stripHeadings(body).trim().split('\n')[0].slice(0, 80)
    if (!idRef.current) {
      if (!finalTitle && !body.trim()) return
      idRef.current = addCard(finalTitle, body)
      if (replaceRoute) navigate(`${base}/${idRef.current}`, { replace: true })
    } else {
      updateCard(idRef.current, { title: finalTitle, text: body.trim() })
    }
  }

  useEffect(() => {
    const id = setTimeout(() => save(true), 400)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, text])

  // Flush on leaving the page.
  useEffect(() => () => save(false), []) // eslint-disable-line react-hooks/exhaustive-deps

  const live = idRef.current ? cards.find((c) => c.id === idRef.current) : null

  if (cardId !== 'new' && !existing && !idRef.current) {
    return (
      <div className="qaydlar-note">
        <button type="button" className="project-flow__chip" onClick={closeNote}>
          <IconBack size={14} /> {t(listLabelKey)}
        </button>
      </div>
    )
  }

  return (
    <div className="qaydlar-note">
      <div className="qaydlar-note__bar">
        <button type="button" className="project-flow__chip" onClick={closeNote}>
          <IconBack size={14} /> {t(listLabelKey)}
        </button>
        <div className="qaydlar-note__actions">
          <button
            type="button"
            className="qaydlar-editor__pin"
            onClick={() => fileInputRef.current?.click()}
            aria-label={t('qaydlar.addPhoto')}
            title={t('qaydlar.addPhoto')}
          >
            <IconImage size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { const files = [...e.target.files]; e.target.value = ''; if (files.length) editorRef.current?.insertFiles(files) }}
          />
          {live && (
            <button
              type="button"
              className={'qaydlar-editor__pin' + (live.pinned ? ' qaydlar-editor__pin--active' : '')}
              onClick={() => togglePinned(live.id)}
              aria-label={t(live.pinned ? 'qaydlar.unpin' : 'qaydlar.pin')}
              title={t(live.pinned ? 'qaydlar.unpin' : 'qaydlar.pin')}
            >
              <IconPin size={18} />
            </button>
          )}
          {live && (confirmingDelete ? (
            <span className="qaydlar-editor__confirm">
              <span>{t('qaydlar.confirmDelete')}</span>
              <button
                type="button"
                onClick={() => { const id = idRef.current; idRef.current = null; lastSaved.current = { title: latest.current.title, text: latest.current.text }; imageIds(latest.current.text).forEach(deleteLocalMedia); deleteCard(id); closeNote() }}
              >
                {t('tasks.yes')}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>{t('tasks.no')}</button>
            </span>
          ) : (
            <button type="button" className="qaydlar-editor__delete" onClick={() => setConfirmingDelete(true)}>{t('qaydlar.delete')}</button>
          ))}
        </div>
      </div>
      <input
        type="text"
        className="qaydlar-editor__title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('qaydlar.titlePlaceholder')}
        maxLength={80}
      />
      <NoteEditor
        ref={editorRef}
        blocks={blocks}
        onChange={setBlocks}
        placeholder={t('qaydlar.textPlaceholder')}
        autoFocus={cardId === 'new'}
      />
    </div>
  )
}
