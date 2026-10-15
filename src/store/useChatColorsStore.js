import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'
import { useUiPreferencesStore } from './useUiPreferencesStore'

// Custom bubble colors for InsightsChat.jsx (shared by Инсайты/Дневник/
// Входящие — see its `variant` prop), keyed `${variant}:${'normal'|'task'|
// 'reminder'}`. Lives in Firestore (not per-device localStorage like
// useUiPreferencesStore) so the desktop app and the web version show the
// same colors.
export const useChatColorsStore = create(
  persist(
    (set) => ({
      chatBubbleColors: {},
      setChatBubbleColor: (variant, type, color) => set((state) => ({
        chatBubbleColors: { ...state.chatBubbleColors, [`${variant}:${type}`]: color },
      })),
    }),
    {
      name: 'productivity-hub-chat-colors',
      storage: createFirestoreStorage('productivity-hub-chat-colors'),
      skipHydration: true,
      partialize: (state) => ({ chatBubbleColors: state.chatBubbleColors }),
      // One-time migration: colors picked before this store existed sit in
      // this device's localStorage (useUiPreferencesStore). Copy any that
      // Firestore doesn't already have, so the first signed-in device
      // publishes its colors and a device with newer choices isn't overwritten.
      onRehydrateStorage: () => (state) => {
        const legacy = useUiPreferencesStore.getState().chatBubbleColors || {}
        const current = state?.chatBubbleColors || {}
        const missing = Object.entries(legacy).filter(([key, color]) => color && !(key in current))
        if (missing.length === 0) return
        useChatColorsStore.setState({ chatBubbleColors: { ...current, ...Object.fromEntries(missing) } })
      },
    }
  )
)
