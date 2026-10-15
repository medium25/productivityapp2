import { create } from 'zustand'

// Tracks whether the full-screen Pomodoro view is currently open (so the
// floating widget, rendered at the app root, knows when to hide itself),
// and which project is selected. Both live here rather than as local state
// in FocusPage so the floating widget can jump straight to the running
// timer even when FocusPage is already mounted and won't remount on
// navigate('/focus') (react-router doesn't remount on a same-path navigate).
export const useFocusUiStore = create((set) => ({
  timerViewOpen: false,
  setTimerViewOpen: (timerViewOpen) => set({ timerViewOpen }),
  selectedProjectId: null,
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
  // The Document Picture-in-Picture window, if one is open. Lives here
  // (not as local state in FloatingTimerWidget) so the "open PiP" button on
  // the main timer screen can trigger and track the same window instance.
  pipWindow: null,
  setPipWindow: (pipWindow) => set({ pipWindow }),
}))
