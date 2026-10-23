// Phone helpers for the web version (iPhone, home-screen app):
//  - keyboard-aware: --kb holds the on-screen keyboard height so bottom sheets
//    sit above it, and body.kb-open hides the bottom tab bar while typing;
//  - pull-to-refresh: drag down at the top of a page to re-read data from
//    Firestore (a home-screen app has no reload button);
//  - auto-refresh when the app comes back to the foreground after a while;
//  - a one-time "Add to Home Screen" hint for iOS Safari (iOS has no install prompt).
import { getCurrentUid } from '../firebase/currentUid'
import { refreshPersistedStores } from '../store/rehydrateStores'

const PULL_TRIGGER_PX = 80
const PULL_ARM_MS = 350 // matches useDragReorder's long press: holding still means drag, not pull
const AUTO_REFRESH_AFTER_MS = 60 * 1000
const HINT_KEY = 'arkad:installHint'

const isPhone = () => matchMedia('(max-width: 720px)').matches
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isEditing = () => {
  const el = document.activeElement
  return !!el && (el.matches('input, textarea, select') || el.isContentEditable)
}

let refreshing = null
function refresh() {
  if (!getCurrentUid()) return Promise.resolve()
  if (!refreshing) refreshing = refreshPersistedStores().finally(() => { refreshing = null })
  return refreshing
}

function keyboard() {
  const vv = window.visualViewport
  if (!vv) return
  const root = document.documentElement
  const update = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    root.style.setProperty('--kb', `${kb}px`)
    document.body.classList.toggle('kb-open', kb > 120)
  }
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  update()
}

// Is anything between the touched element and the page scrolled down? Then
// the finger is scrolling content back up, not pulling to refresh.
function scrolledAbove(el) {
  for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
    if (n.scrollTop > 0) return true
  }
  return window.scrollY > 0
}

function pullToRefresh() {
  const pill = document.createElement('div')
  pill.className = 'ptr'
  document.body.appendChild(pill)
  let start = null
  let pull = 0
  const hide = () => { pill.style.opacity = '0'; pill.style.transform = '' }
  const blocked = (t) =>
    !isPhone() || isEditing() ||
    t.closest('input, textarea, [contenteditable="true"], .task-modal-overlay, .habits-modal-backdrop, .sidebar') ||
    document.querySelector('.task-modal-overlay, .habits-modal-backdrop')

  addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || blocked(e.target) || scrolledAbove(e.target)) { start = null; return }
    start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
    pull = 0
  }, { passive: true })

  addEventListener('touchmove', (e) => {
    if (!start) return
    const dx = e.touches[0].clientX - start.x
    const dy = e.touches[0].clientY - start.y
    if (pull === 0 && Math.hypot(dx, dy) < 8) {
      // Held still past the long-press time: that's a row drag, not a pull.
      if (Date.now() - start.t > PULL_ARM_MS) start = null
      return
    }
    if (dy <= 0 || Math.abs(dx) > dy) { start = null; if (pull) hide(); pull = 0; return }
    pull = dy
    pill.textContent = pull > PULL_TRIGGER_PX ? 'Отпусти — обновлю' : 'Потяни, чтобы обновить'
    pill.style.transform = `translate(-50%, ${Math.min(pull, 100) - 64}px)`
    pill.style.opacity = String(Math.min(1, pull / 60))
  }, { passive: true })

  addEventListener('touchend', async () => {
    if (!start) return
    const go = pull > PULL_TRIGGER_PX
    start = null
    pull = 0
    if (!go) { hide(); return }
    pill.textContent = 'Обновляю…'
    pill.style.transform = 'translate(-50%, 14px)'
    try {
      await refresh()
      navigator.vibrate?.(15)
      pill.textContent = 'Обновлено'
    } catch {
      pill.textContent = 'Не удалось обновить'
    }
    setTimeout(hide, 700)
  })
}

function autoRefresh() {
  let hiddenAt = 0
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
    if (hiddenAt && Date.now() - hiddenAt > AUTO_REFRESH_AFTER_MS && !isEditing()) refresh().catch(() => {})
  })
}

function installHint() {
  let dismissed = false
  try { dismissed = localStorage.getItem(HINT_KEY) === '1' } catch { /* private mode */ }
  const force = location.search.includes('ioshint')
  if (!force && (!isIOS() || isStandalone() || dismissed)) return
  const box = document.createElement('div')
  box.className = 'install-hint'
  box.setAttribute('role', 'note')
  box.innerHTML = `
    <div class="install-hint__icon"></div>
    <p><b>Установи ARKAD как приложение.</b> Нажми
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Поделиться"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/></svg>
      «Поделиться», затем <b>«На экран „Домой“»</b>.</p>
    <button type="button">Понятно</button>`
  document.body.appendChild(box)
  setTimeout(() => box.classList.add('install-hint--show'), 2500)
  box.querySelector('button').onclick = () => {
    box.classList.remove('install-hint--show')
    try { localStorage.setItem(HINT_KEY, '1') } catch { /* private mode */ }
  }
}

export function initPhoneHelpers() {
  if (window.__TAURI_INTERNALS__) return // the desktop app has its own window chrome
  document.documentElement.classList.toggle('standalone', isStandalone())
  keyboard()
  pullToRefresh()
  autoRefresh()
  installHint()
}
