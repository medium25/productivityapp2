import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

// Qaydlar ("Records/Notes") — small pinnable title+text reference cards in
// a grid, per user request: distinct from Data/Insights/Analysis (all
// chat feeds on createChatStore.js) — no messages, no media, just a flat
// list of { id, title, text, pinned } cards. See QaydlarPage.jsx for the
// grid itself.
function createNotesStore(storageName) {
  return create(
  persist(
    (set, get) => ({
      cards: [],

      addCard: (title, text) => {
        const id = crypto.randomUUID()
        set((state) => ({
          cards: [
            ...state.cards,
            {
              id,
              title: (title || '').trim(),
              text: (text || '').trim(),
              pinned: false,
              createdAt: new Date().toISOString(),
              editedAt: null,
            },
          ],
        }))
        return id
      },

      updateCard: (id, fields) => set((state) => ({
        cards: state.cards.map((c) => (
          c.id === id ? { ...c, ...fields, editedAt: new Date().toISOString() } : c
        )),
      })),

      deleteCard: (id) => set((state) => ({
        cards: state.cards.filter((c) => c.id !== id),
      })),

      togglePinned: (id) => set((state) => ({
        cards: state.cards.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
      })),
    }),
    {
      name: storageName,
      storage: createFirestoreStorage(storageName),
      skipHydration: true,
      partialize: (state) => ({ cards: state.cards }),
    }
  )
)
}

// "Заметки" and "Знания" are two separate collections of the same kind of card
// (per user request: the "Данные" section holds both).
export const useQaydlarStore = createNotesStore('productivity-hub-qaydlar')
export const useKnowledgeStore = createNotesStore('productivity-hub-knowledge')

export const NOTE_STORES = { notes: useQaydlarStore, knowledge: useKnowledgeStore }
