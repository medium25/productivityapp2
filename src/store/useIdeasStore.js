import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'

// «Идеи» — the lower list on the Tasks page: things worth keeping but not yet
// a task. Kept in its own store (not as tasks with a flag) so ideas can never
// show up in «Мой день», habits, projects or any other list that reads tasks;
// «Сделать задачей» moves one into the tasks list and removes it from here.
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

export const useIdeasStore = create(
  persist(
    (set, get) => ({
      ideas: [], // { id, title, createdAt }

      addIdea: (title) => {
        const trimmed = (title || '').trim()
        if (!trimmed) return null
        const idea = { id: newId(), title: trimmed, createdAt: new Date().toISOString() }
        set((state) => ({ ideas: [...state.ideas, idea] }))
        return idea
      },

      updateIdea: (id, title) => {
        const trimmed = (title || '').trim()
        if (!trimmed) return
        set((state) => ({ ideas: state.ideas.map((i) => (i.id === id ? { ...i, title: trimmed } : i)) }))
      },

      deleteIdea: (id) => set((state) => ({ ideas: state.ideas.filter((i) => i.id !== id) })),

      // `orderedIds` is the new order of the whole list (drag-to-reorder).
      reorderIdeas: (orderedIds) => {
        const byId = new Map(get().ideas.map((i) => [i.id, i]))
        const next = orderedIds.map((id) => byId.get(id)).filter(Boolean)
        const seen = new Set(orderedIds)
        get().ideas.forEach((i) => { if (!seen.has(i.id)) next.push(i) })
        set({ ideas: next })
      },
    }),
    {
      name: 'productivity-hub-ideas',
      storage: createFirestoreStorage('productivity-hub-ideas'),
      skipHydration: true,
      partialize: (state) => ({ ideas: state.ideas }),
    }
  )
)
