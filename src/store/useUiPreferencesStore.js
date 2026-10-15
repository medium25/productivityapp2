import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Remembers the open/collapsed state of the various collapsible
// sections/folders scattered across the app (Tasks page date sections,
// the completed-projects folder in Focus, etc.) so reopening the app lands
// back where the user left it, instead of resetting to the default every
// time. Same reasoning as useSidebarStore.js: this is a per-device layout
// preference, not app data, so it's plain localStorage — no Firestore cost,
// no async hydration delay.
export const useUiPreferencesStore = create(
  persist(
    (set, get) => ({
      collapsed: {},
      isCollapsed: (key, defaultValue = false) => {
        const value = get().collapsed[key]
        return value === undefined ? defaultValue : value
      },
      toggleCollapsed: (key, defaultValue = false) => set((state) => ({
        collapsed: {
          ...state.collapsed,
          [key]: !(state.collapsed[key] === undefined ? defaultValue : state.collapsed[key]),
        },
      })),
      // Manually-resized panel widths (per user request — see
      // useResizablePanel.js), same per-device/no-Firestore reasoning as
      // `collapsed` above: which pixel width someone dragged a rail to on
      // this one screen isn't meaningful app data.
      panelWidths: {},
      setPanelWidth: (key, width) => set((state) => ({
        panelWidths: { ...state.panelWidths, [key]: width },
      })),

      // Start of the working day for the Tasks page's timed lists (minutes
      // from midnight, default 09:00).
      dayStartMinutes: 540,
      setDayStartMinutes: (m) => set({ dayStartMinutes: m }),

      // Legacy, read-only: bubble colors now live in useChatColorsStore
      // (Firestore). Kept so its one-time migration can still read what was
      // picked on this device.
      chatBubbleColors: {},
    }),
    {
      name: 'productivity-hub-ui-preferences',
      partialize: (state) => ({
        collapsed: state.collapsed,
        panelWidths: state.panelWidths,
        dayStartMinutes: state.dayStartMinutes,
        chatBubbleColors: state.chatBubbleColors,
      }),
    }
  )
)
