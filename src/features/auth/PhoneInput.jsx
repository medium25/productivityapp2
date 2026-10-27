import { COUNTRIES, formatLocal, joinPhone, splitPhone } from './phoneAccount'

// Phone field where the country code is a fixed chip (tap to change) and only
// the rest of the number is typed — grouped as you type ("90 123 45 67").
// `value` / `onChange` carry the full number ("+998901234567", or "+998" while
// empty), so it plugs straight into the helpers in phoneAccount.js.
export default function PhoneInput({ value, onChange, disabled, autoFocus, id, ariaLabel }) {
  const { country, local } = splitPhone(value)

  const typed = (e) => {
    const text = e.target.value
    // A pasted full number ("+7 912…", "998 90…") picks its own country.
    if (text.trim().startsWith('+') || text.replace(/\D/g, '').length > country.length) {
      const next = splitPhone(text)
      // "8 912…" style national prefix for +7.
      const local2 = next.country.code === '7' && /^8\d{10}$/.test(text.replace(/\D/g, '')) ? text.replace(/\D/g, '').slice(1) : next.local
      onChange(joinPhone(next.country, local2.slice(0, next.country.length)))
      return
    }
    onChange(joinPhone(country, text.replace(/\D/g, '').slice(0, country.length)))
  }

  const pickCountry = (code) => {
    const next = COUNTRIES.find((c) => c.code === code) || country
    onChange(joinPhone(next, local.slice(0, next.length)))
  }

  return (
    <div className={'phone-input' + (disabled ? ' phone-input--disabled' : '')}>
      <label className="phone-input__country">
        <span>{country.flag} +{country.code}</span>
        <i aria-hidden="true">▾</i>
        <select value={country.code} onChange={(e) => pickCountry(e.target.value)} disabled={disabled} aria-label={ariaLabel}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.name} +{c.code}</option>
          ))}
        </select>
      </label>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className="focus-create__input phone-input__field"
        placeholder={country.example}
        value={formatLocal(country, local)}
        onChange={typed}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
      />
    </div>
  )
}
