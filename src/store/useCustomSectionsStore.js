import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

// User-created duplicates of the GTD board — each just gets its own nav
// entry/route pointing back at GtdBoardPage, sharing the same tasks/projects
// data. Creating new ones is disabled (the "+ Add section" button was
// removed per user request); rename/remove stay available for whatever
// duplicates already exist.
export const useCustomSectionsStore = create(
  persist(
    (set) => ({
      sections: [], // { id, name }

      renameSection: (id, name) => {
        const trimmed = (name || '').trim()
        if (!trimmed) return
        set((state) => ({
          sections: state.sections.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
        }))
      },

      removeSection: (id) => set((state) => ({
        sections: state.sections.filter((s) => s.id !== id),
      })),
    }),
    {
      name: 'productivity-hub-custom-sections',
      storage: createFirestoreStorage('productivity-hub-custom-sections'),
      skipHydration: true,
      partialize: (state) => ({ sections: state.sections }),
    }
  )
)
