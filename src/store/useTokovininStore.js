import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

// Reading progress through Mikhail Tokovinin's channel (see TokovininPage).
// The posts themselves ship with the app (src/data/tokovinin) — only which
// ones are checked off lives in Firestore, so Mac and iPhone stay in step.
export const useTokovininStore = create(
  persist(
    (set) => ({
      doneIds: {},
      setDone: (id, done) => set((state) => {
        const doneIds = { ...state.doneIds }
        if (done) doneIds[id] = true
        else delete doneIds[id]
        return { doneIds }
      }),
    }),
    {
      name: 'productivity-hub-tokovinin',
      storage: createFirestoreStorage('productivity-hub-tokovinin'),
      skipHydration: true,
      partialize: (state) => ({ doneIds: state.doneIds }),
    }
  )
)
