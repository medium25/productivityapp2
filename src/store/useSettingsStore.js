import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_ENABLED_SECTIONS } from '../constants/sections'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

export const useSettingsStore = create(
  persist(
    (set) => ({
      language: 'ru',
      theme: 'system',
      enabledSections: DEFAULT_ENABLED_SECTIONS,
      // Custom display names for the built-in sections (id -> name),
      // keyed separately from their i18n titleKey so a rename survives a
      // language switch instead of being overwritten by the translation.
      // Empty/blank name clears the override, reverting to the built-in
      // translated title.
      sectionNameOverrides: {},
      // Custom order for the sidebar's main nav rows (Analysis/Data/Tasks/
      // Habits/etc — see Sidebar.jsx's `orderableSections`), per user
      // request ("дай возможность перестановки пунктов по своему
      // усмотрению"). Empty by default — every section then falls back to
      // its built-in default position (Sidebar.jsx's own hardcoded order);
      // only ids the user has actually dragged end up in here, so a
      // newly-added section (like Qaydlar) always appears somewhere
      // sensible instead of needing a migration to insert it into old
      // saved orders.
      sidebarOrder: [],
      // null = pick randomly each time, matching the old default behavior.
      workStartRingtoneId: null,
      restStartRingtoneId: null,
      // Pomodoro session lengths — 25/5 by default, editable by clicking the
      // countdown on the (idle) project timer panel.
      workMinutes: 25,
      breakMinutes: 5,
      // Volume of the My Focus background ambient sound (0-1), sitting under
      // the Quran recitation. Adjustable in Settings > Focus.
      backgroundSoundVolume: 0.4,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setWorkStartRingtoneId: (workStartRingtoneId) => set({ workStartRingtoneId }),
      setRestStartRingtoneId: (restStartRingtoneId) => set({ restStartRingtoneId }),
      setWorkMinutes: (workMinutes) => set({ workMinutes: Math.min(180, Math.max(1, Math.round(workMinutes) || 25)) }),
      setBreakMinutes: (breakMinutes) => set({ breakMinutes: Math.min(60, Math.max(1, Math.round(breakMinutes) || 5)) }),
      setBackgroundSoundVolume: (v) => set({ backgroundSoundVolume: Math.min(1, Math.max(0, Math.round(v * 100) / 100)) }),
      // A missing key (section added after this account last saved its
      // settings) reads as enabled — see Sidebar.jsx's `!== false` filter —
      // so the flip has to start from that same effective value, not the
      // raw (possibly-undefined) stored one, or the first click on a
      // never-toggled section would flip undefined -> true (a no-op) instead
      // of actually turning it off.
      toggleSection: (id) =>
        set((state) => ({
          enabledSections: { ...state.enabledSections, [id]: state.enabledSections[id] === false },
        })),
      setSidebarOrder: (sidebarOrder) => set({ sidebarOrder }),
      setSectionName: (id, name) => set((state) => {
        const trimmed = (name || '').trim()
        const overrides = { ...state.sectionNameOverrides }
        if (trimmed) overrides[id] = trimmed
        else delete overrides[id]
        return { sectionNameOverrides: overrides }
      }),
    }),
    {
      name: 'productivity-hub-settings',
      storage: createFirestoreStorage('productivity-hub-settings'),
      skipHydration: true,
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
        enabledSections: state.enabledSections,
        sectionNameOverrides: state.sectionNameOverrides,
        sidebarOrder: state.sidebarOrder,
        workStartRingtoneId: state.workStartRingtoneId,
        restStartRingtoneId: state.restStartRingtoneId,
        workMinutes: state.workMinutes,
        breakMinutes: state.breakMinutes,
        backgroundSoundVolume: state.backgroundSoundVolume,
      }),
    }
  )
)
