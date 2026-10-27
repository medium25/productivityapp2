import { formatLocal, joinPhone, splitPhone, DEFAULT_COUNTRY } from './phoneAccount'

// Phone field for Uzbekistan: the +998 prefix is a fixed label, only the rest
// of the number is typed — grouped as you type ("90 123 45 67"). `value` /
// `onChange` carry the full number ("+998901234567", or "+998" while empty),
// so it plugs straight into the helpers in phoneAccount.js. A pasted number
// with the +998 / 998 prefix is accepted too.
export default function PhoneInput({ value, onChange, disabled, autoFocus, id, ariaLabel }) {
  const country = DEFAULT_COUNTRY
  const { local } = splitPhone(value)

  const typed = (e) => {
    let digits = e.target.value.replace(/\D/g, '')
    if (digits.length > country.length && digits.startsWith(country.code)) digits = digits.slice(country.code.length)
    onChange(joinPhone(country, digits.slice(0, country.length)))
  }

  return (
    <div className={'phone-input' + (disabled ? ' phone-input--disabled' : '')}>
      <span className="phone-input__country">{country.flag} +{country.code}</span>
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
