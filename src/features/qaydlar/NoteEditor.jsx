import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { saveLocalMedia, deleteLocalMedia, getLocalMedia } from '../../storage/localMedia'
import { serializeBlocks } from './noteBlocks'

// Headings: Cmd/Ctrl+1/2/3 turn the selected lines into a large / medium /
// small heading (Cmd+0 or the same key again turns it back). Stored as a
// markdown-style prefix on the line ("# ", "## ", "### ").
//
// The body of a note: ONE contenteditable document — lines of text with small
// photo thumbnails on lines of their own — so a drag/shift-selection can span
// text and screenshots together and Cmd+C copies both at once (per user
// request, for pasting a screenshot + text into Claude in one go).
//
// `blocks` still comes from / goes to noteBlocks.js (text blocks with images
// between them), so the stored format ([[img:id]] markers) is unchanged. The
// DOM inside the editor is managed by hand (React renders only the empty
// root): every `input` is read back into blocks, and the DOM is rebuilt from
// props only when they differ from what the DOM already says (a different
// note was opened) — rebuilding on every keystroke would reset the caret.

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

const imageFiles = (list) => [...(list || [])].filter((f) => f.type.startsWith('image/'))

const HEADING_PREFIX = /^(#{1,3}) /
const levelPrefix = (level) => (level ? `${'#'.repeat(level)} ` : '')

function setLevel(div, level) {
  div.className = 'note-line' + (level ? ` note-line--h${level}` : '')
  if (level) div.dataset.level = String(level)
  else delete div.dataset.level
}

// `stored` is a line as kept in the note text, heading prefix included.
function lineDiv(stored) {
  const match = HEADING_PREFIX.exec(stored || '')
  const text = match ? stored.slice(match[0].length) : stored
  const div = document.createElement('div')
  setLevel(div, match ? match[1].length : 0)
  if (text) div.textContent = text
  else div.appendChild(document.createElement('br'))
  return div
}

// DOM -> flat list of { line } / { img } items. Tolerates what browsers
// produce while typing: <div> per line, bare text nodes, <br> inside lines
// (a <br> that ends its block is only the empty-line placeholder).
function domToItems(root) {
  const items = []
  const inlineText = (node) => {
    let s = ''
    node.childNodes.forEach((c, i) => {
      if (c.nodeType === 3) s += c.nodeValue
      else if (c.nodeName === 'BR') { if (i !== node.childNodes.length - 1) s += '\n' }
      else s += inlineText(c)
    })
    return s
  }
  root.childNodes.forEach((child) => {
    const level = Number(child.dataset?.level) || 0
    if (child.nodeType === 3) child.nodeValue.split('\n').forEach((line) => items.push({ line }))
    else if (child.dataset?.id) items.push({ img: child.dataset.id })
    else if (child.nodeName === 'BR') items.push({ line: '' })
    else inlineText(child).split('\n').forEach((line) => items.push({ line, level }))
  })
  return items
}

// items -> blocks with a text block before, between and after every photo.
function itemsToBlocks(items) {
  const blocks = []
  let lines = []
  const flush = () => { blocks.push({ type: 'text', value: lines.join('\n') }); lines = [] }
  items.forEach((it) => {
    if (it.img) { flush(); blocks.push({ type: 'img', id: it.img }) } else lines.push(levelPrefix(it.level) + it.line)
  })
  flush()
  return blocks
}

function topLevelChild(root, node) {
  let n = node
  while (n && n.parentNode !== root) n = n.parentNode
  return n
}

// Fragment (a clone of the selection) -> plain text, photos left out.
function fragmentText(fragment) {
  const holder = document.createElement('div')
  holder.appendChild(fragment.cloneNode(true))
  return domToItems(holder).filter((it) => it.line !== undefined).map((it) => it.line).join('\n')
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function toPng(blob) {
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d').drawImage(bitmap, 0, 0)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Puts text + photos on the clipboard together: plain text, HTML with the
// photos embedded, and the first photo as image/png (what most chat inputs
// take as an attachment).
async function writeRichClipboard(fragment) {
  const holder = document.createElement('div')
  holder.appendChild(fragment.cloneNode(true))
  const items = domToItems(holder)
  const ids = items.filter((it) => it.img).map((it) => it.img)
  if (!ids.length || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return
  const blobs = (await Promise.all(ids.map((id) => getLocalMedia(id)))).map((b, i) => ({ id: ids[i], blob: b }))
  const html = (await Promise.all(items.map(async (it) => {
    if (it.img) {
      const found = blobs.find((b) => b.id === it.img)?.blob
      return found ? `<p><img src="${await blobToDataUrl(found)}"></p>` : ''
    }
    const tag = it.level ? `h${it.level}` : 'p'
    return `<${tag}>${it.line ? escapeHtml(it.line) : '<br>'}</${tag}>`
  }))).join('')
  const text = items.filter((it) => it.line !== undefined).map((it) => it.line).join('\n')
  const payload = {
    'text/plain': new Blob([text], { type: 'text/plain' }),
    'text/html': new Blob([html], { type: 'text/html' }),
  }
  const first = blobs.find((b) => b.blob)?.blob
  if (first) payload['image/png'] = await toPng(first)
  await navigator.clipboard.write([new ClipboardItem(payload)])
}

async function copyImageToClipboard(id) {
  const blob = await getLocalMedia(id)
  if (!blob || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': await toPng(blob) })])
  return true
}

function openLightbox(url) {
  const overlay = document.createElement('div')
  overlay.className = 'note-lightbox'
  const img = document.createElement('img')
  img.src = url
  overlay.appendChild(img)
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true) }
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
  overlay.addEventListener('click', close)
  document.addEventListener('keydown', onKey, true)
  document.body.appendChild(overlay)
}

const NoteEditor = forwardRef(function NoteEditor({ blocks, onChange, placeholder, autoFocus }, ref) {
  const { t } = useTranslation()
  const rootRef = useRef(null)
  const lastSerialized = useRef(null)
  const lastRange = useRef(null)
  const urls = useRef(new Map())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const strings = useRef({})
  strings.current = {
    unavailable: t('insights.mediaUnavailable'),
    remove: t('qaydlar.removePhoto'),
    copy: t('qaydlar.copyPhoto'),
    confirm: t('qaydlar.confirmRemovePhoto'),
    yes: t('tasks.yes'),
    no: t('tasks.no'),
  }

  const refreshEmpty = () => {
    const root = rootRef.current
    if (!root) return
    const items = domToItems(root)
    root.classList.toggle('is-empty', items.length <= 1 && !items.some((it) => it.img || it.line))
  }

  // Photos that follow each other share one row, so an empty line between two
  // of them is dropped (unless the caret is in it); the document always starts
  // and ends with an editable line.
  const normalizeRows = () => {
    const root = rootRef.current
    const sel = window.getSelection()
    const kids = [...root.children]
    kids.forEach((el, i) => {
      if (el.dataset?.id) return
      if (kids[i - 1]?.dataset?.id && kids[i + 1]?.dataset?.id && !el.textContent && !(sel.rangeCount && el.contains(sel.anchorNode))) el.remove()
    })
    if (root.firstElementChild?.dataset?.id) root.prepend(lineDiv(''))
    if (root.lastElementChild?.dataset?.id) root.append(lineDiv(''))
  }

  const emit = () => {
    const root = rootRef.current
    // Bare text nodes at the top level (typing into an empty editor) become lines.
    root.childNodes.forEach((n) => {
      if (n.nodeType === 3 && n.nodeValue !== '') {
        const wrap = document.createElement('div')
        wrap.className = 'note-line'
        root.insertBefore(wrap, n)
        wrap.appendChild(n)
        const sel = window.getSelection()
        if (sel.rangeCount && sel.anchorNode === n) sel.collapse(n, sel.anchorOffset)
      }
    })
    if (!root.firstChild) root.appendChild(lineDiv(''))
    normalizeRows()
    const next = itemsToBlocks(domToItems(root))
    lastSerialized.current = serializeBlocks(next)
    refreshEmpty()
    onChangeRef.current(next)
  }

  const removeImageLine = (line) => {
    const id = line.dataset.id
    const url = urls.current.get(id)
    if (url) { URL.revokeObjectURL(url); urls.current.delete(id) }
    line.remove()
    deleteLocalMedia(id)
    emit()
  }

  const buildImageLine = (id) => {
    const line = document.createElement('div')
    line.className = 'note-line note-line--img'
    line.contentEditable = 'false'
    line.dataset.id = id
    const wrap = document.createElement('span')
    wrap.className = 'note-thumb'
    line.appendChild(wrap)
    const showImage = (url) => {
      wrap.replaceChildren()
      const img = document.createElement('img')
      img.src = url
      img.alt = ''
      img.draggable = false
      img.addEventListener('click', () => openLightbox(url))
      const x = document.createElement('button')
      x.type = 'button'
      x.className = 'note-thumb__x'
      x.textContent = '×'
      x.title = strings.current.remove
      x.setAttribute('aria-label', strings.current.remove)
      x.addEventListener('click', (e) => {
        e.stopPropagation()
        const bar = document.createElement('span')
        bar.className = 'note-thumb__confirm'
        bar.setAttribute('role', 'alertdialog')
        const label = document.createElement('span')
        label.textContent = strings.current.confirm
        const yes = document.createElement('button')
        yes.type = 'button'
        yes.className = 'note-thumb__yes'
        yes.textContent = strings.current.yes
        yes.addEventListener('click', () => removeImageLine(line))
        const no = document.createElement('button')
        no.type = 'button'
        no.textContent = strings.current.no
        no.addEventListener('click', () => { bar.remove(); x.hidden = false })
        bar.append(label, yes, no)
        x.hidden = true
        wrap.appendChild(bar)
        no.focus()
      })
      const copy = document.createElement('button')
      copy.type = 'button'
      copy.className = 'note-thumb__copy'
      copy.textContent = '⧉'
      copy.title = strings.current.copy
      copy.setAttribute('aria-label', strings.current.copy)
      copy.addEventListener('click', async (e) => {
        e.stopPropagation()
        try {
          if (await copyImageToClipboard(id)) {
            copy.textContent = '✓'
            setTimeout(() => { copy.textContent = '⧉' }, 1200)
          }
        } catch (err) { console.error('Copy photo failed', err) }
      })
      wrap.append(img, copy, x)
    }
    const existing = urls.current.get(id)
    if (existing) showImage(existing)
    else {
      wrap.textContent = '…'
      getLocalMedia(id).then((blob) => {
        if (!line.isConnected && !wrap.isConnected) return
        if (!blob) { wrap.textContent = strings.current.unavailable; wrap.classList.add('note-thumb--missing'); return }
        const url = URL.createObjectURL(blob)
        urls.current.set(id, url)
        showImage(url)
      })
    }
    return line
  }

  // Props -> DOM, only when they say something the DOM does not already.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || serializeBlocks(blocks) === lastSerialized.current) return
    root.replaceChildren()
    blocks.forEach((b, i) => {
      if (b.type === 'img') root.appendChild(buildImageLine(b.id))
      else if (b.value === '' && blocks[i - 1]?.type === 'img' && blocks[i + 1]?.type === 'img') return
      else (b.value === '' ? [''] : b.value.split('\n')).forEach((l) => root.appendChild(lineDiv(l)))
    })
    normalizeRows()
    lastSerialized.current = serializeBlocks(blocks)
    refreshEmpty()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks])

  useEffect(() => {
    if (!autoFocus) return
    const root = rootRef.current
    root.focus()
    const range = document.createRange()
    range.selectNodeContents(root.firstChild)
    range.collapse(true)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }, [autoFocus])

  // Remember the caret so the "add photo" button (which steals focus) still
  // lands the photo where the user was; mark photos inside a selection.
  useEffect(() => {
    const onSelectionChange = () => {
      const root = rootRef.current
      const sel = window.getSelection()
      if (!root || !sel.rangeCount) return
      const range = sel.getRangeAt(0)
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
        root.querySelectorAll('.note-line--img.is-selected').forEach((el) => el.classList.remove('is-selected'))
        return
      }
      lastRange.current = range.cloneRange()
      root.querySelectorAll('.note-line--img').forEach((el) => {
        el.classList.toggle('is-selected', !range.collapsed && sel.containsNode(el, true))
      })
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  useEffect(() => {
    const map = urls.current
    return () => { map.forEach((u) => URL.revokeObjectURL(u)); map.clear() }
  }, [])

  const insertImage = (id, range) => {
    const root = rootRef.current
    let line = range && root.contains(range.startContainer) ? topLevelChild(root, range.startContainer) : null
    if (range && !range.collapsed) range.deleteContents()
    const imgLine = buildImageLine(id)
    let after
    if (line && line.dataset?.id === undefined && line.nodeType === 1) {
      // Split the current line at the caret: [before][photo][after].
      const tail = document.createRange()
      tail.setStart(range.startContainer, range.startOffset)
      tail.setEndAfter(line.lastChild || line)
      const rest = tail.extractContents()
      after = document.createElement('div')
      after.className = 'note-line'
      after.appendChild(rest)
      if (!after.textContent) { after.replaceChildren(document.createElement('br')) }
      if (!line.textContent && !line.querySelector('br')) line.appendChild(document.createElement('br'))
      line.after(imgLine, after)
    } else {
      line = root.lastElementChild
      after = lineDiv('')
      if (line) line.after(imgLine, after)
      else root.append(imgLine, after)
    }
    const caret = document.createRange()
    caret.setStart(after, 0)
    caret.collapse(true)
    root.focus()
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(caret)
    emit()
  }

  const insertFiles = async (files) => {
    for (const file of files) {
      const id = crypto.randomUUID()
      const blob = await prepareImage(file)
      await saveLocalMedia(id, blob)
      const sel = window.getSelection()
      const live = sel.rangeCount && rootRef.current.contains(sel.getRangeAt(0).startContainer) ? sel.getRangeAt(0) : lastRange.current
      insertImage(id, live)
    }
  }
  useImperativeHandle(ref, () => ({ insertFiles }))

  // Selected text lines (photos skipped) -> heading level; the same level
  // again, or 0, turns them back into plain text.
  const applyHeading = (level) => {
    const root = rootRef.current
    const sel = window.getSelection()
    if (!sel.rangeCount || !root.contains(sel.anchorNode)) return
    const range = sel.getRangeAt(0)
    const first = topLevelChild(root, range.startContainer)
    const last = topLevelChild(root, range.endContainer)
    if (!first || !last) return
    const lines = []
    for (let el = first; el; el = el.nextElementSibling) {
      if (!el.dataset?.id) lines.push(el)
      if (el === last) break
    }
    if (!lines.length) return
    const target = level && lines.every((el) => Number(el.dataset.level) === level) ? 0 : level
    lines.forEach((el) => setLevel(el, target))
    emit()
  }

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && /^[0-3]$/.test(e.key)) {
      // Cmd+1..3 may be taken by the browser (tab switching) — Cmd/Ctrl+Alt+1..3
      // is the same thing; macOS reports Alt+digit as a symbol, so read e.code.
      e.preventDefault()
      applyHeading(Number(e.key))
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.altKey && /^Digit[0-3]$/.test(e.code)) {
      e.preventDefault()
      applyHeading(Number(e.code.slice(5)))
      return
    }
    // Enter at the end of a heading starts a plain line, not another heading.
    if (e.key === 'Enter' && !e.shiftKey) {
      setTimeout(() => {
        const sel = window.getSelection()
        const line = sel.rangeCount ? topLevelChild(rootRef.current, sel.anchorNode) : null
        const prev = line?.previousElementSibling
        if (line?.dataset?.level && prev?.dataset?.level === line.dataset.level && !line.textContent) {
          setLevel(line, 0)
          emit()
        }
      }, 0)
    }
  }

  const onPaste = (e) => {
    const files = imageFiles(e.clipboardData?.files)
    if (files.length) { e.preventDefault(); insertFiles(files); return }
    const text = e.clipboardData?.getData('text/plain')
    if (text != null) { e.preventDefault(); document.execCommand('insertText', false, text) }
  }

  const onDrop = (e) => {
    const files = imageFiles(e.dataTransfer?.files)
    if (files.length) { e.preventDefault(); insertFiles(files); return }
    const text = e.dataTransfer?.getData('text/plain')
    e.preventDefault()
    if (!text) return
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY)
    if (range) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range) }
    document.execCommand('insertText', false, text)
  }

  const copySelection = (e, cut) => {
    const sel = window.getSelection()
    if (!sel.rangeCount || sel.isCollapsed) return
    const fragment = sel.getRangeAt(0).cloneContents()
    e.preventDefault()
    // Synchronous text first (always works); the async write below replaces it
    // with text + photos when the browser allows it.
    e.clipboardData.setData('text/plain', fragmentText(fragment))
    writeRichClipboard(fragment).catch((err) => console.error('Rich copy failed', err))
    if (cut) document.execCommand('delete')
  }

  return (
    <div
      ref={rootRef}
      className="note-body note-doc is-empty"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder}
      onInput={emit}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onDrop={onDrop}
      onCopy={(e) => copySelection(e, false)}
      onCut={(e) => copySelection(e, true)}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        const last = e.currentTarget.lastElementChild
        if (!last) return
        const range = document.createRange()
        range.selectNodeContents(last.dataset?.id ? e.currentTarget : last)
        range.collapse(false)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      }}
    />
  )
})

export default NoteEditor
