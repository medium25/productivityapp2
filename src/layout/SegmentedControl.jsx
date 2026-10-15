export default function SegmentedControl({ items, value, onChange, ariaLabel }) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={'segmented__item' + (value === item.value ? ' active' : '')}
          onClick={() => onChange(item.value)}
          aria-pressed={value === item.value}
          aria-label={item.ariaLabel}
          title={item.ariaLabel}
        >
          {item.content}
        </button>
      ))}
    </div>
  )
}
