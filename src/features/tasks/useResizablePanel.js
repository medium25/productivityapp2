import { useCallback, useRef } from 'react'
import { useUiPreferencesStore } from '../../store/useUiPreferencesStore'

// Drag-to-resize for a fixed-width side rail (per user request — "сделай
// так чтобы можно было регулировать размер правой боковой панели вручную").
// `key` is whatever this particular panel wants to remember its width as
// (see useUiPreferencesStore.js's panelWidths) — a per-device preference,
// not app data, same as the collapsed-section map that store already
// holds. The handle sits on the panel's own left edge, so dragging it left
// (cursor moves toward smaller clientX) grows the panel and dragging right
// shrinks it — `direction: 'left'` (the default) flips that if a caller's
// handle instead sits on the panel's right edge.
export function useResizablePanel(key, { defaultWidth = 220, min = 160, max = 480, direction = 'left' } = {}) {
  const stored = useUiPreferencesStore((s) => s.panelWidths[key])
  const setPanelWidth = useUiPreferencesStore((s) => s.setPanelWidth)
  const width = typeof stored === 'number' ? stored : defaultWidth
  const dragInfo = useRef(null)

  const handlePointerDown = useCallback((e) => {
    if (e.button != null && e.button !== 0) return
    dragInfo.current = { startX: e.clientX, startWidth: width }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const onMove = (ev) => {
      const info = dragInfo.current
      if (!info) return
      const dx = ev.clientX - info.startX
      const delta = direction === 'left' ? -dx : dx
      const next = Math.min(max, Math.max(min, info.startWidth + delta))
      setPanelWidth(key, next)
    }
    const onUp = () => {
      dragInfo.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [key, width, min, max, direction, setPanelWidth])

  // Double-click the handle to snap back to the default width — the only
  // way back once dragged, otherwise a mis-drag is stuck until you find
  // this exact spot again.
  const handleDoubleClick = useCallback(() => {
    setPanelWidth(key, defaultWidth)
  }, [key, defaultWidth, setPanelWidth])

  return { width, handlePointerDown, handleDoubleClick }
}
