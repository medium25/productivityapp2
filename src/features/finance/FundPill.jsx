// src/features/finance/FundPill.jsx
//
// The three kinds of funds — cash (green), card (blue), dollars (yellow) — are
// always shown as the same pill, wherever they appear (balance, forms, tables,
// exchange); FundSelect is the one-button chooser built from those pills.
import { useEffect, useRef, useState } from 'react'

export const FUND_KEYS = ['cash', 'card', 'usd']
export const FUND_LABEL = { cash: 'finance.fundCash', card: 'finance.fundCard', usd: 'finance.fundUsd' }

export function FundPill({ fund, t }) {
  return <span className={'finance-fund-chip finance-fund-chip--' + fund}>{t(FUND_LABEL[fund] || FUND_LABEL.cash)}</span>
}

export function FundSelect({ value, onChange, t, missing }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="finance-fund" ref={rootRef}>
      <button
        type="button"
        className={'finance-fund__trigger' + (value ? '' : ' finance-select--empty') + (missing ? ' finance-select--missing' : '')}
        onClick={() => setOpen((v) => !v)}
      >
        {value ? <FundPill fund={value} t={t} /> : <span>{t('finance.choose')}</span>}
      </button>
      {open && (
        <div className="finance-fund__menu">
          {FUND_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={'finance-fund__option' + (key === value ? ' finance-fund__option--on' : '')}
              onClick={() => { onChange(key); setOpen(false) }}
            >
              <FundPill fund={key} t={t} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
