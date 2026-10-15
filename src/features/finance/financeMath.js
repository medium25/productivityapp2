// src/features/finance/financeMath.js
//
// Pure date/aggregate helpers for the Finance section — no React, no store
// access, so they're trivially reusable from the store's own actions and
// from every tab component. Mirrors taskLogic.js's "pure helpers" pattern.

export function monthKeyOf(dateIso) {
  return dateIso.slice(0, 7)
}

// The month a transaction counts in: its own `period` when it has one (the
// sheet's September includes rows dated 1 октября), otherwise its date's month.
export function txMonthKey(tx) {
  return tx.period || monthKeyOf(tx.date)
}

export function prevMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function nextMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(monthKey, language) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(language, { month: 'long', year: 'numeric' })
}

export function formatSom(amount) {
  const sign = amount < 0 ? '-' : ''
  const grouped = String(Math.round(Math.abs(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${sign}${grouped} сум`
}

export function sumTransactions(transactions, monthKey, type) {
  return transactions
    .filter((t) => t.type === type && txMonthKey(t) === monthKey)
    .reduce((sum, t) => sum + t.amount, 0)
}

export function categoryActuals(transactions, monthKey, type) {
  const result = {}
  transactions.forEach((t) => {
    if (t.type !== type || txMonthKey(t) !== monthKey) return
    result[t.categoryId] = (result[t.categoryId] || 0) + t.amount
  })
  return result
}

// Earliest month we have ANY knowledge of — the true floor for the
// carryover recursion below. Computed from historySeed's keys and every
// transaction's month-key; `null` when there's no data in the system at
// all (brand-new account), in which case every month is the floor.
function earliestKnownMonthKey(transactions, historySeed) {
  const keys = Object.keys(historySeed).concat(transactions.map((t) => txMonthKey(t)))
  if (keys.length === 0) return null
  return keys.reduce((min, k) => (k < min ? k : min))
}

// Recursively resolves a month's opening balance from the previous month's
// remaining balance — this is the whole point of the section: no more
// hand-copying last month's leftover into a new file. `historySeed` covers
// months before live transactions exist (Jan-Aug 2026, imported once from
// the user's old Numbers file — see financeSeedData.js); any month not in
// historySeed is computed purely from `transactions`.
//
// Recursion always walks back to prevMonthKey regardless of whether that
// specific month has its own data — an empty month in the middle of the
// chain still carries the previous month's remaining balance forward
// unchanged (only its own income/expense are 0). The recursion only
// bottoms out once monthKey is before the earliest month we have any
// knowledge of (or there's no data in the system at all), which is the
// real floor and keeps this from recursing forever.
export function monthSummary(monthKey, { transactions, historySeed }) {
  const seeded = historySeed[monthKey]
  // A seed entry marked `fromTransactions` only fixes the opening balance;
  // income and expense are still summed from the transactions.
  if (seeded && seeded.fromTransactions) {
    const income = sumTransactions(transactions, monthKey, 'income')
    const expense = sumTransactions(transactions, monthKey, 'expense')
    return { carry: seeded.carry, income, expense, remaining: seeded.carry + income - expense }
  }
  if (seeded) {
    const { carry, income, expense } = seeded
    return { carry, income, expense, remaining: carry + income - expense }
  }
  const floor = earliestKnownMonthKey(transactions, historySeed)
  if (floor === null || monthKey < floor) {
    return { carry: 0, income: 0, expense: 0, remaining: 0 }
  }
  const income = sumTransactions(transactions, monthKey, 'income')
  const expense = sumTransactions(transactions, monthKey, 'expense')
  const prevKey = prevMonthKey(monthKey)
  const carry = monthSummary(prevKey, { transactions, historySeed }).remaining
  return { carry, income, expense, remaining: carry + income - expense }
}

export function listHistoryMonthKeys(transactions, historySeed, currentKey) {
  const keys = new Set(Object.keys(historySeed))
  transactions.forEach((t) => keys.add(txMonthKey(t)))
  keys.add(currentKey)
  return Array.from(keys).sort()
}
