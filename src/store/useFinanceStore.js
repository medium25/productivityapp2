// src/store/useFinanceStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirestoreStorage } from '../firebase/firestoreStorage'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SEPTEMBER_TRANSACTIONS, SEPTEMBER_BUDGET, FUND_OPENING } from '../features/finance/financeSeedData'
import { monthKeyOf } from '../features/finance/financeMath'

// Bumped whenever the imported September data is replaced (v2 = the sheet's
// full list: 64 expenses, 50 incomes, opening balance 5 076 000; v3 adds the
// later rows of the sheet and the opening balances by kind of funds).
const SEED_VERSION = 3

// The Finance section (see FinancePage.jsx) — replaces the user's manual
// monthly Numbers-file workflow. Only raw transactions/categories/budgets
// are stored; every derived number (category actuals, remaining-vs-plan,
// carried-over balance) is computed on read by financeMath.js, never
// hand-synced, so there's no monthly resum step anymore.
export const useFinanceStore = create(
  persist(
    (set) => ({
      transactions: [],
      // Exchanges between kinds of funds (cash / card / usd): not income or
      // expense, the total balance stays put. { id, date, from, to, amount (сум),
      // rate (сум per $, only when dollars are involved) }.
      transfers: [],
      categories: [],
      budgets: {},
      seeded: false,
      seedVersion: 0,
      // Opening money by kind of funds ({ cash, card, usd }); operations and
      // exchanges move the balances from here.
      fundOpening: { cash: 0, card: 0, usd: 0 },

      // Seeding now happens exclusively in onRehydrateStorage below, gated
      // on the real Firestore read having completed (see that callback for
      // why: skipHydration means a component-mount call to this used to be
      // able to race the async read and re-import the real September data
      // with fresh UUIDs, overwriting it via setDoc). Kept as an inert
      // no-op — rather than removed — purely so any caller still invoking
      // it (e.g. a page-mount effect) can't do anything unsafe by calling
      // it at the wrong time.
      ensureSeeded: () => {},

      // `note` is the free-text comment (expenses), `fund` is where the money
      // sits: 'cash' | 'card' | 'usd'.
      addTransaction: (type, date, categoryId, amount, note = '', fund = 'cash') => set((state) => ({
        transactions: [...state.transactions, { id: crypto.randomUUID(), type, date, categoryId, amount, note, fund }],
      })),

      addTransfer: ({ date, from, to, amount, rate = null }) => set((state) => ({
        transfers: [...(state.transfers || []), { id: crypto.randomUUID(), date, from, to, amount, rate }],
      })),

      deleteTransfer: (id) => set((state) => ({
        transfers: (state.transfers || []).filter((x) => x.id !== id),
      })),

      updateTransaction: (id, patch) => set((state) => ({
        transactions: state.transactions.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)),
      })),

      deleteTransaction: (id) => set((state) => ({
        transactions: state.transactions.filter((tx) => tx.id !== id),
      })),

      addCategory: (name, type) => {
        const trimmed = (name || '').trim()
        if (!trimmed) return
        set((state) => ({
          categories: [...state.categories, { id: crypto.randomUUID(), name: trimmed, type }],
        }))
      },

      renameCategory: (id, name) => {
        const trimmed = (name || '').trim()
        if (!trimmed) return
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
        }))
      },

      // No-op (keeps the category) when any transaction still references
      // it — otherwise Operations falls back to showing the raw id,
      // Budget silently drops the category's actuals from its totals, and
      // History's month total (which sums all transactions regardless of
      // category) ends up disagreeing with Budget's fact-total with no
      // warning. Deleting is only safe once nothing points at the id.
      deleteCategory: (id) => set((state) => {
        const inUse = state.transactions.some((tx) => tx.categoryId === id)
        if (inUse) return state
        return { categories: state.categories.filter((c) => c.id !== id) }
      }),

      // Plan (REJA) is entered fresh each month per user request — no
      // auto-copy from the previous month's budgets entry.
      setBudget: (monthKey, categoryId, amount) => set((state) => ({
        budgets: {
          ...state.budgets,
          [monthKey]: { ...(state.budgets[monthKey] || {}), [categoryId]: amount },
        },
      })),
    }),
    {
      name: 'productivity-hub-finance',
      storage: createFirestoreStorage('productivity-hub-finance'),
      skipHydration: true,
      partialize: (state) => ({
        transactions: state.transactions,
        transfers: state.transfers,
        categories: state.categories,
        budgets: state.budgets,
        seeded: state.seeded,
        seedVersion: state.seedVersion,
        fundOpening: state.fundOpening,
      }),
      // Runs once after rehydrateAllPersistedStores() reads the real
      // Firestore document back (see ../store/rehydrateStores.js) — same
      // "mutate `state` in place before hydration finishes" pattern as
      // usePrinciplesStore.js / useFocusTimerStore.js. Seeding must happen
      // here, not from a component-mount effect: skipHydration means the
      // Firestore read is async, so a mount effect can run while `seeded`
      // is still the initial in-memory `false`, re-importing the real
      // September data with fresh UUIDs and overwriting the live document
      // via setDoc. Gating on the just-loaded `state.seeded` instead of
      // in-memory state closes that race.
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return
        if (state.seeded) {
          // One-time replacement of September with the sheet's exact data
          // (everything the user entered in other months stays untouched).
          if ((state.seedVersion || 1) < SEED_VERSION) {
            // Drops September and any earlier-imported 1 October rows (those have
            // no `fund`; rows the user typed in the app always do).
            const keep = (state.transactions || []).filter((tx) => (
              monthKeyOf(tx.date) !== '2026-09' && tx.period !== '2026-09' && !(tx.date === '2026-10-01' && !tx.fund)
            ))
            state.transactions = [
              ...keep,
              ...SEPTEMBER_TRANSACTIONS.map((tx) => ({ id: crypto.randomUUID(), note: '', ...tx })),
            ]
            state.budgets = { ...(state.budgets || {}), '2026-09': { ...SEPTEMBER_BUDGET } }
            state.fundOpening = { ...FUND_OPENING }
            state.seedVersion = SEED_VERSION
          }
          return
        }
        state.transactions = SEPTEMBER_TRANSACTIONS.map((tx) => ({ id: crypto.randomUUID(), note: '', ...tx }))
        state.categories = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
        state.budgets = { '2026-09': { ...SEPTEMBER_BUDGET } }
        state.seeded = true
        state.fundOpening = { ...FUND_OPENING }
        state.seedVersion = SEED_VERSION
      },
    }
  )
)
