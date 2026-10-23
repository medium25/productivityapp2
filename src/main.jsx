import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './i18n'
import App from './App.jsx'
import { initPhoneHelpers } from './mobile/phoneHelpers'
import { useAuthStore } from './store/useAuthStore'
import { useFocusTimerStore } from './store/useFocusTimerStore'
import { useFocusStore } from './store/useFocusStore'

// TEMP DEBUG — remove before shipping
window.__debugAuth = useAuthStore
window.__debugTimer = useFocusTimerStore
window.__debugFocus = useFocusStore

initPhoneHelpers()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
