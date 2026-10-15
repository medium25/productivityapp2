// src/features/finance/CategoryPicker.jsx
//
// Replaces a plain <select> for picking a transaction's category — click
// opens a popup listing existing categories (filtered to `type`) plus an
// inline "add new" row, so a missing category can be created right where
// it's needed instead of only from the Budget table's own add-category
// form (per user request, "добавь возможность добавлять категории в поп
// ап меню").
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CategoryPill } from './CategoryPill'
import { categoryColorFor } from './financeCategoryPalette'

export default function CategoryPicker({ categories, type, value, onChange, onAddCategory, placeholder, missing }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const pendingNameRef = useRef(null)
  const rootRef = useRef(null)

  const options = categories.filter((c) => c.type === type)
  const selected = options.find((c) => c.id === value)

  // addCategory() doesn't return the new id (it's a fire-and-forget store
  // action), so once the newly-created category shows up in `categories`
  // (store update → re-render), match it by name and auto-select it.
  useEffect(() => {
    if (!pendingNameRef.current) return
    const match = options.find((c) => c.name === pendingNameRef.current)
    if (match) {
      onChange(match.id)
      pendingNameRef.current = null
      setNewName('')
      setOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Plain div, not <form> — this picker renders inside the page's own
  // add-transaction <form>, and nested <form> elements are invalid HTML;
  // React silently mis-renders the subtree when it happens (the browser
  // parser relocates the inner form out of the outer one), which breaks
  // state updates here entirely. Enter-to-submit is wired via onKeyDown.
  const submitNew = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    pendingNameRef.current = trimmed
    onAddCategory(trimmed, type)
  }

  return (
    <div className="finance-category-picker" ref={rootRef}>
      <button
        type="button"
        className={'finance-category-picker__trigger' + (selected ? '' : ' finance-select--empty') + (missing ? ' finance-select--missing' : '')}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? <CategoryPill small name={selected.name} hex={categoryColorFor(options.indexOf(selected)).hex} /> : (placeholder || t('finance.selectCategory'))}
      </button>
      {open && (
        <div className="finance-category-picker__menu">
          {options.map((c) => (
            <button
              type="button"
              key={c.id}
              className={'finance-category-picker__option' + (c.id === value ? ' active' : '')}
              onClick={() => { onChange(c.id); setOpen(false) }}
            >
              <CategoryPill small name={c.name} hex={categoryColorFor(options.indexOf(c)).hex} />
            </button>
          ))}
          <div className="finance-category-picker__add">
            <input
              type="text"
              placeholder={t('finance.newCategory')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitNew() } }}
            />
            <button type="button" onClick={submitNew}>{t('finance.add')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
