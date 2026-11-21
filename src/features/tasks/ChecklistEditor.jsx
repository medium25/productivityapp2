import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { TASK_BULLET, TASK_BULLET_DONE, isTaskLine, isTaskLineDone, taskLineText } from './taskLogic'
import { useAutoGrowTextarea } from './useAutoGrowTextarea'

// Title editor with live checklist rings, like Apple Notes. The value is still
// the plain title text («○ » open / «● » done line prefixes, see taskLogic.js),
// but while editing each line is its own growing field and a checklist line
// shows its real ring — click it to tick the item, no need to leave edit mode.
//
//  - «--» typed in a plain line turns it into a checklist line (after some text:
//    starts a new checklist line below, like the Insights composer);
//  - Enter on a checklist line starts the next one (on an empty one it ends
//    the list); Enter on a plain line confirms; Shift+Enter is a new line;
//  - Backspace at the start of a checklist line removes the ring, at the start
//    of a plain line joins it to the line above;
//  - arrows move between lines at their edges; pasted multi-line text becomes
//    separate lines.

let seq = 0
const newId = () => `cl${++seq}`

const parse = (value) => (value || '').split('\n').map((line) => (
  isTaskLine(line)
    ? { id: newId(), task: true, done: isTaskLineDone(line), text: taskLineText(line) }
    : { id: newId(), task: false, done: false, text: line }
))
const serialize = (lines) => lines.map((l) => (l.task ? (l.done ? TASK_BULLET_DONE : TASK_BULLET) + l.text : l.text)).join('\n')
const capitalizeAfterSpace = (v) => (/\s/.test(v) && v ? v.charAt(0).toUpperCase() + v.slice(1) : v)

function LineArea({ value, taRef, ...props }) {
  const own = useAutoGrowTextarea(value)
  return (
    <textarea
      rows={1}
      value={value}
      ref={(el) => { own.current = el; taRef(el) }}
      {...props}
    />
  )
}

const Check = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

const ChecklistEditor = forwardRef(function ChecklistEditor({ value, onChange, onConfirm, onCancel, onBlurOut, autoFocus, placeholder, className }, ref) {
  const [lines, setLines] = useState(() => parse(value))
  const linesRef = useRef(lines)
  linesRef.current = lines
  const taRefs = useRef(new Map())
  const pending = useRef(null) // { id, pos } — where the caret goes after the next render
  const rootRef = useRef(null)

  // The value was changed from outside (e.g. the quick-add field cleared after
  // adding): start over from it, and keep the caret in the field if it was there.
  useEffect(() => {
    if (value === serialize(linesRef.current)) return
    const had = rootRef.current && rootRef.current.contains(document.activeElement)
    const next = parse(value)
    linesRef.current = next
    setLines(next)
    if (had) pending.current = { id: next[next.length - 1].id, pos: 'end' }
  }, [value])

  useLayoutEffect(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    const el = taRefs.current.get(p.id)
    if (!el) return
    el.focus()
    const pos = p.pos === 'end' ? el.value.length : p.pos
    el.setSelectionRange(pos, pos)
  })

  useEffect(() => {
    if (!autoFocus) return
    const last = linesRef.current[linesRef.current.length - 1]
    const el = taRefs.current.get(last.id)
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    focus: () => {
      const cur = linesRef.current
      const el = taRefs.current.get(cur[cur.length - 1].id)
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
    },
  }))

  const update = (next, focus) => {
    linesRef.current = next
    setLines(next)
    onChange(serialize(next))
    if (focus) pending.current = focus
  }
  const patch = (i, fields) => lines.map((l, k) => (k === i ? { ...l, ...fields } : l))
  const focusLine = (k, pos) => {
    const target = lines[k]
    if (!target) return
    const el = taRefs.current.get(target.id)
    if (!el) return
    el.focus()
    const p = pos === 'end' ? el.value.length : pos
    el.setSelectionRange(p, p)
  }

  const splitAt = (i, s, en, task) => {
    const l = lines[i]
    const created = { id: newId(), task, done: false, text: l.text.slice(en) }
    update([...lines.slice(0, i), { ...l, text: l.text.slice(0, s) }, created, ...lines.slice(i + 1)], { id: created.id, pos: 0 })
  }

  const onText = (i, e) => {
    const l = lines[i]
    const el = e.target
    const raw = el.value
    if (!l.task) {
      const cursor = el.selectionStart
      const len = (cursor >= 2 && raw.slice(cursor - 2, cursor) === '--') ? 2
        : (cursor >= 1 && raw[cursor - 1] === '—') ? 1
        : 0
      if (len > 0) {
        const before = raw.slice(0, cursor - len)
        const after = raw.slice(cursor)
        if (before.trim() === '') {
          update(patch(i, { task: true, done: false, text: before + after }), { id: l.id, pos: before.length })
        } else {
          const created = { id: newId(), task: true, done: false, text: after }
          update([...lines.slice(0, i), { ...l, text: before }, created, ...lines.slice(i + 1)], { id: created.id, pos: 0 })
        }
        return
      }
    }
    update(patch(i, { text: i === 0 ? capitalizeAfterSpace(raw) : raw }))
  }

  const onKey = (i, e) => {
    const l = lines[i]
    const el = e.target
    const s = el.selectionStart
    const en = el.selectionEnd
    if (e.key === 'Escape') { onCancel && onCancel(); return }
    if (e.nativeEvent && e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      if (l.task) {
        e.preventDefault()
        if (l.text === '') update(patch(i, { task: false, done: false }), { id: l.id, pos: 0 })
        else splitAt(i, s, en, true)
        return
      }
      e.preventDefault()
      if (e.shiftKey) splitAt(i, s, en, false)
      else onConfirm && onConfirm()
      return
    }
    if (e.key === 'Backspace' && s === 0 && en === 0) {
      if (l.task) {
        e.preventDefault()
        update(patch(i, { task: false, done: false }), { id: l.id, pos: 0 })
      } else if (i > 0) {
        e.preventDefault()
        const prev = lines[i - 1]
        update([...lines.slice(0, i - 1), { ...prev, text: prev.text + l.text }, ...lines.slice(i + 1)], { id: prev.id, pos: prev.text.length })
      }
      return
    }
    if (e.key === 'Delete' && s === en && s === l.text.length && i < lines.length - 1) {
      e.preventDefault()
      const next = lines[i + 1]
      update([...lines.slice(0, i), { ...l, text: l.text + next.text }, ...lines.slice(i + 2)], { id: l.id, pos: l.text.length })
      return
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && s === 0 && en === 0 && i > 0) {
      e.preventDefault()
      focusLine(i - 1, 'end')
      return
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && s === en && s === l.text.length && i < lines.length - 1) {
      e.preventDefault()
      focusLine(i + 1, 0)
    }
  }

  const onPaste = (i, e) => {
    const text = e.clipboardData && e.clipboardData.getData('text')
    if (!text || !text.includes('\n')) return
    e.preventDefault()
    const l = lines[i]
    const el = e.target
    const s = el.selectionStart
    const en = el.selectionEnd
    const before = l.text.slice(0, s)
    const after = l.text.slice(en)
    const parts = text.replace(/\r/g, '').split('\n')
    const made = parts.map((p, k) => {
      if (k === 0) {
        if (before === '' && isTaskLine(p)) return { ...l, task: true, done: isTaskLineDone(p), text: taskLineText(p) }
        return { ...l, text: before + p }
      }
      return isTaskLine(p)
        ? { id: newId(), task: true, done: isTaskLineDone(p), text: taskLineText(p) }
        : { id: newId(), task: false, done: false, text: p }
    })
    const lastMade = made[made.length - 1]
    const tail = lastMade.text.length
    made[made.length - 1] = { ...lastMade, text: lastMade.text + after }
    update([...lines.slice(0, i), ...made, ...lines.slice(i + 1)], { id: lastMade.id, pos: tail })
  }

  // Focus left the whole editor (not just moved between its lines) → done editing.
  const onBlur = () => {
    setTimeout(() => {
      const root = rootRef.current
      if (!root) return
      if (!root.contains(document.activeElement)) onBlurOut && onBlurOut()
    }, 0)
  }

  return (
    <div ref={rootRef} className={'title-edit' + (className ? ` ${className}` : '')} onBlur={onBlur}>
      {lines.map((l, i) => (
        <div key={l.id} className="title-edit__line">
          {l.task && (
            <button
              type="button"
              tabIndex={-1}
              className={'title-check__ring' + (l.done ? ' title-check__ring--done' : '')}
              onMouseDown={(e) => e.preventDefault()} // keep the caret where it is
              onClick={() => update(patch(i, { done: !l.done }))}
              aria-pressed={l.done}
            >
              {l.done && <Check />}
            </button>
          )}
          <LineArea
            className={'title-edit__ta' + (l.task && l.done ? ' title-edit__ta--done' : '')}
            value={l.text}
            taRef={(el) => { if (el) taRefs.current.set(l.id, el); else taRefs.current.delete(l.id) }}
            placeholder={lines.length === 1 && !l.text ? placeholder : undefined}
            onChange={(e) => onText(i, e)}
            onKeyDown={(e) => onKey(i, e)}
            onPaste={(e) => onPaste(i, e)}
          />
        </div>
      ))}
    </div>
  )
})

export default ChecklistEditor
