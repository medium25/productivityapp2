// src/features/finance/CategoryPill.jsx
//
// A category is always shown as the same tinted pill in its own colour (per user
// request: everywhere there is a category). The colour follows the category's
// position among the categories of its own kind, the same cycle the Budget
// table uses.
import { categoryColorFor } from './financeCategoryPalette'

export function categoryHexFor(categories, categoryId) {
  const category = categories.find((c) => c.id === categoryId)
  if (!category) return null
  const sameKind = categories.filter((c) => c.type === category.type)
  return categoryColorFor(sameKind.findIndex((c) => c.id === categoryId)).hex
}

export function CategoryPill({ name, hex, small }) {
  return (
    <span className={'finance-cat-pill' + (small ? ' finance-cat-pill--sm' : '')} style={hex ? { '--cat': hex } : undefined}>
      {name}
    </span>
  )
}
