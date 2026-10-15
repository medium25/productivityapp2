// src/pages/FinancePage.jsx
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useFinanceStore } from '../store/useFinanceStore'
import { currentMonthKey, formatSom, monthKeyOf, monthSummary, txMonthKey } from '../features/finance/financeMath'
import { HISTORY_SEED } from '../features/finance/financeSeedData'
import FinanceOperationsTab from '../features/finance/FinanceOperationsTab'
import FinanceBudgetTab from '../features/finance/FinanceBudgetTab'
import FinanceHistoryTab from '../features/finance/FinanceHistoryTab'
import FundBalance from '../features/finance/FundBalance'

// Per user request: one window (no tabs), ordered "общая таблица →
// расходы и доходы → общая история" — overall balance, then Budget
// (expandable per-category rows with a progress bar), then Operations
// (flat add/edit list), then History (month cards). Seeding runs in
// useFinanceStore's onRehydrateStorage (once the real Firestore read
// lands), so no mount-effect is needed here.
export default function FinancePage() {
  const { t } = useTranslation()
  const transactions = useFinanceStore((s) => s.transactions)
  const transfers = useFinanceStore((s) => s.transfers) || []
  const fundOpening = useFinanceStore((s) => s.fundOpening) || { cash: 0, card: 0, usd: 0 }
  const addTransfer = useFinanceStore((s) => s.addTransfer)

  const balance = useMemo(
    () => monthSummary(currentMonthKey(), { transactions, historySeed: HISTORY_SEED }).remaining,
    [transactions]
  )

  // The same balance split by kind of funds (cash / card / dollars). Entries
  // without a kind are not shown as a separate tile (per user request); they
  // only count towards the headline total.
  const byFund = useMemo(() => {
    const now = currentMonthKey()
    const sums = { cash: fundOpening.cash || 0, card: fundOpening.card || 0, usd: fundOpening.usd || 0 }
    transactions.forEach((tx) => {
      if (!sums.hasOwnProperty(tx.fund) || txMonthKey(tx) > now) return
      sums[tx.fund] += tx.type === 'income' ? tx.amount : -tx.amount
    })
    // Exchanges move money between kinds without touching the total.
    transfers.forEach((x) => {
      if (monthKeyOf(x.date) > now) return
      sums[x.from] -= x.amount
      sums[x.to] += x.amount
    })
    return sums
  }, [transactions, transfers, fundOpening])

  return (
    <div className="finance-page">
      <div className="finance-balance-card">
        <p className="finance-balance-card__label">{t('finance.overallBalance')}</p>
        <p className="finance-balance-card__value">{formatSom(balance)}</p>
        <FundBalance byFund={byFund} onTransfer={addTransfer} />
      </div>

      <section className="finance-section">
        <h2 className="finance-section__title">{t('finance.tabBudget')}</h2>
        <FinanceBudgetTab />
      </section>
      <section className="finance-section">
        <h2 className="finance-section__title">{t('finance.tabOperations')}</h2>
        <FinanceOperationsTab />
      </section>
      <section className="finance-section">
        <h2 className="finance-section__title">{t('finance.tabHistory')}</h2>
        <FinanceHistoryTab />
      </section>
    </div>
  )
}
