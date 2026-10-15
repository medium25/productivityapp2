import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

// Shared shape behind both "База знаний" and "Справочная информация" (see
// CardNotesPage.jsx) — free-form text cards, not structured fields, per
// user request ("буду писать знания в виде карточек"). One factory instead
// of two near-identical stores so the two sections can't drift apart.
export function createCardNotesStore(storageName) {
  return create(
    persist(
      (set) => ({
        // { id, text, createdAt, updatedAt }
        cards: [],

        addCard: (text) => {
          const trimmed = (text || '').trim()
          if (!trimmed) return
          set((state) => ({
            cards: [
              { id: crypto.randomUUID(), text: trimmed, createdAt: new Date().toISOString(), updatedAt: null },
              ...state.cards,
            ],
          }))
        },

        updateCard: (id, text) => {
          const trimmed = (text || '').trim()
          if (!trimmed) return
          set((state) => ({
            cards: state.cards.map((c) => (c.id === id ? { ...c, text: trimmed, updatedAt: new Date().toISOString() } : c)),
          }))
        },

        deleteCard: (id) => set((state) => ({ cards: state.cards.filter((c) => c.id !== id) })),

        // Drag-to-reorder (see useDragReorder.jsx, grab-anywhere-on-the-card)
        // — same "whole list replaced outright" shape as reorderHabits.
        reorderCards: (orderedIds) => set((state) => {
          const byId = new Map(state.cards.map((c) => [c.id, c]))
          return { cards: orderedIds.map((id) => byId.get(id)).filter(Boolean) }
        }),
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
