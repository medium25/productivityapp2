import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { saveLocalMedia, deleteLocalMedia } from '../../storage/localMedia'
import { useLocalMediaUrl } from '../tasks/useLocalMediaUrl'
import { useAutoGrowTextarea } from '../tasks/useAutoGrowTextarea'
import { IconClose } from '../../icons/Icons'

// The body of a note: text blocks with photos between them (per user request —
// photos can sit between the texts). `blocks` comes from noteBlocks.js. A photo
// is added at the caret of the text block that was last in focus — from the
// "add photo" button (insertFiles via ref), a paste, or a drop.

const MAX_SIDE = 1800

// Big photos are scaled down before they are kept on the device.
async function prepareImage(file) {
  if (!/^image\/(jpeg|png|webp|heic)$/i.test(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 2 * 1024 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
    return blob || file
  } catch {
    return file
  }
}

function TextBlock({ index, value, placeholder, onChange, onCaret, onFiles, setRef }) {
  const grow = useAutoGrowTextarea(value)
  // Re-fit when the column width changes (window resize, split view): wrapping
  // changes the height the text needs even though the text itself did not.
  useEffect(() => {
    const el = grow.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    let width = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [grow])
  const caret = (e) => onCaret(index, e.target.selectionStart)
  const imageFiles = (list) => [...(list || [])].filter((f) => f.type.startsWith('image/'))
  return (
    <textarea
      ref={(el) => { grow.current = el; setRef(index, el) }}
      className="note-block__text"
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => { onChange(index, e.target.value); caret(e) }}
      onFocus={caret}
      onClick={caret}
      onKeyUp={caret}
      onSelect={caret}
      onPaste={(e) => {
        const files = imageFiles(e.clipboardData?.files)
        if (files.length) { e.preventDefault(); onFiles(files) }
      }}
      onDrop={(e) => {
        const files = imageFiles(e.dataTransfer?.files)
        if (files.length) { e.preventDefault(); onFiles(files) }
      }}
    />
  )
}

function ImageBlock({ id, onRemove }) {
  const { t } = useTranslation()
  const url = useLocalMediaUrl(id)
  const [waited, setWaited] = useState(false)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 1500)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className="note-block__image">
      {url ? (
        <img src={url} alt="" draggable={false} />
      ) : (
        <div className="note-block__missing">{waited ? t('insights.mediaUnavailable') : ''}</div>
      )}
      {confirming ? (
        <div className="note-block__confirm" role="alertdialog">
          <span>{t('qaydlar.confirmRemovePhoto')}</span>
          <button type="button" className="note-block__confirm-yes" onClick={() => onRemove(id)}>{t('tasks.yes')}</button>
          <button type="button" onClick={() => setConfirming(false)} autoFocus>{t('tasks.no')}</button>
        </div>
      ) : (
        <button type="button" className="modal-close note-block__remove" onClick={() => setConfirming(true)} aria-label={t('qaydlar.removePhoto')} title={t('qaydlar.removePhoto')}>
          <IconClose size={14} />
        </button>
      )}
    </div>
  )
}

const NoteEditor = forwardRef(function NoteEditor({ blocks, onChange, placeholder, autoFocus }, ref) {
  const latest = useRef(blocks)
  latest.current = blocks
  const caretRef = useRef({ index: 0, pos: null })
  const areas = useRef({})
  const pendingFocus = useRef(autoFocus ? 0 : null)

  // The caret of whichever text block has focus, kept up to date as it moves
  // (typing, arrows, mouse), so a photo lands exactly where the cursor was.
  useEffect(() => {
    const onSelectionChange = () => {
      const active = document.activeElement
      const entry = Object.entries(areas.current).find(([, el]) => el === active)
      if (entry) caretRef.current = { index: Number(entry[0]), pos: active.selectionStart }
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  useEffect(() => {
    const target = pendingFocus.current
    if (target == null) return
    pendingFocus.current = null
    const el = areas.current[target]
    if (el) { el.focus(); el.setSelectionRange(0, 0) }
  }, [blocks])

  const updateText = (index, value) => {
    onChange(latest.current.map((b, i) => (i === index ? { ...b, value } : b)))
  }

  const insertFiles = async (files) => {
    for (const file of files) {
      const id = crypto.randomUUID()
      const blob = await prepareImage(file)
      await saveLocalMedia(id, blob)
      const current = latest.current
      let target = caretRef.current.index
      if (current[target]?.type !== 'text') target = current.length - 1
      const block = current[target]
      const at = Math.min(caretRef.current.pos ?? block.value.length, block.value.length)
      const next = [
        ...current.slice(0, target),
        { type: 'text', value: block.value.slice(0, at).replace(/\n$/, '') },
        { type: 'img', id },
        { type: 'text', value: block.value.slice(at).replace(/^\n/, '') },
        ...current.slice(target + 1),
      ]
      caretRef.current = { index: target + 2, pos: 0 }
      pendingFocus.current = target + 2
      latest.current = next
      onChange(next)
    }
  }
  useImperativeHandle(ref, () => ({ insertFiles }))

  const removeImage = (id) => {
    const current = latest.current
    const at = current.findIndex((b) => b.type === 'img' && b.id === id)
    if (at < 1) return
    const before = current[at - 1]
    const after = current[at + 1]
    const merged = { type: 'text', value: [before.value, after.value].filter((v) => v !== '').join('\n') }
    deleteLocalMedia(id)
    caretRef.current = { index: at - 1, pos: before.value.length }
    onChange([...current.slice(0, at - 1), merged, ...current.slice(at + 2)])
  }

  const lastText = blocks.length - 1
  return (
    <div
      className="note-body"
      onClick={(e) => { if (e.target === e.currentTarget) areas.current[lastText]?.focus() }}
    >
      {blocks.map((b, i) => (b.type === 'img' ? (
        <ImageBlock key={'i' + b.id} id={b.id} onRemove={removeImage} />
      ) : (
        <TextBlock
          key={'t' + i}
          index={i}
          value={b.value}
          placeholder={blocks.length === 1 ? placeholder : ''}
          onChange={updateText}
          onCaret={(index, pos) => { caretRef.current = { index, pos } }}
          onFiles={insertFiles}
          setRef={(index, el) => { if (el) areas.current[index] = el; else delete areas.current[index] }}
        />
      )))}
    </div>
  )
})

export default NoteEditor
