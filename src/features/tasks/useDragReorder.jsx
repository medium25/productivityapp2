import { useLayoutEffect, useRef, useState } from 'react'
import { suppressSelectionForPointer } from './suppressSelection'
import { createPortal } from 'react-dom'

const THRESHOLD_PX = 6
const PROJECT_ATTR = 'data-drop-project-id'
const NEW_PROJECT_ATTR = 'data-drop-new-project'
const SECTION_ATTR = 'data-drop-section'
const CROSS_DROP_SELECTOR = `[${PROJECT_ATTR}], [${NEW_PROJECT_ATTR}], [${SECTION_ATTR}]`
const CROSS_DROP_HOVER_CLASS = 'sidebar__link--drop-hover'

function ghostTransform({ x, y }) {
  return `translate3d(${x + 14}px, ${y + 14}px, 0) rotate(-2deg)`
}

function computeDisplayOrder(baseIds, dragId, overIndex) {
  if (dragId == null) return baseIds
  const from = baseIds.indexOf(dragId)
  if (from === -1) return baseIds
  const to = overIndex == null ? from : overIndex
  const next = baseIds.slice()
  next.splice(from, 1)
  next.splice(to, 0, dragId)
  return next
}

// Pointer-based vertical drag-to-reorder for any list of 2+ items — grab
// anywhere on the row (not a dedicated handle), per user request. `ids` is
// the list's current order (the caller must keep this array reference
// stable across re-renders that aren't a reorder, e.g. via useMemo); on
// drop, `onReorder(newIds)` fires once with the full new order for that
// list. Doesn't touch anything outside this one list — see reorderTasks/
// reorderProjects in useTasksStore for how a subset's new order gets
// reslotted into the full underlying array.
//
// `crossDrop` is optional (only task lists pass it, see InboxPage.jsx/
// ActionColumnBoard.jsx/ProjectDetailPage.jsx) — every pointermove during a
// drag also checks whatever's directly under the pointer, regardless of
// which page that element belongs to (the drag doesn't know or care it
// started on a totally different part of the DOM tree — that's what makes
// "drag a task from anywhere onto anywhere" work per user request):
//   - onCrossDrop(id, projectId): dropped on an existing project row (see
//     Sidebar.jsx's data-drop-project-id) — assigns the task to it.
//   - onCrossDropNewProject(id): dropped on the "Projects" section link
//     itself (data-drop-new-project) — the task turns into a brand new
//     project (see the callers for what that means for the original task).
//   - onCrossDropSection(id, sectionKey): dropped on Inbox/Next/Upcoming/
//     Sometime's own sidebar link (data-drop-section) — moves the task
//     into that section (see taskLogic.js's patchForSectionMove).
export function useDragReorder(ids, onReorder, crossDrop = {}) {
  // Lets a whole section become a cross-drop target (see UpcomingPage.jsx's
  // 3-lane board, data-drop-section on each lane's own column) without
  // that also swallowing in-lane reordering for a drag that already
  // started in that same lane — a match against this list's *own* section
  // key is treated as "not actually a cross-drop target", falling through
  // to the normal nearest-card reorder logic below instead. Optional; only
  // UpcomingPage.jsx passes it, every other data-drop-section caller
  // (Sidebar links) keeps working exactly as before.
  const { onCrossDrop, onCrossDropNewProject, onCrossDropSection, selfSectionKey, grid } = crossDrop
  const hasCrossDrop = !!(onCrossDrop || onCrossDropNewProject || onCrossDropSection)
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverIndex, setDragOverIndexState] = useState(null)
  // A small "ghost" label follows the cursor while dragging — per user
  // request, dragging a task across sections (onto a sidebar target) used
  // to show nothing near the pointer, just the original row fading in
  // place. `pointerPos` is only set once an actual drag starts (past
  // THRESHOLD_PX), same gate as draggingId.
  const [draggingLabel, setDraggingLabel] = useState(null)
  // Ghost position is written straight to the DOM (no setState per
  // pointermove) — a re-render of the host on every mouse move was the
  // source of drag lag.
  const pointerPosRef = useRef(null)
  const ghostRef = useRef(null)
  const dragOverIndexRef = useRef(null)
  const nodeRefs = useRef({})
  const dragInfo = useRef(null)
  const crossTargetRef = useRef(null)

  const setDragOverIndex = (i) => { dragOverIndexRef.current = i; setDragOverIndexState(i) }

  const displayOrder = computeDisplayOrder(ids, draggingId, dragOverIndex)

  // FLIP animation (per user report — reordering "wasn't smoother", cards
  // used to just jump to their new slot instantly on every pointermove).
  // Records each item's position before this render's reorder takes
  // effect; after the DOM actually moves, offsets each shifted item back
  // to where it *was* with no transition, then releases it in the same
  // frame with one — the browser animates the release, not the reorder
  // itself, which is what makes a live-reordering list read as smooth
  // instead of jumpy. Includes the dragged item itself (per user report —
  // excluding it left no visible sign of *where* it was actually landing,
  // it just silently snapped into its new slot) — it glides into its own
  // target spot the same way every other card does, on top of its own
  // lifted styling (see .task-card-reorder--dragging).
  const prevRectsRef = useRef({})
  useLayoutEffect(() => {
    const nextRects = {}
    displayOrder.forEach((id) => {
      const node = nodeRefs.current[id]
      if (!node) return
      nextRects[id] = node.getBoundingClientRect()
      const prev = prevRectsRef.current[id]
      if (!prev) return
      const dy = prev.top - nextRects[id].top
      // Only animates while an actual drag is live, and only a plausible
      // in-list reorder distance — per user report, a large gap here (a
      // row's own height changing from an unrelated CSS/layout update
      // landing between renders, not a real drag) produced a jarring
      // overlapping-border glitch instead of a subtle release animation.
      // A real reorder never moves a row further than the visible list.
      if (!dy || !draggingId || Math.abs(dy) > 400) return
      node.style.transition = 'none'
      node.style.transform = `translateY(${dy}px)`
      requestAnimationFrame(() => {
        node.style.transition = 'transform 160ms ease'
        node.style.transform = ''
        window.setTimeout(() => { node.style.transition = '' }, 180)
      })
    })
    prevRectsRef.current = nextRects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayOrder.join('|'), draggingId])

  const setNodeRef = (id) => (el) => {
    if (el) nodeRefs.current[id] = el
    else delete nodeRefs.current[id]
  }

  const clearCrossTarget = () => {
    if (crossTargetRef.current) {
      crossTargetRef.current.el.classList.remove(CROSS_DROP_HOVER_CLASS)
      crossTargetRef.current = null
    }
  }

  const handleMove = (e) => {
    const info = dragInfo.current
    if (!info) return
    if (!info.dragging) {
      if (Math.hypot(e.clientX - info.startX, e.clientY - info.startY) < THRESHOLD_PX) return
      info.dragging = true
      // Row midpoints in the ORIGINAL layout, captured once. Target slot is
      // derived from these, not from the live (already reshuffled) DOM —
      // with rows of different heights the live layout shifts under the
      // cursor and the nearest slot flip-flopped, which read as lag.
      info.baseMids = info.baseIds
        .filter((id) => id !== info.id)
        .map((id) => {
          const node = nodeRefs.current[id]
          if (!node) return null
          const r = node.getBoundingClientRect()
          return r.top + r.height / 2
        })
        .filter((m) => m != null)
      // Grid layouts (e.g. project cards, 2+ per row): target = the other
      // item whose center is nearest to the pointer, in 2D.
      if (grid) {
        info.baseCenters = info.baseIds
          .filter((id) => id !== info.id)
          .map((id) => {
            const node = nodeRefs.current[id]
            if (!node) return null
            const r = node.getBoundingClientRect()
            return { id, x: r.left + r.width / 2, y: r.top + r.height / 2 }
          })
          .filter(Boolean)
      }
      setDraggingId(info.id)
      setDraggingLabel(info.label)
      document.body.style.userSelect = 'none'
      document.body.classList.add('is-dragging')
      // Drop any text the browser started selecting in the few px before
      // the drag threshold tripped (per user report — dragging a chat
      // message left a trail of highlighted text in the messages below).
      window.getSelection?.()?.removeAllRanges()
    }
    pointerPosRef.current = { x: e.clientX, y: e.clientY }
    if (ghostRef.current) ghostRef.current.style.transform = ghostTransform(pointerPosRef.current)

    if (hasCrossDrop) {
      let el = document.elementFromPoint(e.clientX, e.clientY)?.closest(CROSS_DROP_SELECTOR) || null
      if (el && selfSectionKey && el.getAttribute(SECTION_ATTR) === selfSectionKey) el = null
      if (el !== crossTargetRef.current?.el) {
        clearCrossTarget()
        if (el) {
          el.classList.add(CROSS_DROP_HOVER_CLASS)
          crossTargetRef.current = {
            el,
            kind: el.hasAttribute(NEW_PROJECT_ATTR) ? 'new-project' : el.hasAttribute(SECTION_ATTR) ? 'section' : 'project',
          }
        }
      }
      // Over a cross-drop target — don't also shuffle this list's own
      // order underneath the drag, the two gestures would fight visually.
      if (crossTargetRef.current) return
    }

    let nearestIndex = 0
    if (grid) {
      let best = Infinity
      nearestIndex = info.baseIds.indexOf(info.id)
      info.baseCenters.forEach((c) => {
        const d = Math.hypot(e.clientX - c.x, e.clientY - c.y)
        if (d < best) { best = d; nearestIndex = info.baseIds.indexOf(c.id) }
      })
    } else {
      info.baseMids.forEach((mid) => { if (e.clientY > mid) nearestIndex += 1 })
    }
    if (nearestIndex === dragOverIndexRef.current) return
    setDragOverIndex(nearestIndex)
  }

  const handleUp = () => {
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    document.body.style.userSelect = ''
    document.body.classList.remove('is-dragging')
    const info = dragInfo.current
    dragInfo.current = null
    if (info?.dragging) {
      // A real drag just happened — swallow the click the browser is about
      // to fire on whatever's under the pointer (e.g. the title button),
      // same as GtdBoardPage's cross-column drag. Scoped to that specific
      // element (capture-phase, so it also catches clicks on its
      // descendants) rather than `window` — a `window` listener used to
      // swallow the *next* click anywhere on the page, which for a
      // cross-drop that opens a follow-up prompt (see
      // ProjectAssignPrompt.jsx/DueRequiredPrompt.jsx) meant the user's
      // first click on that prompt's own buttons silently did nothing,
      // reading as the whole card "hanging" — the prompt lives in a
      // completely different part of the DOM, not under whatever was
      // under the pointer at drop time.
      const swallowTarget = crossTargetRef.current?.el || nodeRefs.current[info.id] || window
      swallowTarget.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault() }, { capture: true, once: true })
      if (crossTargetRef.current) {
        const { el, kind } = crossTargetRef.current
        // Optional-chained — not every caller wires up all three (project
        // reordering only passes onCrossDropSection, see TaskColumn's
        // bindProjectHandle in ActionColumnBoard.jsx). Calling a handler
        // that's genuinely undefined here used to throw mid-drop, which
        // aborted this function before the drag-state resets below ever
        // ran — the card was then stuck permanently mid-drag ("hangs" per
        // user report) instead of just no-op'ing the unsupported drop.
        if (kind === 'new-project') onCrossDropNewProject?.(info.id)
        else if (kind === 'section') onCrossDropSection?.(info.id, el.getAttribute(SECTION_ATTR))
        else onCrossDrop?.(info.id, el.getAttribute(PROJECT_ATTR))
      } else {
        const finalOrder = computeDisplayOrder(info.baseIds, info.id, dragOverIndexRef.current)
        if (finalOrder.join('|') !== info.baseIds.join('|')) onReorder(finalOrder)
      }
    }
    clearCrossTarget()
    setDraggingId(null)
    setDragOverIndex(null)
    setDraggingLabel(null)
    pointerPosRef.current = null
  }

  // `label` is optional (e.g. project reordering doesn't pass one) — the
  // ghost just doesn't render without it.
  const bindHandle = (id, label) => ({
    ref: setNodeRef(id),
    onPointerDown: (e) => {
      if (e.button != null && e.button !== 0) return
      suppressSelectionForPointer(e)
      dragInfo.current = { id, label, startX: e.clientX, startY: e.clientY, dragging: false, baseIds: ids }
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
  })

  // Portaled straight to <body> — a scoped per-project drag (see
  // ProjectRow in UpcomingPage.jsx) mounts this from inside a <tbody>,
  // where a plain fixed-position div would get foster-parented out of the
  // table by the HTML parser instead of following the cursor.
  const dragGhost = draggingLabel
    ? createPortal(
        <div
          ref={(el) => {
            ghostRef.current = el
            if (el && pointerPosRef.current) el.style.transform = ghostTransform(pointerPosRef.current)
          }}
          className="drag-ghost"
          style={{ left: 0, top: 0, willChange: 'transform' }}
        >
          {draggingLabel}
        </div>,
        document.body
      )
    : null

  return { displayOrder, draggingId, bindHandle, dragGhost }
}
