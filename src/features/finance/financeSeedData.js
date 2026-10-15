// src/features/finance/financeSeedData.js
//
// One-time import data, parsed from the user's September.numbers file
// (Table 1 = expenses, Transactions = income, Summary by Category = Sep
// budget plan, the monthly rollup table = Jan-Aug history). Blank "Sana"
// (day) cells in the source sheet follow the spreadsheet fill-down
// convention — a blank means "same day as the row above"; leading blanks
// before any day number appears default to the 1st. Totals below were
// verified against the source file's own computed totals (9 840 000 сум
// expense, 11 675 000 сум income) by parsing the exported CSVs with a
// script, not transcribed by hand.

export const EXPENSE_CATEGORIES = [
  { id: 'exp-nafs', name: 'Nafs', type: 'expense' },
  { id: 'exp-boshqa', name: 'Boshqa', type: 'expense' },
  { id: 'exp-obunalar', name: 'Obunalar', type: 'expense' },
  { id: 'exp-farzandim', name: 'Farzandim', type: 'expense' },
  { id: 'exp-biznesga', name: 'Biznesga', type: 'expense' },
  { id: 'exp-ayolim', name: 'Ayolim', type: 'expense' },
  { id: 'exp-sogliq', name: 'Sogliq', type: 'expense' },
  { id: 'exp-transport', name: 'Transport', type: 'expense' },
  { id: 'exp-rivojlanish', name: 'Rivojlanish', type: 'expense' },
  { id: 'exp-qarz', name: 'Qarz', type: 'expense' },
  { id: 'exp-oyim', name: 'Oyim', type: 'expense' },
  { id: 'exp-oilam', name: 'Oilam', type: 'expense' },
  { id: 'exp-ehson', name: 'Ehson', type: 'expense' },
  { id: 'exp-kiyim', name: 'Kiyim', type: 'expense' },
]

export const INCOME_CATEGORIES = [
  { id: 'inc-target', name: 'Target', type: 'income' },
  { id: 'inc-oylik', name: 'Oylik', type: 'income' },
  { id: 'inc-biznes', name: 'Biznes', type: 'income' },
  { id: 'inc-boshqa', name: 'Boshqa', type: 'income' },
]

// The sheet's list exactly (64 expenses = 11 116 000, 50 incomes = 13 375 000). The rows dated
// "1 окт" are October's: they keep their real date 2026-10-01 and count in
// October, not September (per user request).
export const SEPTEMBER_TRANSACTIONS = [
  { type: 'expense', date: '2026-09-03', categoryId: 'exp-nafs', amount: 70000 },
  { type: 'expense', date: '2026-09-03', categoryId: 'exp-boshqa', amount: 70000 },
  { type: 'expense', date: '2026-09-03', categoryId: 'exp-obunalar', amount: 155000 },
  { type: 'expense', date: '2026-09-03', categoryId: 'exp-boshqa', amount: 50000 },
  { type: 'expense', date: '2026-09-03', categoryId: 'exp-boshqa', amount: 180000 },
  { type: 'expense', date: '2026-09-07', categoryId: 'exp-nafs', amount: 80000 },
  { type: 'expense', date: '2026-09-07', categoryId: 'exp-nafs', amount: 25000 },
  { type: 'expense', date: '2026-09-07', categoryId: 'exp-farzandim', amount: 110000 },
  { type: 'expense', date: '2026-09-07', categoryId: 'exp-biznesga', amount: 50000 },
  { type: 'expense', date: '2026-09-07', categoryId: 'exp-nafs', amount: 40000 },
  { type: 'expense', date: '2026-09-07', categoryId: 'exp-ayolim', amount: 250000 },
  { type: 'expense', date: '2026-09-07', categoryId: 'exp-boshqa', amount: 50000 },
  { type: 'expense', date: '2026-09-09', categoryId: 'exp-sogliq', amount: 75000 },
  { type: 'expense', date: '2026-09-09', categoryId: 'exp-nafs', amount: 75000 },
  { type: 'expense', date: '2026-09-09', categoryId: 'exp-nafs', amount: 70000 },
  { type: 'expense', date: '2026-09-09', categoryId: 'exp-boshqa', amount: 50000 },
  { type: 'expense', date: '2026-09-09', categoryId: 'exp-transport', amount: 250000 },
  { type: 'expense', date: '2026-09-09', categoryId: 'exp-ayolim', amount: 200000 },
  { type: 'expense', date: '2026-09-13', categoryId: 'exp-boshqa', amount: 300000 },
  { type: 'expense', date: '2026-09-13', categoryId: 'exp-boshqa', amount: 100000 },
  { type: 'expense', date: '2026-09-13', categoryId: 'exp-sogliq', amount: 70000 },
  { type: 'expense', date: '2026-09-13', categoryId: 'exp-boshqa', amount: 30000 },
  { type: 'expense', date: '2026-09-13', categoryId: 'exp-boshqa', amount: 60000 },
  { type: 'expense', date: '2026-09-13', categoryId: 'exp-boshqa', amount: 100000 },
  { type: 'expense', date: '2026-09-13', categoryId: 'exp-nafs', amount: 125000 },
  { type: 'expense', date: '2026-09-16', categoryId: 'exp-nafs', amount: 250000 },
  { type: 'expense', date: '2026-09-16', categoryId: 'exp-boshqa', amount: 350000 },
  { type: 'expense', date: '2026-09-16', categoryId: 'exp-nafs', amount: 65000 },
  { type: 'expense', date: '2026-09-16', categoryId: 'exp-obunalar', amount: 270000 },
  { type: 'expense', date: '2026-09-16', categoryId: 'exp-farzandim', amount: 550000 },
  { type: 'expense', date: '2026-09-22', categoryId: 'exp-boshqa', amount: 50000 },
  { type: 'expense', date: '2026-09-22', categoryId: 'exp-obunalar', amount: 270000 },
  { type: 'expense', date: '2026-09-22', categoryId: 'exp-nafs', amount: 50000 },
  { type: 'expense', date: '2026-09-22', categoryId: 'exp-obunalar', amount: 120000 },
  { type: 'expense', date: '2026-09-22', categoryId: 'exp-transport', amount: 280000 },
  { type: 'expense', date: '2026-09-22', categoryId: 'exp-sogliq', amount: 70000 },
  { type: 'expense', date: '2026-09-22', categoryId: 'exp-nafs', amount: 105000 },
  { type: 'expense', date: '2026-09-24', categoryId: 'exp-nafs', amount: 50000 },
  { type: 'expense', date: '2026-09-24', categoryId: 'exp-nafs', amount: 100000 },
  { type: 'expense', date: '2026-09-24', categoryId: 'exp-ayolim', amount: 50000 },
  { type: 'expense', date: '2026-09-24', categoryId: 'exp-farzandim', amount: 300000 },
  { type: 'expense', date: '2026-09-24', categoryId: 'exp-ayolim', amount: 100000 },
  { type: 'expense', date: '2026-09-24', categoryId: 'exp-ayolim', amount: 1400000 },
  { type: 'expense', date: '2026-09-25', categoryId: 'exp-nafs', amount: 130000 },
  { type: 'expense', date: '2026-09-25', categoryId: 'exp-biznesga', amount: 250000 },
  { type: 'expense', date: '2026-09-25', categoryId: 'exp-biznesga', amount: 250000 },
  { type: 'expense', date: '2026-09-25', categoryId: 'exp-biznesga', amount: 120000 },
  { type: 'expense', date: '2026-09-25', categoryId: 'exp-nafs', amount: 190000 },
  { type: 'expense', date: '2026-09-25', categoryId: 'exp-rivojlanish', amount: 300000 },
  { type: 'expense', date: '2026-09-25', categoryId: 'exp-boshqa', amount: 50000 },
  { type: 'expense', date: '2026-09-25', categoryId: 'exp-biznesga', amount: 120000 },
  { type: 'expense', date: '2026-09-25', categoryId: 'exp-biznesga', amount: 120000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-nafs', amount: 150000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-biznesga', amount: 120000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-obunalar', amount: 155000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-biznesga', amount: 120000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-nafs', amount: 350000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-transport', amount: 250000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-nafs', amount: 100000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-boshqa', amount: 200000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-biznesga', amount: 120000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-obunalar', amount: 215000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-ayolim', amount: 300000 },
  { type: 'expense', date: '2026-10-01', categoryId: 'exp-boshqa', amount: 441000 },
  { type: 'income', date: '2026-09-01', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-02', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-09-03', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-04', categoryId: 'inc-oylik', amount: 400000 },
  { type: 'income', date: '2026-09-04', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-09-05', categoryId: 'inc-oylik', amount: 500000 },
  { type: 'income', date: '2026-09-05', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-06', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-09-07', categoryId: 'inc-oylik', amount: 500000 },
  { type: 'income', date: '2026-09-07', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-09-08', categoryId: 'inc-biznes', amount: 180000 },
  { type: 'income', date: '2026-09-08', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-10', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-09-11', categoryId: 'inc-oylik', amount: 300000 },
  { type: 'income', date: '2026-09-11', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-12', categoryId: 'inc-oylik', amount: 300000 },
  { type: 'income', date: '2026-09-13', categoryId: 'inc-biznes', amount: 175000 },
  { type: 'income', date: '2026-09-13', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-14', categoryId: 'inc-oylik', amount: 300000 },
  { type: 'income', date: '2026-09-14', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-15', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-17', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-09-18', categoryId: 'inc-oylik', amount: 1000000 },
  { type: 'income', date: '2026-09-19', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-09-19', categoryId: 'inc-target', amount: 350000 },
  { type: 'income', date: '2026-09-20', categoryId: 'inc-boshqa', amount: 50000 },
  { type: 'income', date: '2026-09-20', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-21', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-22', categoryId: 'inc-oylik', amount: 300000 },
  { type: 'income', date: '2026-09-22', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-09-23', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-09-24', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-25', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-25', categoryId: 'inc-oylik', amount: 300000 },
  { type: 'income', date: '2026-09-25', categoryId: 'inc-target', amount: 350000 },
  { type: 'income', date: '2026-09-25', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-09-25', categoryId: 'inc-biznes', amount: 240000 },
  { type: 'income', date: '2026-09-25', categoryId: 'inc-oylik', amount: 500000 },
  { type: 'income', date: '2026-09-25', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-09-25', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-10-01', categoryId: 'inc-biznes', amount: 180000 },
  { type: 'income', date: '2026-10-01', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-10-01', categoryId: 'inc-oylik', amount: 1000000 },
  { type: 'income', date: '2026-10-01', categoryId: 'inc-target', amount: 350000 },
  { type: 'income', date: '2026-10-01', categoryId: 'inc-biznes', amount: 300000 },
  { type: 'income', date: '2026-10-01', categoryId: 'inc-target', amount: 200000 },
  { type: 'income', date: '2026-10-01', categoryId: 'inc-oylik', amount: 1000000 },
  { type: 'income', date: '2026-10-01', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-10-01', categoryId: 'inc-target', amount: 100000 },
  { type: 'income', date: '2026-10-01', categoryId: 'inc-oylik', amount: 500000 },
]

// From "Summary by Category"'s Chiqim REJA column (September's plan).
export const SEPTEMBER_BUDGET = {
  'exp-nafs': 800000,
  'exp-transport': 600000,
  'exp-qarz': 1200000,
  'exp-biznesga': 700000,
  'exp-oyim': 300000,
  'exp-ayolim': 2300000,
  'exp-farzandim': 600000,
  'exp-obunalar': 760000,
  'exp-sogliq': 0,
  'exp-oilam': 300000,
  'exp-ehson': 600000,
  'exp-rivojlanish': 0,
  'exp-kiyim': 0,
  'exp-boshqa': 540000,
}

// From the monthly rollup table's Jan-Aug 2026 rows (no line-item detail
// existed for these months in the source file, only totals) — `carry` is
// each row's own "O'tgan oydan qolgan" value exactly as the user typed it
// (some months don't chain cleanly from the previous month's remaining
// balance; that's the user's own historical manual-entry drift, preserved
// as-is rather than "corrected", since these months are frozen history).
export const HISTORY_SEED = {
  '2026-01': { carry: 0, income: 13800000, expense: 12730000 },
  '2026-02': { carry: 1070000, income: 12000000, expense: 12002000 },
  '2026-03': { carry: 1068000, income: 11300000, expense: 13762000 },
  '2026-04': { carry: -1394000, income: 16500000, expense: 10569000 },
  '2026-05': { carry: 4537000, income: 13150000, expense: 7763000 },
  '2026-06': { carry: 11164000, income: 7750000, expense: 10513000 },
  '2026-07': { carry: 8401000, income: 13375000, expense: 11116000 },
  '2026-08': { carry: 3318000, income: 0, expense: 0 },
  // September: income and expense come from the transactions above; only the
  // opening balance is the sheet's own (5 076 000). With the 1 October rows
  // counted in October, the overall balance is 7 335 000 as in the sheet.
  '2026-09': { carry: 5076000, fromTransactions: true },
}

// Where the money sits right now, by kind of funds (cash / card / dollars) — set
// once so the three balances add up to the sheet's overall balance 7 335 000.
export const FUND_OPENING = { cash: 6050000, card: 1285000, usd: 0 }
