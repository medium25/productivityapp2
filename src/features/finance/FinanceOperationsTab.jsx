// src/features/finance/FinanceOperationsTab.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFinanceStore } from '../../store/useFinanceStore'
import { currentMonthKey, formatSom, monthKeyOf, monthLabel, txMonthKey, nextMonthKey, prevMonthKey } from './financeMath'
import { addDays, isoFromDate, todayISO } from '../tasks/taskLogic'
import CategoryPicker from './CategoryPicker'
import { FundPill, FundSelect } from './FundPill'
import { CategoryPill, categoryHexFor } from './CategoryPill'

function MonthSwitcher({ monthKey, onChange, language }) {
  return (
    <div className="finance-month-switcher">
      <button type="button" onClick={() => onChange(prevMonthKey(monthKey))}>‹</button>
      <span>{monthLabel(monthKey, language)}</span>
      <button type="button" onClick={() => onChange(nextMonthKey(monthKey))}>›</button>
    </div>
  )
}

const groupDigits = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

// Date chooser behind a button (per user request): defaults to today, the
// popup has exactly two ways to change it — "Вчера" and a calendar.
function DatePopup({ value, onChange, language, t }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const today = todayISO()
  const yesterday = addDays(today, -1)
  const [month, setMonth] = useState(() => { const d = new Date(`${value}T00:00:00`); return new Date(d.getFullYear(), d.getMonth(), 1) })

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const label = value === today ? t('finance.today')
    : value === yesterday ? t('finance.yesterday')
    : new Date(`${value}T00:00:00`).toLocaleDateString(language, { day: 'numeric', month: 'short' })

  const first = (month.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: daysInMonth }, (_, k) => isoFromDate(new Date(month.getFullYear(), month.getMonth(), k + 1)))]
  const weekdays = Array.from({ length: 7 }, (_, k) => new Date(2024, 0, 1 + k).toLocaleDateString(language, { weekday: 'short' }))
  const pick = (iso) => { onChange(iso); setOpen(false) }

  return (
    <div className="finance-date" ref={rootRef}>
      <button type="button" className="finance-date__trigger" onClick={() => setOpen((v) => !v)}>
        <span>{label}</span>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4" /></svg>
      </button>
      {open && (
        <div className="finance-date__menu">
          <button type="button" className={'finance-date__yesterday' + (value === yesterday ? ' finance-date__yesterday--on' : '')} onClick={() => pick(yesterday)}>{t('finance.yesterday')}</button>
          <div className="finance-date__nav">
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="‹">‹</button>
            <span>{month.toLocaleDateString(language, { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="›">›</button>
          </div>
          <div className="finance-date__grid">
            {weekdays.map((w, k) => <span key={`w${k}`} className="finance-date__wd">{w}</span>)}
            {cells.map((iso, k) => iso ? (
              <button
                key={iso}
                type="button"
                className={'finance-date__day' + (iso === today ? ' finance-date__day--today' : '') + (iso === value ? ' finance-date__day--on' : '')}
                onClick={() => pick(iso)}
              >{Number(iso.slice(8))}</button>
            ) : <span key={`e${k}`} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// Расход and Доход get their own always-visible form instead of one shared
// form behind a type toggle (per user request). Fields, in order: date popup,
// kind of funds (cash / card / dollars), category, a free comment (expenses
// only), amount — then "Добавить".
function QuickAddForm({ type, categories, addTransaction, addCategory, t, language }) {
  const [date, setDate] = useState(() => todayISO())
  // Kind of funds and category have no default — each must be picked (per
  // user request); a failed submit marks what is still missing.
  const [fund, setFund] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [comment, setComment] = useState('')
  const [amount, setAmount] = useState('')
  const [attempted, setAttempted] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    const value = Number(amount)
    if (!fund || !categoryId || !value) { setAttempted(true); return }
    addTransaction(type, date, categoryId, value, type === 'expense' ? comment.trim() : '', fund)
    setAmount('')
    setComment('')
    setFund('')
    setCategoryId('')
    setAttempted(false)
  }

  // Every choice (date, kind of funds, category) is its own single button with
  // a caption above it, all the same height (per user request).
  return (
    <form className={'finance-add-row finance-add-row--' + type} onSubmit={submit}>
      <span className="finance-add-row__label">{t(type === 'expense' ? 'finance.expense' : 'finance.income')}</span>
      <div className="finance-add-row__selects">
        <div className="finance-field">
          <small>{t('finance.date')}</small>
          <DatePopup value={date} onChange={setDate} language={language} t={t} />
        </div>
        <div className="finance-field">
          <small>{t('finance.funds')}</small>
          <FundSelect value={fund} onChange={setFund} t={t} missing={attempted && !fund} />
        </div>
        <div className="finance-field">
          <small>{t('finance.category')}</small>
          <CategoryPicker categories={categories} type={type} value={categoryId} onChange={setCategoryId} onAddCategory={addCategory} placeholder={t('finance.choose')} missing={attempted && !categoryId} />
        </div>
      </div>
      {type === 'expense' ? (
        <input type="text" className="finance-add-row__comment" placeholder={t('finance.comment')} value={comment} onChange={(e) => setComment(e.target.value)} />
      ) : (
        // Income has no comment; the empty slot keeps both forms the same size.
        <div className="finance-add-row__spacer" aria-hidden="true" />
      )}
      <div className="finance-add-row__line">
        <input
          type="text"
          inputMode="numeric"
          className={'finance-add-row__amount' + (attempted && !Number(amount) ? ' finance-select--missing' : '')}
          placeholder={t('finance.amount')}
          value={groupDigits(amount)}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(e) } }}
        />
      </div>
      <small className="finance-add-row__hint">{t('finance.enterHint')}</small>
    </form>
  )
}

// createFirestoreStorage rewrites the whole store document on every set()
// call, so wiring this straight to onChange would fire a full-document
// Firestore write per keystroke. Each field keeps a local draft (renders
// immediately, feels responsive) and only commits to the store on
// blur/Enter — same shape as FinanceBudgetTab.jsx's PlanInput.
function EditingRow({ tx, categories, updateTransaction, addCategory, onDone, t }) {
  const [date, setDate] = useState(tx.date)
  const [categoryId, setCategoryId] = useState(tx.categoryId)
  const [amount, setAmount] = useState(String(tx.amount))

  const commitDate = () => { if (date !== tx.date) updateTransaction(tx.id, { date }) }
  const commitAmount = () => {
    const value = Number(amount) || 0
    if (value !== tx.amount) updateTransaction(tx.id, { amount: value })
  }
  const changeCategory = (id) => {
    setCategoryId(id)
    updateTransaction(tx.id, { categoryId: id })
  }

  return (
    <div className="finance-tx-row finance-tx-row--editing">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        onBlur={commitDate}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
      />
      <CategoryPicker categories={categories} type={tx.type} value={categoryId} onChange={changeCategory} onAddCategory={addCategory} />
      <input
        type="number"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={commitAmount}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
      />
      <button type="button" onClick={() => { commitDate(); commitAmount(); onDone() }}>{t('finance.done')}</button>
    </div>
  )
}

// One plain table per type (Расход / Доход) — matches the user's original
// Numbers-file ledger (two side-by-side "Sana;Kategoriyalar;Chiqim/
// Tushum" tables) instead of one mixed flat list.
function TxTable({ type, rows, categories, updateTransaction, deleteTransaction, addCategory, editingId, setEditingId, confirmingDeleteId, setConfirmingDeleteId, t }) {
  const categoryName = (id) => categories.find((c) => c.id === id)?.name || id
  // Columns, in order: date (dd.mm), funds, category, comment (expenses
  // only), amount, delete.
  const withComment = type === 'expense'
  const columns = withComment ? 6 : 5

  return (
    <table className={'finance-tx-table finance-tx-table--' + type}>
      <thead>
        <tr>
          <th>{t('finance.date')}</th>
          <th>{t('finance.funds')}</th>
          <th>{t('finance.category')}</th>
          {withComment && <th>{t('finance.comment')}</th>}
          <th className="finance-tx-amount-head">{t(type === 'expense' ? 'finance.expense' : 'finance.income')}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={columns}><p className="finance-empty">{t('finance.noOperations')}</p></td></tr>
        )}
        {rows.map((tx) => (
          editingId === tx.id ? (
            <tr key={tx.id}>
              <td colSpan={columns}>
                <EditingRow
                  tx={tx}
                  categories={categories}
                  updateTransaction={updateTransaction}
                  addCategory={addCategory}
                  onDone={() => setEditingId(null)}
                  t={t}
                />
              </td>
            </tr>
          ) : (
            <tr key={tx.id}>
              <td className="finance-tx-date-cell">{tx.date.slice(8, 10)}.{tx.date.slice(5, 7)}</td>
              <td className="finance-tx-fund-cell">
                {tx.fund ? <FundPill fund={tx.fund} t={t} /> : '—'}
              </td>
              <td className="finance-tx-category-cell" onClick={() => setEditingId(tx.id)} style={{ cursor: 'pointer' }}>
                <CategoryPill small name={categoryName(tx.categoryId)} hex={categoryHexFor(categories, tx.categoryId)} />
              </td>
              {withComment && <td className="finance-tx-comment-cell">{tx.note || ''}</td>}
              <td className={'finance-tx-amount--' + tx.type}><span className="finance-tx-amount-pill">{formatSom(tx.amount)}</span></td>
              <td>
                {confirmingDeleteId === tx.id ? (
                  <span className="finance-tx-confirm">
                    <button type="button" onClick={() => { deleteTransaction(tx.id); setConfirmingDeleteId(null) }}>{t('tasks.yes')}</button>
                    <button type="button" onClick={() => setConfirmingDeleteId(null)}>{t('tasks.no')}</button>
                  </span>
                ) : (
                  <button type="button" className="finance-tx-remove" onClick={() => setConfirmingDeleteId(tx.id)}>×</button>
                )}
              </td>
            </tr>
          )
        ))}
      </tbody>
    </table>
  )
}

export default function FinanceOperationsTab() {
  const { t, i18n } = useTranslation()
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const addTransaction = useFinanceStore((s) => s.addTransaction)
  const updateTransaction = useFinanceStore((s) => s.updateTransaction)
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction)
  const addCategory = useFinanceStore((s) => s.addCategory)
  const transfers = useFinanceStore((s) => s.transfers) || []
  const deleteTransfer = useFinanceStore((s) => s.deleteTransfer)

  const [monthKey, setMonthKey] = useState(() => currentMonthKey())
  const [editingId, setEditingId] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

  const rows = useMemo(() => (
    transactions
      .filter((tx) => txMonthKey(tx) === monthKey)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  ), [transactions, monthKey])

  const monthTransfers = transfers.filter((x) => monthKeyOf(x.date) === monthKey).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const expenseRows = rows.filter((tx) => tx.type === 'expense')
  const incomeRows = rows.filter((tx) => tx.type === 'income')

  const tableProps = { categories, updateTransaction, deleteTransaction, addCategory, editingId, setEditingId, confirmingDeleteId, setConfirmingDeleteId, t }

  return (
    <div className="finance-operations">
      <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} language={i18n.language} />

      <div className="finance-type-columns">
        <div className="finance-type-column">
          <QuickAddForm type="expense" categories={categories} addTransaction={addTransaction} addCategory={addCategory} t={t} language={i18n.language} />
          <TxTable type="expense" rows={expenseRows} {...tableProps} />
        </div>
        <div className="finance-type-column">
          <QuickAddForm type="income" categories={categories} addTransaction={addTransaction} addCategory={addCategory} t={t} language={i18n.language} />
          <TxTable type="income" rows={incomeRows} {...tableProps} />
        </div>
      </div>

      {monthTransfers.length > 0 && (
        <table className="finance-tx-table finance-tx-table--transfer">
          <thead>
            <tr>
              <th>{t('finance.date')}</th>
              <th>{t('finance.exchange')}</th>
              <th className="finance-tx-amount-head">{t('finance.exchangeAmount')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {monthTransfers.map((x) => (
              <tr key={x.id}>
                <td className="finance-tx-date-cell">{x.date.slice(8, 10)}.{x.date.slice(5, 7)}</td>
                <td className="finance-tx-fund-cell">
                  <FundPill fund={x.from} t={t} />
                  <span className="finance-transfer-arrow">→</span>
                  <FundPill fund={x.to} t={t} />
                </td>
                <td className="finance-tx-amount--transfer"><span className="finance-tx-amount-pill">{formatSom(x.amount)}</span></td>
                <td>
                  <button type="button" className="finance-tx-remove" onClick={() => deleteTransfer(x.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
