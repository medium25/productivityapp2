import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// A viewport/layout preference, not app data — kept in plain localStorage
// (not the Firestore-backed pattern the other stores use) on purpose: it's
// naturally per-device (a phone and a desktop window may want different
// defaults), it needs to be available instantly on first paint with no
// async round-trip, and it costs zero Firestore reads/writes.
export const useSidebarStore = create(
  persist(
    (set) => ({
      open: true,
      toggle: () => set((s) => ({ open: !s.open })),
      close: () => set({ open: false }),
    }),
    {
      name: 'productivity-hub-sidebar',
      partialize: (state) => ({ open: state.open }),
    }
  )
)
