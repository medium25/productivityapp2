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
