import { create } from 'zustand'

// Split window (per user request): a button in the top-right corner splits the
// content area in two — the current page moves to the right half, the left half
// shows any other section. Session-only, so a restart opens a single window.
export const useSplitViewStore = create((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
}))
