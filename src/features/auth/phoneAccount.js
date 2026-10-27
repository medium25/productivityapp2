// Phone-number accounts without SMS: Firebase only does phone sign-in through
// SMS codes, so a phone account is stored as an ordinary email/password
// account whose "email" is derived from the number. The domain is a
// subdomain of this app's own GitHub Pages host — a well-formed address
// Firebase accepts, with no mail server behind it; nothing in the app ever
// sends mail to it anyway. Users only ever see and type the number.
// Never change it: existing phone accounts are keyed by this exact address.
export const PHONE_EMAIL_DOMAIN = 'phone.medium25.github.io'

// "+998 90 123 45 67", "998901234567", "90 123 45 67" -> "+998901234567"
// (Uzbekistan is the default country; any other number needs its own +code).
export function normalizePhone(raw) {
  const text = String(raw || '').trim()
  const digits = text.replace(/\D/g, '')
  if (text.startsWith('+')) return `+${digits}`
  if (digits.length === 9) return `+998${digits}`
  return `+${digits}`
}

export const phoneToEmail = (raw) => `${normalizePhone(raw).slice(1)}@${PHONE_EMAIL_DOMAIN}`

export const isPhoneEmail = (email) => String(email || '').toLowerCase().endsWith(`@${PHONE_EMAIL_DOMAIN}`)

// "+998 90 123 45 67" for an Uzbek number, "+<digits>" otherwise.
export function formatPhone(raw) {
  const p = normalizePhone(raw)
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(p)
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p
}

// What to show for an account: the number for phone accounts, else the email.
export function accountLabel(email) {
  if (!isPhoneEmail(email)) return email || ''
  return formatPhone(`+${String(email).split('@')[0]}`)
}

// Friend search etc.: something that looks like a phone number becomes that
// number's account email; anything else is treated as an email address.
export function toAccountEmail(input) {
  const text = String(input || '').trim()
  return /^[+\d][\d\s()-]{6,}$/.test(text) ? phoneToEmail(text) : text
}

// ---- Number entry: country prefix is fixed in the UI, only the rest is typed.
// Uzbekistan only: the +998 prefix is fixed in the UI and never typed.
export const COUNTRIES = [
  { code: '998', flag: '🇺🇿', name: 'Узбекистан', length: 9, groups: [2, 3, 2, 2], example: '90 123 45 67' },
]
export const DEFAULT_COUNTRY = COUNTRIES[0]

// Any input ("+998 90 123 45 67", "998901234567", "90 123 45 67", "") ->
// { country, local } where local is the digits after the country code.
export function splitPhone(raw) {
  const text = String(raw || '').trim()
  const digits = normalizePhone(text).slice(1)
  if (!text || digits === '') return { country: DEFAULT_COUNTRY, local: '' }
  // Longest code first so "998…" never reads as "9…".
  const country = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length).find((c) => digits.startsWith(c.code))
  if (!country) return { country: DEFAULT_COUNTRY, local: digits.slice(0, DEFAULT_COUNTRY.length) }
  return { country, local: digits.slice(country.code.length, country.code.length + country.length) }
}

export const joinPhone = (country, local) => `+${country.code}${local}`

export function formatLocal(country, local) {
  const parts = []
  let i = 0
  for (const g of country.groups) {
    if (i >= local.length) break
    parts.push(local.slice(i, i + g))
    i += g
  }
  return parts.join(' ')
}

export const isCompletePhone = (raw) => {
  const { country, local } = splitPhone(raw)
  return local.length === country.length
}

// Default password for phone accounts: the number exactly as it is typed on
// screen — the digits after the country code ("900064544"; 6+ characters, over
// Firebase's minimum).
export const defaultPassword = (raw) => splitPhone(raw).local

// Accounts set up before that rule used the full number with the country code
// ("998900064544") — still accepted at sign-in.
export const legacyPassword = (raw) => normalizePhone(raw).slice(1)

// Which passwords to try for what was typed: nothing / the number in either
// form -> both forms; anything else is a real password -> just that.
export function passwordCandidates(raw, typed) {
  const local = defaultPassword(raw)
  const full = legacyPassword(raw)
  if (!typed || typed === local) return [local, full]
  if (typed === full) return [full, local]
  return [typed]
}
