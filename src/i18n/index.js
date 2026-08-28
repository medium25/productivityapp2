import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './ru.json'
import en from './en.json'
import uz from './uz.json'

// react-i18next initialization. Language switching is driven by
// src/store/settingsStore.js's `language` field: App.jsx syncs i18next to
// the persisted store value on load, and Settings.jsx calls
// i18n.changeLanguage() together with the store's setLanguage() whenever
// the user picks a different language.
i18next.use(initReactI18next).init({
  lng: 'ru',
  fallbackLng: 'ru',
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    uz: { translation: uz },
  },
  interpolation: {
    escapeValue: false,
  },
})

export default i18next
