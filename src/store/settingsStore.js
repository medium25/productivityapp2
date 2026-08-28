import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SECTIONS } from '../constants/sections.js'

// Default visibility map: every section from sections.js starts visible.
const defaultVisibleSections = SECTIONS.reduce((acc, section) => {
  acc[section.id] = true
  return acc
}, {})

// Settings store: language, theme and per-section visibility.
// Persisted to localStorage so preferences survive a reload.
// Note: `language` only stores the chosen value for now — actual i18n
// wiring (react-i18next) happens in a later task.
export const useSettingsStore = create(
  persist(
    (set) => ({
      language: 'ru',
      theme: 'light',
      visibleSections: defaultVisibleSections,

      setLanguage: (lang) => set({ language: lang }),

      setTheme: (theme) => set({ theme }),

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      toggleSectionVisibility: (id) =>
        set((state) => ({
          visibleSections: {
            ...state.visibleSections,
            [id]: !state.visibleSections[id],
          },
        })),
    }),
    {
      name: 'productivity-hub-settings',
    },
  ),
)

export default useSettingsStore
