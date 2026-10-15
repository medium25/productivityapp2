// src/features/finance/FundBalance.jsx
//
// The balance card's split by kind of funds with the exchange built in (per
// user pick, variant A, icon only): a small exchange icon in the card's corner
// glows as the pointer comes near and opens one sentence row under the chips —
// "Перевести [сумма] с [откуда] на [куда]" — no rate, the amount just moves
// between the kinds. Enter records it.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatSom } from './financeMath'
import { todayISO } from '../tasks/taskLogic'
import { FUND_KEYS, FUND_LABEL, FundSelect } from './FundPill'

const groupDigits = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const digitsOnly = (v) => v.replace(/\D/g, '').replace(/^0+(?=\d)/, '')

const SWAP_ICON = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h11l-3-3M16 13H5l3 3" />
  </svg>
)

export default function FundBalance({ byFund, onTransfer }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const value = Number(amount)
  const sameFund = !!from && from === to

  const submit = () => {
    if (!from || !to || sameFund || !value) { setAttempted(true); return }
    onTransfer({ date: todayISO(), from, to, amount: value })
    setAmount('')
    setFrom('')
    setTo('')
    setAttempted(false)
    setOpen(false)
  }
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }

  const chip = (key) => (
    <div key={key} className={'finance-balance-fund finance-balance-fund--' + key + (byFund[key] < 0 ? ' finance-balance-fund--negative' : '')}>
      <div className="finance-balance-fund__head">{t(FUND_LABEL[key])}</div>
      <b>{formatSom(byFund[key])}</b>
    </div>
  )

  return (
    <>
      <button
        type="button"
        className={'finance-balance-swap' + (open ? ' finance-balance-swap--on' : '')}
        onClick={() => setOpen((v) => !v)}
        title={t('finance.exchange')}
        aria-label={t('finance.exchange')}
        aria-expanded={open}
      >{SWAP_ICON}</button>

      <div className="finance-balance-funds">
        {FUND_KEYS.map(chip)}
      </div>

      {open && (
        <div className="finance-exchange">
          <span className="finance-exchange__word">{t('finance.exchangeTransfer')}</span>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            className={'finance-exchange__input' + (attempted && !value ? ' finance-select--missing' : '')}
            placeholder={t('finance.exchangeAmount')}
            value={groupDigits(amount)}
            onChange={(e) => setAmount(digitsOnly(e.target.value))}
            onKeyDown={onKey}
          />
          <span className="finance-exchange__word">{t('finance.exchangeFrom')}</span>
          <FundSelect value={from} onChange={setFrom} t={t} missing={attempted && (!from || sameFund)} />
          <span className="finance-exchange__word">{t('finance.exchangeTo')}</span>
          <FundSelect value={to} onChange={setTo} t={t} missing={attempted && (!to || sameFund)} />
        </div>
      )}
      {open && <p className="finance-exchange__hint">{t('finance.exchangeHint')}</p>}
    </>
  )
}
