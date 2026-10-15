// src/features/finance/FinanceHistoryTab.jsx
import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFinanceStore } from '../../store/useFinanceStore'
import { currentMonthKey, formatSom, listHistoryMonthKeys, txMonthKey, monthLabel, monthSummary } from './financeMath'
import { HISTORY_SEED } from './financeSeedData'

export default function FinanceHistoryTab() {
  const { t, i18n } = useTranslation()
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const [expandedKey, setExpandedKey] = useState(null)

  const rows = useMemo(() => {
    const keys = listHistoryMonthKeys(transactions, HISTORY_SEED, currentMonthKey())
    return keys.map((monthKey) => ({ monthKey, ...monthSummary(monthKey, { transactions, historySeed: HISTORY_SEED }) }))
  }, [transactions])

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || id

  const entriesFor = (monthKey) => transactions
    .filter((tx) => txMonthKey(tx) === monthKey)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return (
    <table className="finance-history-table">
      <thead>
        <tr>
          <th>{t('finance.month')}</th>
          <th>{t('finance.carry')}</th>
          <th>{t('finance.income')}</th>
          <th>{t('finance.expense')}</th>
          <th>{t('finance.remaining')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const expanded = expandedKey === r.monthKey
          const entries = expanded ? entriesFor(r.monthKey) : []
          return (
            <Fragment key={r.monthKey}>
              <tr className="finance-budget-row" onClick={() => setExpandedKey(expanded ? null : r.monthKey)}>
                <td>
                  <span className={'finance-budget-chevron' + (expanded ? ' finance-budget-chevron--open' : '')}>›</span>
                  {monthLabel(r.monthKey, i18n.language)}
                </td>
                <td className={r.carry < 0 ? 'finance-remaining--negative' : ''}>{formatSom(r.carry)}</td>
                <td>{formatSom(r.income)}</td>
                <td>{formatSom(r.expense)}</td>
                <td className={r.remaining < 0 ? 'finance-remaining--negative' : ''}>{formatSom(r.remaining)}</td>
              </tr>
              {expanded && (
                <tr className="finance-budget-expand-row">
                  <td colSpan={5}>
                    {entries.length === 0 ? (
                      <p className="finance-empty">{t('finance.noOperations')}</p>
                    ) : (
                      <div className="finance-budget-expand-list">
                        {entries.map((tx) => (
                          <div key={tx.id} className="finance-budget-expand-item">
                            <span>{tx.date.slice(8, 10)} {monthLabel(r.monthKey, i18n.language).split(' ')[0]} · {categoryName(tx.categoryId)}</span>
                            <span className={'finance-tx-amount--' + tx.type}>{tx.type === 'expense' ? '-' : '+'}{formatSom(tx.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
