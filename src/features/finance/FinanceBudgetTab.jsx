// src/features/finance/FinanceBudgetTab.jsx
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFinanceStore } from '../../store/useFinanceStore'
import { categoryActuals, currentMonthKey, formatSom, monthLabel, txMonthKey, nextMonthKey, prevMonthKey } from './financeMath'
import { todayISO } from '../tasks/taskLogic'
import { categoryColorFor } from './financeCategoryPalette'
import { CategoryPill } from './CategoryPill'

function CategoryNameCell({ category, onRename, dot }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(category.name)
  if (editing) {
    return (
      <input
        className="finance-category-input"
        value={value}
        autoFocus
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { onRename(value); setEditing(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false) }}
      />
    )
  }
  return (
    <span style={{ fontWeight: 600 }} onDoubleClick={(e) => { e.stopPropagation(); setValue(category.name); setEditing(true) }}>
      <CategoryPill name={category.name} hex={dot} />
    </span>
  )
}

// Amount chip (per user pick, variant B): plan, fact and remainder share one
// chip size so a row reads as a sentence.
const chipAmount = (amount) => String(Math.round(Math.abs(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

// Digits grouped by thousands as they are typed: 1 000, 10 000, 1 000 000.
const groupDigits = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

// createFirestoreStorage rewrites the whole store document on every set()
// call, so wiring this straight to onChange would fire a full-document
// Firestore write per keystroke. Draft renders immediately for a
// responsive feel; the store (and Firestore) only hears about it once, on
// blur/Enter — same local-draft-then-commit shape as CategoryNameCell
// above.
function PlanInput({ monthKey, categoryId, plan, setBudget, color }) {
  // The draft is plain digits; the field shows them grouped, and the caret is
  // put back after the same number of digits so typing in the middle works.
  const [draft, setDraft] = useState(String(plan))
  const inputRef = useRef(null)
  const caretDigits = useRef(null)

  useEffect(() => { setDraft(String(plan)) }, [plan, monthKey, categoryId])

  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el || caretDigits.current == null) return
    let seen = 0
    let pos = el.value.length
    if (caretDigits.current === 0) pos = 0
    else {
      for (let k = 0; k < el.value.length; k += 1) {
        if (/\d/.test(el.value[k])) seen += 1
        if (seen === caretDigits.current) { pos = k + 1; break }
      }
    }
    el.setSelectionRange(pos, pos)
    caretDigits.current = null
  })

  const commit = () => setBudget(monthKey, categoryId, Number(draft) || 0)

  const onChange = (e) => {
    const raw = e.target.value
    const caret = e.target.selectionStart ?? raw.length
    caretDigits.current = (raw.slice(0, caret).match(/\d/g) || []).length
    setDraft(raw.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))
  }

  // Field tinted in its own category's colour with the currency inside (per
  // user pick), instead of a white box on a coloured row.
  return (
    <span
      className={'finance-plan-field' + (Number(draft) ? '' : ' finance-plan-field--zero')}
      style={{ '--plan-hue': color.hex, '--plan-ink': color.text }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={groupDigits(draft)}
        onChange={onChange}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
      />
      <small>сум</small>
    </span>
  )
}

export default function FinanceBudgetTab() {
  const { t, i18n } = useTranslation()
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const budgets = useFinanceStore((s) => s.budgets)
  const setBudget = useFinanceStore((s) => s.setBudget)
  const copyBudget = useFinanceStore((s) => s.copyBudget)
  const addCategory = useFinanceStore((s) => s.addCategory)
  const renameCategory = useFinanceStore((s) => s.renameCategory)
  const deleteCategory = useFinanceStore((s) => s.deleteCategory)

  const [monthKey, setMonthKey] = useState(() => currentMonthKey())
  const [newCategoryName, setNewCategoryName] = useState('')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const expenseCategories = useMemo(() => categories.filter((c) => c.type === 'expense'), [categories])
  const actuals = useMemo(() => categoryActuals(transactions, monthKey, 'expense'), [transactions, monthKey])
  const monthBudget = budgets[monthKey] || {}

  // Planning a month ahead: a plan typed for a coming month is stored under
  // that month's key, so it takes effect by itself when the 1st arrives.
  // Three days before, the entry point is a big card; before that, a quiet icon.
  const nowKey = currentMonthKey()
  const nextKey = nextMonthKey(nowKey)
  const planning = monthKey > nowKey
  const daysTo = (key) => Math.max(1, Math.round((new Date(`${key}-01T00:00:00`) - new Date(`${todayISO()}T00:00:00`)) / 86400000))
  const nextPlan = budgets[nextKey] || {}
  const nextPlanned = Object.values(nextPlan).some((v) => v > 0)
  const nextFilled = expenseCategories.filter((c) => nextPlan[c.id] > 0).length
  const soon = !planning && daysTo(nextKey) <= 3
  const bigMonth = (key) => {
    const name = new Date(`${key}-01T00:00:00`).toLocaleDateString(i18n.language, { month: 'long' })
    return name.charAt(0).toUpperCase() + name.slice(1)
  }
  const startLabel = new Date(`${monthKey}-01T00:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' })

  const total = expenseCategories.reduce((acc, c) => {
    acc.plan += monthBudget[c.id] || 0
    acc.fact += actuals[c.id] || 0
    return acc
  }, { plan: 0, fact: 0 })

  const entriesFor = (categoryId) => transactions
    .filter((tx) => tx.categoryId === categoryId && txMonthKey(tx) === monthKey)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return (
    <div className="finance-budget">
      <div className="finance-month-switcher">
        <button type="button" onClick={() => setMonthKey(prevMonthKey(monthKey))}>‹</button>
        <span>{monthLabel(monthKey, i18n.language)}</span>
        <button type="button" onClick={() => setMonthKey(nextMonthKey(monthKey))}>›</button>
        {!planning && !soon && (
          <button type="button" className="finance-plan-icon" title={t('finance.planNextMonth')} aria-label={t('finance.planNextMonth')} onClick={() => setMonthKey(nextKey)}>
            <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4M8 8.6v3.2M6.4 10.2h3.2" /></svg>
          </button>
        )}
      </div>

      {soon && (
        <div className="finance-plan-card">
          <span className="finance-plan-card__icon">
            <svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4M8 8.6v3.2M6.4 10.2h3.2" /></svg>
          </span>
          <div className="finance-plan-card__text">
            <b>{t('finance.nextMonthSoon', { month: bigMonth(nextKey), count: daysTo(nextKey) })}</b>
            <small>{t('finance.planProgress', { done: nextFilled, total: expenseCategories.length })}</small>
            <div className="finance-plan-card__bar"><i style={{ width: `${expenseCategories.length ? Math.round((nextFilled / expenseCategories.length) * 100) : 0}%` }} /></div>
          </div>
          <button type="button" className="finance-plan-card__go" onClick={() => setMonthKey(nextKey)}>{t(nextPlanned ? 'finance.planEdit' : 'finance.planAction')}</button>
        </div>
      )}

      {planning && (
        <div className="finance-plan-saved">
          <span className="finance-plan-saved__dot" />
          <b>{t('finance.autoSaved')}</b>
          <span className="finance-plan-saved__sp" />
          <u>{t('finance.startsOn', { date: startLabel })}</u>
          <button type="button" onClick={() => copyBudget(prevMonthKey(monthKey), monthKey)}>{t('finance.copyFromPrev')}</button>
          <button type="button" onClick={() => setMonthKey(nowKey)}>{t('finance.planDone')}</button>
        </div>
      )}

      <div className="finance-budget-scroll">
      <table className="finance-budget-table">
        <thead>
          <tr>
            <th>{t('finance.category')}</th>
            <th>{t('finance.plan')}</th>
            <th>{t('finance.fact')}</th>
            <th>{t('finance.progress')}</th>
            <th>{t('finance.remaining')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {expenseCategories.map((c, i) => {
            const plan = monthBudget[c.id] || 0
            const fact = actuals[c.id] || 0
            const remaining = plan - fact
            const ratio = plan > 0 ? Math.min(1, fact / plan) : (fact > 0 ? 1 : 0)
            const over = remaining < 0
            const expanded = expandedId === c.id
            const entries = expanded ? entriesFor(c.id) : []
            const color = categoryColorFor(i)
            return (
              <Fragment key={c.id}>
                <tr
                  className={'finance-budget-row' + (i % 2 ? ' finance-budget-row--alt' : '')}
                  onClick={() => setExpandedId(expanded ? null : c.id)}
                >
                  <td>
                    <span className={'finance-budget-chevron' + (expanded ? ' finance-budget-chevron--open' : '')}>›</span>
                    <CategoryNameCell category={c} onRename={(name) => renameCategory(c.id, name)} dot={color.hex} />
                  </td>
                  <td>
                    <PlanInput monthKey={monthKey} categoryId={c.id} plan={plan} setBudget={setBudget} color={color} />
                  </td>
                  <td>
                    <span className={'finance-chip' + (fact ? '' : ' finance-chip--zero')}>{chipAmount(fact)}<small>сум</small></span>
                  </td>
                  <td>
                    <div className="finance-mini-bar-track">
                      <div
                        className={'finance-mini-bar-fill' + (over ? ' finance-mini-bar-fill--over' : '')}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    <span className={'finance-chip ' + (remaining < 0 ? 'finance-chip--over' : plan > 0 ? 'finance-chip--ok' : 'finance-chip--zero')}>
                      {remaining < 0 ? '−' : ''}{chipAmount(remaining)}<small>сум</small>
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {confirmingDeleteId === c.id ? (
                      <span className="finance-tx-confirm">
                        <button type="button" onClick={() => { deleteCategory(c.id); setConfirmingDeleteId(null) }}>{t('tasks.yes')}</button>
                        <button type="button" onClick={() => setConfirmingDeleteId(null)}>{t('tasks.no')}</button>
                      </span>
                    ) : (
                      <button type="button" className="finance-tx-remove" onClick={() => setConfirmingDeleteId(c.id)}>×</button>
                    )}
                  </td>
                </tr>
                {expanded && (
                  <tr className="finance-budget-expand-row">
                    <td colSpan={6}>
                      {entries.length === 0 ? (
                        <p className="finance-empty">{t('finance.noOperations')}</p>
                      ) : (
                        <div className="finance-budget-expand-list">
                          {entries.map((tx) => (
                            <div key={tx.id} className="finance-budget-expand-item">
                              <span>{tx.date.slice(8, 10)} {monthLabel(monthKey, i18n.language).split(' ')[0]}</span>
                              <span className="finance-tx-amount--expense">-{formatSom(tx.amount)}</span>
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
          {/* Raised summary card (per user pick, variant C): small captions over
              the sums, the remainder as a coloured pill. */}
          <tr className="finance-budget-total">
            <td><span className="finance-total-cell"><small>&nbsp;</small><b>{t('finance.total')}</b></span></td>
            <td><span className="finance-total-cell"><small>{t('finance.plan')}</small><b>{formatSom(total.plan)}</b></span></td>
            <td><span className="finance-total-cell"><small>{t('finance.fact')}</small><b>{formatSom(total.fact)}</b></span></td>
            <td />
            <td>
              <span className="finance-total-cell">
                <small>{t('finance.remaining')}</small>
                <span className={'finance-total-pill' + (total.plan - total.fact < 0 ? ' finance-total-pill--negative' : '')}>{formatSom(total.plan - total.fact)}</span>
              </span>
            </td>
            <td />
          </tr>
        </tbody>
      </table>
      </div>

      <form
        className="finance-add-category"
        onSubmit={(e) => { e.preventDefault(); if (newCategoryName.trim()) { addCategory(newCategoryName.trim(), 'expense'); setNewCategoryName('') } }}
      >
        <input
          type="text"
          placeholder={t('finance.newCategory')}
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
        />
        <button type="submit">{t('finance.add')}</button>
      </form>
    </div>
  )
}
