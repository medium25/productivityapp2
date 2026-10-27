import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'

const RECAPTCHA_CONTAINER_ID = 'auth-recaptcha-container'

// "+998 90 123 45 67", "998901234567", "901234567" -> "+998901234567"
// (Uzbekistan is the default country; any other number needs its own +code).
function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '')
  if (String(raw).trim().startsWith('+')) return `+${digits}`
  if (digits.length === 9) return `+998${digits}`
  return `+${digits}`
}

// Firebase reports errors as "Firebase: Error (auth/some-code)." — show a
// plain sentence instead, falling back to the raw text for unknown codes.
const AUTH_ERRORS = [
  'invalid-credential', 'wrong-password', 'user-not-found', 'invalid-email',
  'invalid-phone-number', 'missing-phone-number', 'invalid-verification-code',
  'code-expired', 'too-many-requests', 'operation-not-allowed',
  'captcha-check-failed', 'network-request-failed', 'quota-exceeded',
]
function authErrorText(error, t) {
  const code = /auth\/([a-z-]+)/.exec(error || '')?.[1]
  return code && AUTH_ERRORS.includes(code) ? t(`auth.errors.${code}`) : error
}

export default function AuthPage() {
  const { t } = useTranslation()
  const error = useAuthStore((s) => s.error)
  const signInEmail = useAuthStore((s) => s.signInEmail)
  const sendPhoneOtp = useAuthStore((s) => s.sendPhoneOtp)
  const confirmPhoneOtp = useAuthStore((s) => s.confirmPhoneOtp)

  // Phone (SMS code) is the only way to create an account — it signs in and
  // registers in one step. Email is kept only as a fallback sign-in for
  // accounts that were created with it earlier; there is no email sign-up.
  const [method, setMethod] = useState('phone')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('+998 ')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submitEmail = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await signInEmail(email.trim(), password)
    } catch {
      // useAuthStore already recorded the error for display below
    } finally {
      setSubmitting(false)
    }
  }

  const submitPhoneStep = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (otpSent) {
        await confirmPhoneOtp(otpCode.replace(/\D/g, ''))
      } else {
        await sendPhoneOtp(normalizePhone(phoneNumber), RECAPTCHA_CONTAINER_ID)
        setOtpSent(true)
      }
    } catch {
      // useAuthStore already recorded the error for display below
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">{t('auth.title')}</h1>
        <p className="auth-card__subtitle">{method === 'phone' ? t('auth.phoneSubtitle') : t('auth.emailSubtitle')}</p>

        {method === 'phone' ? (
          <form className="auth-form" onSubmit={submitPhoneStep}>
            <input
              type="tel"
              inputMode="tel"
              className="focus-create__input"
              placeholder={t('auth.phonePlaceholder')}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={otpSent}
              required
              autoComplete="tel"
            />
            {otpSent && (
              <input
                type="text"
                inputMode="numeric"
                className="focus-create__input"
                placeholder={t('auth.otpPlaceholder')}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
                autoFocus
                autoComplete="one-time-code"
              />
            )}
            <button type="submit" className="timer-controls__primary" disabled={submitting}>
              {otpSent ? t('auth.confirmCode') : t('auth.sendCode')}
            </button>
            {otpSent && (
              <button type="button" className="auth-card__link" onClick={() => { setOtpSent(false); setOtpCode('') }}>
                {t('auth.changeNumber')}
              </button>
            )}
          </form>
        ) : (
          <form className="auth-form" onSubmit={submitEmail}>
            <input
              type="email"
              className="focus-create__input"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              type="password"
              className="focus-create__input"
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
            />
            <button type="submit" className="timer-controls__primary" disabled={submitting}>
              {t('auth.signIn')}
            </button>
          </form>
        )}

        {error && <p className="auth-card__error">{authErrorText(error, t)}</p>}

        <button type="button" className="auth-card__link" onClick={() => setMethod(method === 'phone' ? 'email' : 'phone')}>
          {method === 'phone' ? t('auth.useEmail') : t('auth.usePhone')}
        </button>

        <div id={RECAPTCHA_CONTAINER_ID} />
      </div>
    </div>
  )
}
