// Stops the browser from starting a text selection when a drag begins on a
// row. Applied from pointerdown (not once the drag threshold trips) — the
// selection starts on the very first mouse move, so guarding later left
// neighbouring rows highlighted. WebKit (Tauri) needs the prefixed property
// and a selectstart veto on top of user-select.
const blockSelect = (e) => e.preventDefault()

export function suppressSelectionForPointer(e) {
  if (e?.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
  document.body.style.userSelect = 'none'
  document.body.style.webkitUserSelect = 'none'
  window.addEventListener('selectstart', blockSelect)
  window.getSelection?.()?.removeAllRanges()
  const end = () => {
    window.removeEventListener('selectstart', blockSelect)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    document.body.style.userSelect = ''
    document.body.style.webkitUserSelect = ''
  }
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
}
