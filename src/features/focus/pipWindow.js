// Document Picture-in-Picture floats a real OS-level window above every
// app, not just the browser tab — the closest the web platform gets to
// "always on top". Chromium-only (Chrome/Edge/Opera); Safari and Firefox
// don't implement it.
export const PIP_SUPPORTED = typeof window !== 'undefined' && 'documentPictureInPicture' in window

function copyStylesInto(doc) {
  ;[...document.styleSheets].forEach((sheet) => {
    try {
      const rules = [...sheet.cssRules].map((r) => r.cssText).join('\n')
      const style = doc.createElement('style')
      style.textContent = rules
      doc.head.appendChild(style)
    } catch {
      if (sheet.href) {
        const link = doc.createElement('link')
        link.rel = 'stylesheet'
        link.href = sheet.href
        doc.head.appendChild(link)
      }
    }
  })
}

// Shared so it can be triggered both from the main timer screen and from
// the small floating widget — either way it's the same OS window, and it
// must be opened directly inside a click handler (transient activation).
export async function openPipWindow() {
  if (!PIP_SUPPORTED) return null
  // Sized for the larger countdown digits (.focus-timer-pip__time) — the
  // old 120x64 window was tuned for a much smaller font and would clip it.
  const pw = await window.documentPictureInPicture.requestWindow({ width: 220, height: 120 })
  copyStylesInto(pw.document)
  pw.document.body.style.margin = '0'
  return pw
}
