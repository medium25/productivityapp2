import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './i18n'
import App from './App.jsx'
import { useAuthStore } from './store/useAuthStore'
import { useFocusTimerStore } from './store/useFocusTimerStore'
import { useFocusStore } from './store/useFocusStore'

// TEMP DEBUG — remove before shipping
window.__debugAuth = useAuthStore
window.__debugTimer = useFocusTimerStore
window.__debugFocus = useFocusStore

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support (see public/sw.js) — production only, so dev's HMR isn't
// served stale from a cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => console.error('SW registration failed', err))
  })
}
